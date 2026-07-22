# cv_module.py  — LOCAL PROJECT (runs on your laptop inside main.py)


import os
import requests
from dotenv import load_dotenv

load_dotenv()

KAGGLE_BACKEND_URL = os.getenv("KAGGLE_BACKEND_URL", "").rstrip("/")


def analyze_room_image(image_path: str) -> dict:
    """
    Sends image to Kaggle GPU backend for YOLO inference.
    Returns the exact same dict shape that main.py already expects.
    """
    if not KAGGLE_BACKEND_URL:
        return _error("KAGGLE_BACKEND_URL not set in .env — "
                      "add: KAGGLE_BACKEND_URL=https://xxxx.trycloudflare.com")

    try:
        print(f"📡 CV → Kaggle GPU: {KAGGLE_BACKEND_URL}/cv-analyze")

        ext  = image_path.rsplit(".", 1)[-1].lower()
        mime = "image/png" if ext == "png" else "image/jpeg"

        with open(image_path, "rb") as f:
            resp = requests.post(
                f"{KAGGLE_BACKEND_URL}/cv-analyze",
                files={"file": (os.path.basename(image_path), f, mime)},
                timeout=60,
            )

        print(f"🔍 Kaggle status code: {resp.status_code}")
        print(f"🔍 Kaggle raw response: {resp.text[:500]}")

        if resp.status_code == 200:
            data = resp.json()
            print(f"✅ CV done on Kaggle GPU — room: {data.get('room_type', '?')}")
            print(f"🔍 is_outdoor in response: {data.get('is_outdoor', 'KEY MISSING')}")
            return data

        # Handle outdoor rejection from Kaggle
        if resp.status_code == 400:
            try:
                err = resp.json()
                print(f"🔍 400 error body: {err}")
                if err.get("error") == "outdoor_scene":
                    print("🌿 Outdoor image rejected by Kaggle")
                    return {
                        "success":              False,
                        "is_outdoor":           True,
                        "error":                "outdoor_scene",
                        "message":              err.get("message", "Outdoor scene detected. Please upload an indoor room photo."),
                        "room_type":            "outdoor",
                        "detected_furniture":   [],
                        "dominant_colors":      [],
                        "room_density":         "unknown",
                        "furniture_count":      0,
                        "dimensions":           None,
                        "all_detected_objects": [],
                    }
            except Exception as parse_err:
                print(f"🔍 Failed to parse 400 response: {parse_err}")

        return _error(f"Kaggle returned HTTP {resp.status_code}: {resp.text[:200]}")

    except requests.exceptions.ConnectionError:
        return _error(
            f"Cannot reach Kaggle at {KAGGLE_BACKEND_URL}. "
            "Check: notebook running? tunnel active? URL correct in .env?"
        )
    except requests.exceptions.Timeout:
        return _error("Kaggle CV request timed out (60s). Try again.")
    except FileNotFoundError:
        return _error(f"Image file not found: {image_path}")
    except Exception as e:
        return _error(str(e))


def _error(msg: str) -> dict:
    print(f"❌ cv_module (proxy): {msg}")
    return {
        "success":             False,
        "is_outdoor":          False,
        "error":               msg,
        "room_type":           "unknown",
        "detected_furniture":  [],
        "dominant_colors":     [],
        "room_density":        "unknown",
        "furniture_count":     0,
        "dimensions":          None,
        "all_detected_objects": [],
    }