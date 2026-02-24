import os
from flask import Flask, render_template, request, jsonify
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

SYSTEM_PROMPT = """You are a helpful, friendly and intelligent AI assistant. 
Answer questions clearly and concisely. If you don't know something, say so honestly."""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json()
    messages = data.get("messages", [])
    system_prompt = data.get("system_prompt", SYSTEM_PROMPT)

    # Prepend system message
    full_messages = [{"role": "system", "content": system_prompt}] + messages

    try:
        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=full_messages,
            stream=False,
            max_tokens=2048,
            temperature=0.7,
        )
        content = completion.choices[0].message.content
        return jsonify({"content": content})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
