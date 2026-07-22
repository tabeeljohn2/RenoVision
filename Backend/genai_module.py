
import os
import requests
from dotenv import load_dotenv

load_dotenv()

KAGGLE_BACKEND_URL = os.getenv("KAGGLE_BACKEND_URL", "").rstrip("/")


def generate_room_image(
    room_type,
    style,
    budget=None,
    recommendations=None,
    user_prompt="",
    detected_furniture=None,
    dimensions=None,
) -> dict:
    """
    Sends generation params to Kaggle GPU backend for SD+LoRA inference.
    Returns the exact same dict shape that main.py already expects
    (success, image_base64, prompt_used, format, model_used, error).
    """
    if not KAGGLE_BACKEND_URL:
        return _error("KAGGLE_BACKEND_URL not set in .env — "
                      "add: KAGGLE_BACKEND_URL=https://xxxx.trycloudflare.com")

    payload = {
        "room_type":           room_type,
        "style":               style,
        "budget":              budget,
        "recommendations":     recommendations or [],
        "user_prompt":         user_prompt or "",
        "detected_furniture":  detected_furniture or [],
        "dimensions":          dimensions,
    }

    try:
        print(f"📡 GenAI → Kaggle GPU: {KAGGLE_BACKEND_URL}/genai-generate")

        resp = requests.post(
            f"{KAGGLE_BACKEND_URL}/genai-generate",
            json=payload,
            timeout=180,   # SD 30-step on T4 takes ~20-40s, give headroom
        )

        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ Image received from Kaggle GPU — model: {data.get('model_used', '?')}")
            return data

        return _error(f"Kaggle returned HTTP {resp.status_code}: {resp.text[:200]}")

    except requests.exceptions.ConnectionError:
        return _error(
            f"Cannot reach Kaggle at {KAGGLE_BACKEND_URL}. "
            "Check: notebook running? tunnel active? URL correct in .env?"
        )
    except requests.exceptions.Timeout:
        return _error("Kaggle GenAI request timed out (180s). GPU may be busy — try again.")
    except Exception as e:
        return _error(str(e))


def _error(msg: str) -> dict:
    print(f"❌ genai_module (proxy): {msg}")
    return {
        "success":      False,
        "error":        msg,
        "image_base64": None,
        "prompt_used":  None,
        "format":       None,
        "model_used":   None,
    }