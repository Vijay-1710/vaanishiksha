"""Probe the local Omniroute gateway to discover which providers/models are usable with the configured key."""
import httpx
import os
from pathlib import Path
from dotenv import load_dotenv

# Load root .env (project root is two levels up from scripts/)
_ROOT = Path(__file__).resolve().parent.parent.parent
load_dotenv(_ROOT / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

BASE = "http://localhost:20128"
KEY = os.getenv("GEMINI_API_KEY")

MODELS_TO_TRY = [
    "auto/best-chat",
    "auto/chat",
    "auto/best-fast",
    "auto/fast",
    "auto/smart",
    "auto/best-free",
    "auto/best-reasoning",
    "auto/gemini",
    "auto/claude-sonnet",
]


def try_chat(model: str) -> str:
    url = f"{BASE}/v1/chat/completions"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {KEY}"}
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": "Say hi in one word."}],
        "max_tokens": 10,
    }
    try:
        r = httpx.post(url, headers=headers, json=payload, timeout=30)
        if r.status_code == 200:
            return f"OK: {r.json()['choices'][0]['message']['content']!r}"
        body = r.text[:200]
        return f"HTTP {r.status_code}: {body}"
    except Exception as e:
        return f"ERR: {e}"


def main():
    if not KEY:
        print("No GEMINI_API_KEY in .env")
        return
    print(f"Key prefix: {KEY[:12]}... (length {len(KEY)})")
    print("Probing /v1/models with key...")
    try:
        r = httpx.get(f"{BASE}/v1/models", headers={"Authorization": f"Bearer {KEY}"}, timeout=15)
        print(f"GET /v1/models -> HTTP {r.status_code}")
        if r.status_code == 200:
            data = r.json()
            models = data.get("data", data)
            print("Models:", [m.get("id") if isinstance(m, dict) else m for m in models][:40])
        else:
            print(r.text[:300])
    except Exception as e:
        print(f"ERR: {e}")

    print("\nChat-completion probe (which providers are active for this key?):")
    for model in MODELS_TO_TRY:
        print(f"  {model:28s} -> {try_chat(model)}")


if __name__ == "__main__":
    main()