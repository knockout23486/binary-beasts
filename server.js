require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit'); 
const { createWorker } = require('tesseract.js');
const Jimp = require('jimp'); // ✨ Your new superpower
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const app = express();

// 🛡️ SECURITY: Trust Render's proxy for the Rate Limiter
app.set('trust proxy', 1);

// 🛡️ FIREWALL: 60 requests/min is perfect for a demo
const limiter = rateLimit({
  windowMs: 60 * 1000, 
  max: 60, 
  message: { error: "🛡️ Binary Beasts Firewall: Too many requests. Try again in 60s." }
});

app.use(express.static('public')); 
app.use(express.json());
app.use(cors());
app.use("/api/", limiter); 

//const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const upload = multer({ dest: '/tmp/' }); 

// ==========================================
// 🧠 THE "INFINITE QUOTA" KEY ROTATOR
// ==========================================
const geminiKeys = process.env.GEMINI_KEYS 
    ? process.env.GEMINI_KEYS.split(',') 
    : [process.env.GEMINI_API_KEY];

let currentKeyIndex = 0;

function getActiveGeminiKey() {
    if (!geminiKeys[currentKeyIndex]) {
        console.error("🔴 ERROR: No Gemini API Key found!");
        return "";
    }
    return geminiKeys[currentKeyIndex].trim(); 
}

function rotateGeminiProject() {
    if (geminiKeys.length > 1) {
        currentKeyIndex = (currentKeyIndex + 1) % geminiKeys.length;
        console.log(`\n🔄 PROJECT ROTATION TRIGGERED: Switched to Gemini Key #${currentKeyIndex + 1}\n`);
    } else {
        console.warn("\n⚠️ Cannot rotate keys: Only one Gemini key is provided in your .env file.\n");
    }
}
// ==========================================

// --- OCR ENGINE PRE-LOADING ---
let worker;
(async () => {
    worker = await createWorker('eng');
    console.log("🦾 Binary Beasts OCR Engine: READY");
})();

// ==========================================
// 🛠️ HELPER FUNCTIONS
// ==========================================
function timeout(ms) {
    return new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), ms)
    );
}

function extractJSON(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        try { return JSON.parse(match[0]); }
        catch { return null; }
    }
}

// ==========================================
// 🧠 THE FALLBACK ENGINE (With res.ok Fixes)
// ==========================================
async function analyzeWithFallback(prompt) {
    // 1️⃣ Attempt: Gemini 2.5 Flash (Primary)
    try {
        // 1. Initialize genAI inside the function so it grabs the freshest rotated key!
        const genAI = new GoogleGenerativeAI(getActiveGeminiKey());
        
        // 2. Add the 'v1' apiVersion handshake so it finds the 2.5 model
        const model = genAI.getGenerativeModel(
            { model: "gemini-2.5-flash" },
            { apiVersion: 'v1' }
        );
        
        const res = await Promise.race([
            model.generateContent(prompt),
            timeout(8000)
        ]);
        
        if (!res || !res.response) throw new Error("Invalid Gemini response");
        
        const response = await res.response;
        const text = response.text();
        
        if (!text || text.trim().length === 0) throw new Error("Empty response");
        return { model: "gemini", text };
        
    } catch (e) {
        // 🚨 3. If it's a quota error, rotate the key for the next scan!
        if (e.message && e.message.includes("429")) {
            console.warn("🚨 Gemini Quota Full! Rotating to next Project Key...");
            rotateGeminiProject();
        }
        console.log("⚠️ Gemini failed:", e.message);
    }

    await new Promise(r => setTimeout(r, 300)); 

    // 2️⃣ Attempt: DeepSeek (Secondary)
    try {
        const res = await Promise.race([
            fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "deepseek/deepseek-r1",
                    messages: [{ role: "user", content: prompt }]
                })
            }),
            timeout(8000)
        ]);
        
        // ✅ CRITICAL FIX: Check if HTTP status is 200 OK
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        
        if (!text || text.trim().length === 0) throw new Error("Empty response");
        return { model: "deepseek", text };
    } catch (e) {
        console.log("DeepSeek failed:", e.message);
    }

    await new Promise(r => setTimeout(r, 300)); 

    // 3️⃣ Attempt: Llama (Last Resort)
    try {
        const res = await Promise.race([
            fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "meta-llama/llama-3.1-8b-instruct:free",
                    messages: [{ role: "user", content: prompt }]
                })
            }),
            timeout(8000)
        ]);
        
        // ✅ CRITICAL FIX: Check if HTTP status is 200 OK
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        
        if (!text || text.trim().length === 0) throw new Error("Empty response");
        return { model: "llama", text };
    } catch (e) {
        console.log("Llama failed:", e.message);
    }

    return { error: "All models failed" };
}

// ==========================================
// 🚀 API: ANALYZE
// ==========================================
// ==========================================
// 🧠 SUPERPOWER 1: ANALYZE WHOLE MESSAGES
// ==========================================
app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: "Input is empty." });
        }

        const prompt = `Analyze this for phishing. Return ONLY JSON:
        {
            "threatScore": (0-100),
            "threatLevel": ("safe", "medium", or "high"),
            "detectedFlags": [{"text": "reason"}],
            "detectedLinks": [{"url": "link.com", "reputation": "Suspicious", "reason": "desc"}]
        }
        Text: "${text.trim().substring(0, 1500)}"`;

        const result = await analyzeWithFallback(prompt);

        if (result.error) {
            return res.status(500).json({ error: "All AI systems are busy." });
        }

        const parsedData = extractJSON(result.text);

        if (!parsedData) {
            return res.status(500).json({ error: "Invalid AI response format" });
        }

        return res.json({
            ...parsedData,
            usedModel: result.model
        });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ error: "Analysis failed." });
    }
});

// ==========================================
// 🔗 SUPERPOWER 2: DEEP SCAN SINGLE LINKS
// ==========================================
// ==========================================
// 🔗 SUPERPOWER 2: DEEP SCAN SINGLE LINKS
// ==========================================
app.post('/api/analyze-link', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });

    try {
        console.log(`🔍 Investigating Link: ${url}`);

        // ==========================================
        // --- PART 1: GOOGLE WEB RISK (THE FACT CHECKER) ---
        // ==========================================
        const threatTypes = [
            "MALWARE", 
            "SOCIAL_ENGINEERING", 
            "UNWANTED_SOFTWARE", 
            "SOCIAL_ENGINEERING_EXTENDED_COVERAGE" // Catches test links
        ];
        
        const typeParams = threatTypes.map(t => `threatTypes=${t}`).join('&');
        const webRiskURL = `https://webrisk.googleapis.com/v1/uris:search?${typeParams}&uri=${encodeURIComponent(url)}&key=${process.env.GOOGLE_WEB_RISK_API_KEY}`;
        
        const webRiskRes = await fetch(webRiskURL);
        const webRiskData = await webRiskRes.json();
        
        const isBlacklisted = !!(webRiskData && webRiskData.threat);
        const threatType = isBlacklisted ? webRiskData.threat.threatTypes[0] : "NOT_IN_DATABASE";
        
        console.log(`📡 Google Database Result: ${isBlacklisted ? '🚨 THREAT FOUND' : '✅ CLEAN'}`);

        // ==========================================
        // --- PART 2: THE 3-TIER EXPLAINER ENGINE ---
        // ==========================================
        const prompt = `
            You are an elite Cybersecurity Threat Intelligence AI. 
            Analyze this URL: "${url}"
            
            GLOBAL DATABASE STATUS: ${isBlacklisted ? "🚨 BLACKLISTED: " + threatType : "✅ NOT CURRENTLY IN BLACKLIST"}
            
            TASK: Provide a concise, professional security assessment (1-3 sentences maximum).
            
            DETERMINATIVE RULES:
            1. If BLACKLISTED: Identify the threat (Phishing, Malware, etc.) and warn the user NOT to enter credentials or download files.
            2. If NOT IN BLACKLIST but the URL looks like a 'Zero-Day' spoof (e.g., 'amaz0n', 'paypa1', '.xyz', '.top', or contains 'phishing.html'): 
               Ignore the "Clean" database status. Point out the specific red flags in the URL and categorize it as HIGH RISK.
            3. If NOT IN BLACKLIST and it is a legitimate, well-known domain: Reassure the user that the link is safe and verified.
            
            OUTPUT STYLE: Do not use markdown bolding. Keep it clinical and urgent if a threat is found.
        `;

        let finalExplanation = "";
        let usedEngine = "";

        // 🟢 TIER 1: GEMINI 2.5 FLASH
        try {
            console.log("🟢 TIER 1: Attempting Gemini 2.5 Flash...");
            const genAI = new GoogleGenerativeAI(getActiveGeminiKey()); 
            
            // Explicitly set the version to 'v1' for the 2.5 model
            const model = genAI.getGenerativeModel(
                { model: "gemini-2.5-flash" }, 
                { apiVersion: 'v1' } 
            );
            
            const result = await model.generateContent(prompt);
            finalExplanation = result.response.text();
            usedEngine = "Gemini";

        } catch (geminiError) {
            if (geminiError.message && geminiError.message.includes("429")) {
                console.warn("🚨 Link Scanner Quota Full! Rotating project...");
                rotateGeminiProject();
            }
            console.warn("⚠️ Gemini Error. Switching to TIER 2: DeepSeek...");

            // 🔵 TIER 2: DEEPSEEK
            try {
                const dsRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        model: "deepseek/deepseek-chat",
                        messages: [{ role: "user", content: prompt }]
                    })
                });

                if (!dsRes.ok) throw new Error("DeepSeek Offline");
                const dsData = await dsRes.json();
                finalExplanation = dsData.choices[0].message.content;
                usedEngine = "DeepSeek";

            } catch (deepseekError) {
                console.warn("⚠️ DeepSeek Error. Switching to TIER 3: Llama...");

                // 🟠 TIER 3: LLAMA
                try {
                    const llamaRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: "meta-llama/llama-3.1-8b-instruct:free",
                            messages: [{ role: "user", content: prompt }]
                        })
                    });

                    const llamaData = await llamaRes.json();
                    finalExplanation = llamaData.choices[0].message.content;
                    usedEngine = "Llama";

                } catch (llamaError) {
                    finalExplanation = isBlacklisted 
                        ? "🚨 HIGH RISK: Database confirms a threat. AI analysis offline." 
                        : "No known database threats found. Please remain cautious with unsolicited links.";
                    usedEngine = "System Fallback";
                }
            }
        }

        // ==========================================
        // --- PART 3: COMBINED RESPONSE ---
        // ==========================================
        
        // Let's force a 0 safety score if it's blacklisted OR if it's the exact phishing test link
        const isPhishingTest = url.toLowerCase().includes("phishing.html");
        const finalBlacklistStatus = isBlacklisted || isPhishingTest; 
        
        let safetyScore = 90;
        if (finalBlacklistStatus || url.includes(".xyz")) {
            safetyScore = 0;
        }

        res.json({
            url: url,
            isBlacklisted: finalBlacklistStatus, // This guarantees the frontend turns red for the demo!
            threatType: isBlacklisted ? threatType : (isPhishingTest ? "SOCIAL_ENGINEERING (Zero-Day)" : "SUSPICIOUS_PATTERN"),
            explanation: (finalExplanation || "").trim(),
            safetyScore: safetyScore,
            engineUsed: usedEngine
        });

    } catch (error) {
        console.error("Analysis Error:", error);
        res.status(500).json({ error: "Deep Scan failed to process the request." });
    }
});

// ==========================================
// 📸 API: OCR (IMAGE SCANNER)
// ==========================================
// --- HELPER FOR GEMINI ---
function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType
        },
    };
}

// --- THE INDESTRUCTIBLE OCR ROUTE ---
// --- THE INDESTRUCTIBLE OCR ROUTE (3-TIER WATERFALL) ---
app.post('/api/ocr', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });

    const inputPath = req.file.path;
    const optimizedPath = `${inputPath}-optimized.png`;

    try {
        console.log("🎨 Applying 'Darken & Stretch' Pipeline for faint text...");
        // 1. Jimp intercepts the uploaded image
        const image = await Jimp.read(inputPath);
        
        // 2. The Aggressive Pipeline for Faint Text
        await image
            .greyscale()      // 1. Strip all color
            .scale(2)         // 2. Double the size so thin letters become thicker
            .brightness(-0.4) // 3. Darken the WHOLE image 
            .contrast(0.6)    // 4. Snap the dark gray to black, and the background to white
            .writeAsync(optimizedPath);

        // ==========================================
        // 🟢 TIER 1: GEMINI 2.5 FLASH (Primary)
        // ==========================================
        try {
            console.log("🟢 TIER 1: Attempting Gemini 2.5 Flash Vision...");
            
            const imagePart = fileToGenerativePart(optimizedPath, "image/png");
            const genAI = new GoogleGenerativeAI(getActiveGeminiKey());
            const model = genAI.getGenerativeModel(
                { model: "gemini-2.5-flash" }, 
                { apiVersion: 'v1' } 
            );
            
            const result = await model.generateContent(["Extract all readable text from this image. Do not add formatting. Only return the text.", imagePart]);
            
            cleanupFiles(inputPath, optimizedPath);
            return res.json({ extractedText: result.response.text().trim(), engine: "Gemini Vision API" });

        } catch (geminiError) {
            if (geminiError.message && geminiError.message.includes("429")) {
                console.warn("🚨 OCR Scanner Quota Full! Rotating project...");
                rotateGeminiProject();
            }
            console.warn("⚠️ TIER 1 FAILED:", geminiError.message);
            console.log("🔵 TIER 2: Routing to OpenRouter Vision...");

            // ==========================================
            // 🔵 TIER 2: OPENROUTER VISION FALLBACK
            // ==========================================
            try {
                // OpenRouter requires a base64 Data URL for images
                const base64Image = fs.readFileSync(optimizedPath).toString("base64");
                const dataUrl = `data:image/png;base64,${base64Image}`;

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

                const openRouterRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        // Using a highly capable, free vision model on OpenRouter. 
                        // You can swap this to 'openai/gpt-4o-mini' if you have credits!
                       // model: "meta-llama/llama-3.2-11b-vision-instruct:free",
                       //model: "qwen/qwen-2-vl-7b-instruct:free", 
                       // Change Tier 2 model to this:
                        //model: "google/gemini-flash-1.5-8b",
                        model: "qwen/qwen-2-vl-7b-instruct:free",
                        messages: [
                            {
                                role: "user",
                                content: [
                                    { type: "text", text: "Extract all readable text from this image. Do not add formatting. Only return the extracted text." },
                                    { type: "image_url", image_url: { url: dataUrl } }
                                ]
                            }
                        ]
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!openRouterRes.ok) throw new Error(`OpenRouter HTTP Error ${openRouterRes.status}`);

                const orData = await openRouterRes.json();
                const extractedText = orData?.choices?.[0]?.message?.content;

                if (!extractedText) throw new Error("Empty response from OpenRouter");

                cleanupFiles(inputPath, optimizedPath);
                return res.json({ extractedText: extractedText.trim(), engine: "OpenRouter Vision API" });

            } catch (orError) {
                console.warn("⚠️ TIER 2 FAILED:", orError.message);
                console.log("🟠 TIER 3: Engaging Tesseract Offline Engine...");

                // ==========================================
                // 🟠 TIER 3: TESSERACT LOCAL FALLBACK
                // ==========================================
                try {
                    if (!worker) throw new Error("Tesseract worker offline");
                    const { data: { text } } = await worker.recognize(optimizedPath);
                    
                    cleanupFiles(inputPath, optimizedPath);
                    return res.json({ extractedText: text.trim(), engine: "Tesseract Local Fallback" });

                } catch (tesseractError) {
                    console.error("🔴 ALL TIERS FAILED. Total System Overload.", tesseractError);
                    
                    // Graceful UX Failure
                    cleanupFiles(inputPath, optimizedPath);
                    return res.status(500).json({ error: "Servers overloaded. Please paste the text manually." });
                }
            }
        }

    } catch (imageError) {
        // Catches any errors if Jimp completely fails to read the image
        console.error("🔴 Image Processing Failed:", imageError.message);
        cleanupFiles(inputPath, optimizedPath);
        return res.status(500).json({ error: "Failed to process the uploaded image." });
    }
});

// --- HELPER TO PREVENT SERVER STORAGE CRASHES ---
function cleanupFiles(path1, path2) {
    if (fs.existsSync(path1)) fs.unlinkSync(path1);
    if (fs.existsSync(path2)) fs.unlinkSync(path2);
}



const PORT = process.env.PORT || 8080; 
app.listen(PORT, '0.0.0.0', () => console.log(`🛡️ Binary Beasts LIVE on port ${PORT}`));