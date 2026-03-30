# 🛡️ Binary Beasts: AI Phishing Detector

An advanced AI-powered cybersecurity system that detects phishing attacks and social engineering scams in real time across both text and images.

---

## 🚀 Live Demo

🔗 https://binary-beasts-imqc.onrender.com

⚡ Note on Performance: We use a free-tier hosting provider (Render). If the extension takes ~50s for the very first scan, the server is performing a "cold start." Subsequent scans will be near-instant (0-2s).

---

## 🌍 Project Context

This project is built for the **GDG Hackathon (Hack2Skill)**, focused on solving real-world cybersecurity challenges using AI.

---

## ✨ The Problem

Modern phishing attacks are evolving rapidly.

Traditional security systems rely on static blocklists, which fail to detect:

* ⚠️ Zero-day phishing attacks
* 🖼️ Image-based scams (screenshots, fake receipts)
* 🧠 Psychological manipulation tactics

---

## 🚀 The Solution

**Binary Beasts** acts like a real-time AI security analyst.

Instead of keyword matching, it understands:

* Context
* Intent
* Human manipulation patterns

It generates a **Threat Score (0–100)** along with clear explanations and detected risks.

---

## 🧠 Intelligent AI Fallback System

To ensure reliability under API limits, we implemented a **multi-model fallback architecture**:

1. **Primary:** Google Gemini 2.5 Flash
2. **Fallback:** DeepSeek-R1 (via OpenRouter)
3. **Backup:** Meta Llama 3.1

👉 The UI dynamically displays which AI model is protecting the user.

---

## ⚙️ Key Features

✔ **AI Semantic Analysis**
Detects urgency, fear tactics, and phishing intent

✔ **OCR Screenshot Detection**
Extracts hidden text from images using Tesseract.js

✔ **Link Reputation Analysis**
Identifies suspicious domains and explains risks

✔ **Real-Time Threat Scoring**
Clear classification: Safe / Medium / High

✔ **Rate-Limited Backend**
Prevents abuse and protects API quotas

---

## 🛠️ Tech Stack

### 🎨 Frontend

* HTML5
* Tailwind CSS
* JavaScript
* Lucide Icons

### ⚙️ Backend

* Node.js
* Express.js
* Multer

### 🧠 AI & ML

* Google Gemini API
* OpenRouter (DeepSeek + Llama)

### 🔍 OCR Engine

* Tesseract.js

### 🚀 Deployment

* Render
* GitHub

---

## 💻 Run Locally

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/binary-beasts-project.git
cd binary-beasts-project
```

### 2️⃣ Install dependencies

```bash
npm install
```

### 3️⃣ Create `.env` file

```env
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
PORT=3000
```

### 4️⃣ Start the server

```bash
node server.js
```

### 5️⃣ Open in browser

```
http://localhost:3000
```

---

## 📌 How It Works

1. User inputs text or uploads a screenshot
2. OCR extracts text (if image input)
3. AI analyzes content using fallback system
4. System detects phishing signals
5. Returns threat score with explanation

---



## 🔄 Continuous Improvement

This system is actively being enhanced with:

* More advanced phishing detection models
* Improved OCR accuracy
* Smarter link reputation analysis
* Better UI/UX and performance optimizations

---

## 🏆 Hackathon Focus

* Real-world cybersecurity problem
* AI + OCR integration
* Scalable fallback architecture
* Production-ready design mindset

---

## ⭐ Final Note

Binary Beasts is not just a project — it's a step toward building **intelligent, adaptive cybersecurity systems** capable of defending against next-generation threats.

---

# 🚀 VERSION 2.0 UPDATE: Enterprise-Grade Architecture
*"An indestructible AI cybersecurity engine designed to detect zero-day threats in real time."*

During development, we identified a critical flaw in traditional AI-based systems — they fail under real-world conditions such as API rate limits, outages, and network instability.

To solve this, we **completely re-engineered Binary Beasts** from a simple prototype into a **high-availability, fault-tolerant cybersecurity engine**.

---

## ⚖️ Architecture Evolution: V1.0 vs V2.0

| Feature | ⚠️ V1.0 (Prototype) | 🛡️ V2.0 (Enterprise Upgrade) |
|--------|------------------|-----------------------------|
| **API Scalability** | Failed on `429 Quota Exceeded` | **Infinite Quota Engine:** Load-balanced multi-key system |
| **Uptime Reliability** | Dependent on single AI model | **Fault-Tolerant:** 3-Tier AI Waterfall (Gemini → DeepSeek → Llama) |
| **Threat Detection** | Basic AI text analysis | **Layered Intelligence:** Web Risk API + AI heuristics |
| **Image Processing** | Basic Tesseract OCR | **Advanced Pipeline:** Jimp → Gemini Vision → Qwen → Tesseract |
| **System Stability** | Prone to downtime | **Zero Downtime Architecture** |

---

## 🌟 Deep Dive: Version 2.0 Enhancements

### 1️⃣ Infinite Quota Engine (Dynamic Key Rotator)

Free-tier API limits are a major bottleneck in real-world systems.

**Solution:**
- Multi-project API key pooling
- Automatic key rotation on `429` errors

**Outcome:**
- ✅ No service interruption  
- ✅ Seamless scaling  
- ✅ Consistent user experience  

---

### 2️⃣ 3-Tier Fault-Tolerant AI Waterfall

Cloud AI services can fail due to latency, outages, or rate limits.

**Architecture:**

Tier 1 → Gemini 2.5 Flash (Primary)
Tier 2 → DeepSeek-R1 (Fallback via OpenRouter)
Tier 3 → Llama 3.1 (Emergency Backup)


**Key Insight:**
> If one model fails, another takes over instantly — ensuring continuous operation.

---

### 3️⃣ Zero-Day Threat Intelligence

Traditional systems fail against newly generated phishing links.

**Our Approach:**

**Layer 1 – Global Verification**
- Uses Google Web Risk API  
- Detects known malicious URLs instantly  

**Layer 2 – AI Heuristic Analysis**
- Detects:
  - Domain spoofing (`amaz0n`)
  - Suspicious TLDs (`.xyz`)
  - Hidden attack paths (`/login.html`)

**Result:**
> Detects threats even when global databases report "clean"

---

### 4️⃣ Vision + OCR Threat Pipeline

Modern attacks often hide malicious content inside images.

**Pipeline Flow:**

Image Input
↓
Jimp Optimization (contrast + scaling)
↓
Gemini Vision (Primary)
↓
Qwen Vision (Fallback)
↓
Tesseract.js (Offline Backup)


**Capabilities:**
- Extracts faint or hidden text  
- Works even during cloud failures  
- Detects:
  - Fake payment screenshots  
  - Image-based phishing scams  

---

## ⚙️ Tech Stack (V2.0)

### 🎨 Frontend
- HTML, Tailwind CSS, JavaScript  
- Dynamic UI Telemetry  
  - Threat Score (0–100)  
  - Active AI Engine Indicator  

---

### ⚙️ Backend
- Node.js, Express.js  
- Rate Limiting (Binary Beasts Firewall)  
- Distributed API Key Load Balancing  

---

### 🧠 AI & APIs
- Google Gemini (Text + Vision)  
- OpenRouter (DeepSeek, Llama, Qwen)  
- Google Web Risk API  

---

### 🔍 Image Processing
- Jimp (Pre-processing & enhancement)  
- Tesseract.js (Offline OCR fallback)  

---

## 🔑 Local Setup (V2.0)

To run Version 2.0 locally, configure your `.env` file:

```env
PORT=3000

# 🚀 Multi-Project Key Array (no spaces)
GEMINI_KEYS=AIzaSyKeyOne,AIzaSyKeyTwo,AIzaSyKeyThree

# Backup + External APIs
GEMINI_API_KEY=AIzaSyBackupKey
OPENROUTER_API_KEY=your_openrouter_api_key
GOOGLE_WEB_RISK_API_KEY=your_web_risk_api_key
🧠 Key Takeaway

Binary Beasts v2.0 is not just an AI-powered scanner —
it is a resilient, distributed threat intelligence system designed to operate reliably under real-world constraints.



---

## 🚀 Version 2.1.0 Update: The "Enterprise SOC" Patch
*Status: Final GDG Hackathon Production Build*

This version transitions the Binary Beasts engine from a standard detector to a high-availability **Security Operations Center (SOC)** pipeline. We have refined the vocabulary and architecture to meet enterprise-grade technical standards.

### 🧠 1. High-Availability Multi-Model Fallback (Waterfall Architecture)
To eliminate single points of failure, we implemented a 3-tier fallback system:
- **Primary:** Google Gemini 2.5 Flash (Advanced Semantic Reasoning)
- **Secondary:** DeepSeek-R1 (Linguistic Heuristic Fallback)
- **Tertiary:** Meta Llama 3.1 (High-Speed Localized Reasoning)
*Ensures resilient threat analysis even during API rate-limiting or provider outages.*

### 🛡️ 2. Heuristic "Unknown Threat" Detection
We moved beyond simple blacklists. The engine now performs **Semantic Deception Analysis** to catch previously unseen (Zero-Day) phishing tactics:
- **Subdomain Spoofing Detection:** Identifies malicious structures like `google.com.evil.xyz`.
- **Infrastructure Risk Scoring:** Automatically flags notorious Top-Level Domains (`.xyz`, `.top`, `.click`) frequently used by threat actors.
- **BEC (Business Email Compromise) Heuristics:** Detects linkless credential harvesting by identifying requests for OTPs, Passwords, or Wire Transfers.

### 📄 3. Robust OCR Pipeline for Mobile Screenshots
Optimized for real-world security scenarios:
- **Jimp Pre-Processing:** Aggressive "Darken & Stretch" pipeline to increase contrast for faint or low-quality mobile text.
- **Vision Fallback:** Cascading extraction from Gemini Vision to Qwen-2-VL to local Tesseract engines.

### 📊 4. Explainable AI (XAI) & SOC Telemetry
- **XAI Architecture:** The engine provides a clinical summary of *why* a message was flagged, mapping linguistic patterns to specific threat categories.
- **Persistent Telemetry:** Real-time **Chart.js** dashboard tracking "Global Threat Data" via LocalStorage. Security metrics survive page refreshes, providing a continuous monitoring experience.

### 🛡️ 5. Hardened Security Layer
- **Strict Hostname-Validation Whitelist:** A zero-trust domain filter for verified enterprise services.
- **Full XSS Neutralization:** All AI-generated outputs pass through a multi-stage HTML escaping filter to prevent prompt injection or UI-based attacks.
- **Node.js Native Fetch Integration:** Modernized backend for high-performance network requests.

---
**🦾 Binary Beasts: Detect the Invisible. Block the Impossible.**

## 👨‍💻 Team

**BINARY BEASTS <<0101>>**
Arya College of Engineering & Information Technology

* **Ankit Kumar**
  🔗 https://www.linkedin.com/in/kr-ankit18

* **Abhishek Kumar**
  🔗 https://linkedin.com/in/abhishek-kumar-aceit

* **Lakshya Anand**
  🔗 https://linkedin.com/in/lakshya-anand121

* **Adarsh Kumar**
  🔗 https://linkedin.com/in/adarsh-mehta-aceit

---
