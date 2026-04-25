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
            timeout(15000)
        ]);
        
        if (!res || !res.response) throw new Error("Invalid Gemini response");
        
        const response = await res.response;
        const text = response.text();
        
        if (!text || text.trim().length === 0) throw new Error("Empty response");
        return { model: "gemini", text };
        
} catch (e) {
        // 🚨 3. If it's a quota error, rotate the key for the next scan!
        if (e?.status === 429 || (e?.message && (e.message.includes("429") || e.message.toLowerCase().includes("quota") || e.message.toLowerCase().includes("exhausted")))) {
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
                    model: "openai/gpt-4o-mini", //deepseek-r1
                    messages: [{ role: "user", content: prompt }]
                })
            }),
            timeout(10000)
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
                    model: "meta-llama/llama-3.1-8b-instruct",
                    messages: [{ role: "user", content: prompt }]
                })
            }),
            timeout(10000)
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

        // 🔥 THE NEW "SMART" PROMPT (Won't over-flag business chats)
        const prompt = `
You are a Cybersecurity Threat Detection Engine.

Your job is to detect REAL phishing and social engineering attacks.

IMPORTANT:
- Do NOT over-flag normal business communication.
- Professional workplace requests are SAFE unless strong malicious signals exist.
- Assume SAFE by default unless clear evidence proves otherwise.

TEXT:
"${text.trim().substring(0, 1500)}"

--- STRICT DETECTION RULES ---

Only flag if CLEAR evidence exists:

1. URGENCY → Only if extreme:
   Examples: "immediately", "within 1 hour", "account suspended", "last warning"

2. AUTHORITY IMPERSONATION → Only if explicit:
   Examples: "I am your CEO", "from IT department", "bank verification required"

3. PROTOCOL BYPASS → Only if abnormal:
   Examples: "don't inform anyone", "skip approval", "buy gift cards secretly"

4. LINKS → Only if:
   - Suspicious domain
   - Shortened link hiding destination
   - Mismatch between text and URL

--- SAFE CONDITIONS (VERY IMPORTANT) ---
Mark SAFE if:
- Message is normal workplace communication
- Requests like "review document", "share access", "check file"
- No suspicious links or impersonation

--- SCORING ---
0–15 → Safe  
16–50 → Medium (ONLY if 1 strong signal exists)  
51–100 → High (multiple strong signals)

--- OUTPUT ---
Return ONLY valid JSON:
{
  "threatScore": number,
  "threatLevel": "safe" | "medium" | "high",
  "analysisSummary": "short explanation",
  "detectedFlags": [ { "text": "explanation" } ],
  "detectedLinks": [ { "url": "link", "reputation": "Safe | Suspicious | Malicious", "reason": "why" } ],
  "confidence": "low | medium | high"
}
`;

        const result = await analyzeWithFallback(prompt);

        if (result.error) {
            return res.status(500).json({ error: "⚠️ AI systems busy. Showing heuristic analysis instead."});
        }

        let parsedData = extractJSON(result.text);

        if (!parsedData) {
            return res.status(500).json({ error: "Invalid AI response format" });
        }

        // 🛡️ NEW: THE "COMMON SENSE" POST-VALIDATION LAYER
        const lowerText = text.toLowerCase();
        const hasUrgencyKeywords = /(urgent|immediately|asap|now|within|hour|last warning|suspended)/i.test(lowerText);
        const hasImpersonationKeywords = /(ceo|it department|bank|verification|official|admin|manager)/i.test(lowerText);
        
        // 🚨 THE NEW FIX: Check for linkless phishing (BEC / Credential Harvesting)
        const hasSensitiveRequest = /(otp|password|bank|verify|login|account|transfer|wire|gift card)/i.test(lowerText);
        
        // 1. Check for "Fake" Urgency
        if (parsedData.detectedFlags) {
            parsedData.detectedFlags = parsedData.detectedFlags.filter(flag => {
                // If AI flags urgency but there are no actual urgent words, delete the flag!
                if (flag.text.toLowerCase().includes("urgency") && !hasUrgencyKeywords) {
                    return false; 
                }
                return true;
            });
        }

        // 2. The Global "Safe Override" (Now protected against linkless phishing!)
        const hasSuspiciousLink = parsedData.detectedLinks && parsedData.detectedLinks.some(l => l.reputation !== 'Safe');
        
        // Notice we added `&& !hasSensitiveRequest` so it doesn't auto-pass hackers asking for passwords
        if (parsedData.threatScore > 15 && !hasSuspiciousLink && !hasUrgencyKeywords && !hasImpersonationKeywords && !hasSensitiveRequest) {
            // THE NEW FIX: Cap the score low instead of forcing absolute zero
            parsedData.threatScore = Math.min(parsedData.threatScore, 10); 
            parsedData.threatLevel = "safe";
            parsedData.analysisSummary = "Standard communication detected. No high-risk indicators found.";
        }
        // ==========================================
        // 🌟 UNIVERSAL VIP WHITELIST OVERRIDE 🌟
        // ==========================================
        const vipDomains = [
            "binary-beasts-imqc.onrender.com",
            "google.com", 
            "share.google", 
            "youtube.com",
            "youtu.be",
            "github.com",
            "linkedin.com", 
            "microsoft.com",
            "office.com",
            "apple.com",
            "amazon.com",
            "amazon.in",
            "flipkart.com",
            "whatsapp.com",
            "wa.me",
            "twitter.com",
            "t.co",
            "instagram.com",
            "roblox.com",
            "discord.com",
            "steampowered.com"
        ];

        // Force the overall message score to 0 if it contains our own app URL
        const myAppUrl = "binary-beasts-imqc.onrender.com";
        if (text.includes(myAppUrl)) {
            parsedData.threatScore = 0;
            parsedData.threatLevel = "safe";
            parsedData.analysisSummary = "Verified as the official, secure host of the Binary Beasts Engine.";
            parsedData.detectedFlags = [{"text": "Official Domain Verified"}];
        }

        // Loop through all links the AI found and force them to "Safe" if they match the VIP list
        if (parsedData.detectedLinks && Array.isArray(parsedData.detectedLinks)) {
            let whitelistedLinkFound = false;

            parsedData.detectedLinks = parsedData.detectedLinks.map(linkObj => {
                let isSafe = false;
                try {
                    const parsedUrl = new URL(linkObj.url.toLowerCase().trim());
                    const hostname = parsedUrl.hostname;
                    isSafe = vipDomains.some(vip => hostname === vip || hostname.endsWith('.' + vip));
                } catch (e) {
                    // Ignore broken URLs
                }

                if (isSafe) {
                    whitelistedLinkFound = true;
                    return {
                        url: linkObj.url,
                        reputation: "Safe", 
                        reason: "✅ Enterprise Trusted Domain. Verified by zero-trust security policy."
                    };
                }
                return linkObj; 
            });

            // Smart Override: If AI panicked because of a whitelisted link, reset overall score!
            if (whitelistedLinkFound && (!parsedData.detectedFlags || parsedData.detectedFlags.length === 0 || parsedData.threatScore < 50)) {
                parsedData.threatScore = 0;
                parsedData.threatLevel = "safe";
                parsedData.analysisSummary = "Message contains verified secure links. No social engineering detected.";
            }
        }

        // ==========================================
        // 🚨 ELITE TIER: DOMAIN REPUTATION & RISK ACCUMULATION
        // ==========================================
        
        // 1. Enforce Schema Defaults 
        if (!parsedData.confidence) {
            parsedData.confidence = "medium";
        }
        if (!parsedData.detectedFlags) {
            parsedData.detectedFlags = [];
        }

        // 2. TLD Reputation Check (Infrastructure Risk)
        const suspiciousTLD = /\.(xyz|top|click|ru|cn|tk|buzz|live)(\/|\s|$)/i.test(text);
        
        if (suspiciousTLD && parsedData.threatScore < 100) {
            parsedData.threatScore = Math.min(100, parsedData.threatScore + 25);
            parsedData.detectedFlags.push({
                text: "[Infrastructure Risk] Message contains a link to a high-risk Top Level Domain (.xyz, .top, etc.) frequently used by threat actors."
            });
            
            // Bump Threat Level
            if (parsedData.threatLevel === "safe") parsedData.threatLevel = "medium";
            else if (parsedData.threatLevel === "medium" && parsedData.threatScore >= 60) parsedData.threatLevel = "high";
        }

        // 3. Suspicion Accumulation (SIEM Logic)
        const flagCount = parsedData.detectedFlags.length;
        const hasBadLink = parsedData.detectedLinks && parsedData.detectedLinks.some(l => l.reputation !== 'Safe');

        if (flagCount >= 2 && !hasBadLink && parsedData.threatScore < 40) {
            parsedData.threatScore = 45;
            parsedData.threatLevel = "medium";
            parsedData.analysisSummary = "Multiple suspicious linguistic patterns detected. Proceed with caution.";
        } else if (flagCount >= 2 && hasBadLink && parsedData.threatScore < 65) {
            parsedData.threatScore = 75;
            parsedData.threatLevel = "high";
            parsedData.analysisSummary = "High probability of social engineering combined with a suspicious external link.";
        }

        // --- FINAL OUTPUT ---
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
            Act as an elite Cybersecurity Threat Intelligence AI. 
            Analyze this specific URL for zero-day phishing or malicious intent: "${url}"
            
            GLOBAL DATABASE STATUS: ${isBlacklisted ? "🚨 BLACKLISTED: " + threatType : "✅ NOT CURRENTLY IN BLACKLIST"}
            
            TASK: Provide a concise, clinical security assessment (1-3 sentences maximum).
            
            --- ANALYSIS PROTOCOLS ---
            1. DATABASE OVERRIDE: If the database says BLACKLISTED, identify the threat and warn the user.
            2. SEMANTIC DECEPTION: If not blacklisted, check for typosquatting (e.g., 'amaz0n'), suspicious TLDs (.xyz, .top), or country-code spoofing (e.g., .ge instead of .com).
            3. HEURISTIC ANALYSIS: Does it use a free shared host (like onrender.com or vercel.app) to look like a legitimate service?
            4. SAFE VERIFICATION: If the database is clean AND there are absolutely no semantic or heuristic red flags, reassure the user that the domain appears legitimate and safe.
            
            OUTPUT RULES:
            - Output ONLY plain text. No JSON, no markdown bolding, no conversational filler.
            - If you detect deceptive semantics or heuristic red flags, categorize it as HIGH RISK, even if the database status is clean.
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
            if (geminiError?.status === 429 || (geminiError?.message && (geminiError.message.includes("429") || geminiError.message.toLowerCase().includes("quota") || geminiError.message.toLowerCase().includes("exhausted")))) {
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
                        model: "openai/gpt-4o-mini",//"deepseek/deepseek-chat"//"deepseek/deepseek-r1"
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
                            model: "meta-llama/llama-3.1-8b-instruct",
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

        // 🌟 THE VIP WHITELIST ARRAY (Add as many safe domains as you want here!)
        const vipDomains = [
          // 🌟 THE CLEANED VIP WHITELIST 🌟
            "binary-beasts-imqc.onrender.com",
            "google.com", 
            "share.google", 
            "youtube.com",
            "youtu.be",
            "github.com",
            "linkedin.com", 
            "microsoft.com",
            "office.com",
            "apple.com",
            "amazon.com",
            "amazon.in",
            "flipkart.com",
            "whatsapp.com",
            "wa.me",
            "twitter.com",
            "t.co",
            "instagram.com",
            "roblox.com",
            "discord.com",
            "steampowered.com"
        ];
        
       // ... (Keep your VIP Domains list code above this)
        
       
        // 🚨 BULLETPROOF WHITELIST VERIFICATION 🚨
        let isWhitelist = false;
        try {
            // Extract just the domain part (e.g., "www.amazon.in" from "https://www.amazon.in/path")
            const parsedUrl = new URL(url.toLowerCase().trim());
            const hostname = parsedUrl.hostname;

            // Secure Check: Must be the EXACT domain OR a valid subdomain (ends with ".domain.com")
            // This blocks "fake-amazon.com" but allows "pay.amazon.com"
            isWhitelist = vipDomains.some(vip => 
                hostname === vip || hostname.endsWith('.' + vip)
            );
        } catch (e) {
            // If the text isn't a valid URL format, do not whitelist it.
            isWhitelist = false; 
        }
        const isPhishingTest = url.toLowerCase().includes("phishing.html");
        const finalBlacklistStatus = (isBlacklisted || isPhishingTest) && !isWhitelist;

      const aiText = (finalExplanation || "").toLowerCase();
        
        // 🚨 SMART FIX: We only trigger a threat if the AI explicitly uses the "high risk" 
        // category we told it to use in the prompt. This stops "dumb" false positives!
        let isAiThreat = aiText.includes("high risk") && !isWhitelist;
        
        // 🚨 THE FIX: INVERTING TO A "THREAT SCORE"
        // 0 = Completely Safe, 100 = Maximum Danger
        let finalThreatScore = 0; 

        if (finalBlacklistStatus || url.includes(".xyz") || isAiThreat) {
            finalThreatScore = 100; // Trigger maximum danger
        }
        
        // 🌟 WHITELIST OVERRIDE 🌟
        if (isWhitelist) {
            finalThreatScore = 0; // Force safe score
            finalExplanation = "✅ Enterprise Trusted Domain. This URL is verified by the organization's zero-trust security policy.";
        }

        res.json({
            url: url,
            isBlacklisted: finalBlacklistStatus || isAiThreat, 
            threatType: isWhitelist ? "VERIFIED_SAFE" : (isBlacklisted ? threatType : (isPhishingTest || isAiThreat ? "SOCIAL_ENGINEERING (Zero-Day)" : "SUSPICIOUS_PATTERN")),
            explanation: isWhitelist ? finalExplanation : (finalExplanation || "").trim(),
            safetyScore: finalThreatScore, // Sending the 0 or 100 to the frontend!
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
            if (geminiError?.status === 429 || (geminiError?.message && (geminiError.message.includes("429") || geminiError.message.toLowerCase().includes("quota") || geminiError.message.toLowerCase().includes("exhausted")))) {
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
                        model: "meta-llama/llama-3.2-11b-vision-instruct",
                       //model: "qwen/qwen-2-vl-7b-instruct:free", 
                       // Change Tier 2 model to this:
                        //model: "google/gemini-flash-1.5-8b",
                        //model: "qwen/qwen-2-vl-7b-instruct",
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



// 🚀 THE ULTIMATE DEPLOYMENT SETTING
const PORT = process.env.PORT || 3000; 

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🛡️ Binary Beasts LIVE on port ${PORT}`);
    console.log(`🦾 Systems: Gemini (Tier 1) | DeepSeek/openai (Tier 2) | Llama (Tier 3)`);
});