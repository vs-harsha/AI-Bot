# 🤖 AI Chatbot

A free AI chatbot built with **Flask** + **Groq API** (LLaMA 3.3 70B). Features real-time streaming responses, markdown rendering, syntax highlighting, and a clean dark UI.

## Features
- ⚡ Streaming responses (word-by-word)
- 📝 Markdown + code syntax highlighting
- 🎛️ Customizable system prompt
- 💬 Full conversation history
- 🆓 100% free (Groq free tier: 14,400 req/day)

## Setup

### 1. Clone the repo
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

### 2. Create virtual environment
```bash
python -m venv .venv
.venv\Scripts\Activate.ps1   # Windows
# source .venv/bin/activate  # Mac/Linux
```

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. Add your free API key
- Get a free key at [https://console.groq.com](https://console.groq.com)
- Copy `.env.example` to `.env`
- Add your key:
```
GROQ_API_KEY=your_key_here
```

### 5. Run
```bash
python app.py
```
Open [http://localhost:5000](http://localhost:5000)

## Tech Stack
| Layer    | Technology               |
|----------|--------------------------|
| Backend  | Python, Flask            |
| AI Model | LLaMA 3.3 70B via Groq   |
| Frontend | HTML, CSS, JavaScript    |
| Streaming| Server-Sent Events (SSE) |
