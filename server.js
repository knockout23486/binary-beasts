require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { rateLimit } = require('express-rate-limit'); // ✅ Fixed for v8
const { createWorker } = require('tesseract.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');

const app = express();

// 🛡️ BINARY BEASTS FIREWALL: Protects your Gemini API Key
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // Limit each IP to 20 requests per minute
  message: { error: "🛡️ Binary Beasts Firewall: Too many requests. Try again in 60s." }
});

// 🏗️ THE FUSION: Serves your index.html and protects the API
app.use(express.static('public')); 
app.use(express.json());
app.use(cors());
app.use("/api/", limiter); // Applies the firewall to your scan routes

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const upload = multer({ dest: '/tmp/' }); // ✅ Correct for Google Cloud Run
// --- OCR ENGINE PRE-LOADING ---
let worker;
(async () => {
    worker = await createWorker('eng');
    console.log("🦾 Binary Beasts OCR Engine: READY");
})();

/// --- API: ANALYZE (Refined with Bulletproof Parsing) ---
app.post('/api/analyze', async (req, res) => {
    try {
        const { text } = req.body;

        // 🛡️ SECURITY FIX: Input Validation
        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: "Input is empty. Please provide text to analyze." });
        }
        if (text.length > 5000) {
            return res.status(400).json({ error: "Message too long. Maximum 5000 characters allowed." });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
       const prompt = `
            Analyze the following text for phishing threats.
        Return ONLY a JSON object with this structure:
        {
            "threatScore": (number 0-100),
            "threatLevel": ("safe", "medium", or "high"),
            "detectedFlags": [{"text": "reason"}],
            "detectedLinks": [
                {
                    "url": "extracted-link.com",
                    "reputation": "Suspicious", 
                    "reason": "Uses .xyz TLD often found in scams"
                }
            ]
            }
            Text to analyze: "${text}"
            `;

        const result = await model.generateContent(prompt);
        let rawText = result.response.text();

        // 🛡️ YOUR SAFER FIX: Extract JSON boundaries
        const start = rawText.indexOf('{');
        const end = rawText.lastIndexOf('}');

        if (start === -1 || end === -1) {
            console.error("AI Response was not JSON:", rawText);
            throw new Error("Invalid AI response format");
        }

        const jsonString = rawText.substring(start, end + 1);
        res.json(JSON.parse(jsonString));

    } catch (error) {
        console.error("Detailed Analysis Error:", error);
        res.status(500).json({ error: "Analysis failed. Please try again." });
    }
});

// --- API: OCR (Now with Backend Security & Cleanup) ---
// --- API: OCR (Hardened with Worker Guard) ---
app.post('/api/ocr', upload.single('image'), async (req, res) => {
    try {
        // 1. WORKER GUARD: Prevent crash during engine warmup
        if (!worker) {
            return res.status(503).json({ 
                error: "🛡️ Binary Beasts: OCR engine is warming up. Please try again in 5 seconds." 
            });
        }

        // 2. FILE CHECK
        if (!req.file) {
            return res.status(400).json({ error: "No image uploaded" });
        }
        
        // 3. SECURITY: Mimetype check
        if (!req.file.mimetype.startsWith('image/')) {
            if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
            return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
        }

        // 4. VISION PROCESSING
        const { data: { text } } = await worker.recognize(req.file.path);
        
        // 5. CLEANUP
        fs.unlinkSync(req.file.path);
        res.json({ extractedText: text });

    } catch (error) {
        // Ensure cleanup if recognize() fails
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error("OCR Failure:", error);
        res.status(500).json({ error: "OCR Failed to process the threat image." });
    }
});
// 2. DYNAMIC PORT: Google Cloud Run requires this!
const PORT = process.env.PORT || 8080; 
app.listen(PORT, '0.0.0.0', () => console.log(`🛡️ Binary Beasts LIVE on port ${PORT}`));