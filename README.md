# 🛡️ Binary Beasts: AI Phishing Detector

An advanced AI-powered cybersecurity system that detects phishing attacks and social engineering scams in real time across both text and images.

---

## 🚀 Live Demo

🔗 https://binary-beasts-imqc.onrender.com

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
