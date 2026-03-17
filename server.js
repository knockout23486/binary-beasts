require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit'); 
const { createWorker } = require('tesseract.js');
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

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const upload = multer({ dest: '/tmp/' }); 

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
    // 1️⃣ Attempt: Gemini (Primary)
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
        console.log("Gemini failed:", e.message);
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
// 📸 API: OCR (IMAGE SCANNER)
// ==========================================
app.post('/api/ocr', upload.single('image'), async (req, res) => {
    try {
        if (!worker) return res.status(503).json({ error: "Engine warming up..." });
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });
        
        const { data: { text } } = await worker.recognize(req.file.path);
        fs.unlinkSync(req.file.path);
        res.json({ extractedText: text });

    } catch (error) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ error: "OCR Failed." });
    }
});

const PORT = process.env.PORT || 8080; 
app.listen(PORT, '0.0.0.0', () => console.log(`🛡️ Binary Beasts LIVE on port ${PORT}`));