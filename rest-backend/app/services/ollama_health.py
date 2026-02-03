import os
from dotenv import load_dotenv

from app.services.ollama_client import get_ollama_client

load_dotenv()

CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "gemma3:latest").strip()


def test_ollama() -> None:
    """
    Sends a quick test message to Ollama to confirm:
    - Server is reachable
    - Model name is valid / available
    """
    client = get_ollama_client()

    resp = client.chat(
        model=CHAT_MODEL,
        messages=[{"role": "user", "content": "Reply with exactly: pong"}],
    )

    content = (resp.get("message", {}) or {}).get("content", "").strip().lower()

    if "pong" not in content:
        # Not fatal in theory, but for your check you asked "all before allowing API"
        raise RuntimeError(f"❌ Ollama responded unexpectedly: {content!r}")

    print(f"✅ Ollama OK ({CHAT_MODEL}) 🤖")
