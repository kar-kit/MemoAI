import os
from ollama import Client


def get_ollama_client() -> Client:
    """
    Creates an Ollama client pointing at your remote Ollama server.

    Env:
      OLLAMA_HOST=https://ollamaps.jp-homelab.work
    """
    host = os.getenv("OLLAMA_HOST", "http://localhost:11434").strip()

    # Basic guardrail: avoid accidental trailing slash issues
    if host.endswith("/"):
        host = host[:-1]

    return Client(host=host)
