import os
import json
from flask import Flask, render_template, request, Response, stream_with_context, jsonify
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

    def generate():
        try:
            completion = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=full_messages,
                stream=True,
                max_tokens=2048,
                temperature=0.7,
            )
            for chunk in completion:
                content = chunk.choices[0].delta.content
                if content:
                    yield f"data: {json.dumps({'content': content})}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            yield "data: [DONE]\n\n"

    return Response(
        stream_with_context(generate()),
        content_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=False, host="0.0.0.0", port=port)
