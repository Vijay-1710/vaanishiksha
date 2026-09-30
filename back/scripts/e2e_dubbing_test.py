"""
End-to-end dubbing pipeline test.

Exercises the REAL full stack:
- Register/login (JWT auth)
- Upload a real lecture audio file
- Request dubbing into 3 target languages
- Poll Celery job status until completed/failed
- Verify: transcript, translated transcript (script sanity), dubbed audio (download + size)

Run with the backend venv from the backend/ directory:
    ..\\venv\\Scripts\\python.exe scripts\\e2e_dubbing_test.py
"""
import sys
import time
import re
import httpx
from datetime import datetime

API_BASE = "http://localhost:8000"
LECTURE_FILE = "scripts/test_lecture.mp3"

# Unicode ranges for script sanity checking
SCRIPTS = {
    "hi": (0x0900, 0x097F, "Devanagari"),
    "ta": (0x0B80, 0x0BFF, "Tamil"),
    "te": (0x0C00, 0x0C7F, "Telugu"),
    "kn": (0x0C80, 0x0CFF, "Kannada"),
    "bn": (0x0980, 0x09FF, "Bengali"),
}

TARGETS = ["hi", "ta", "kn"]  # one high-resource + two lower-resource


def check_script(text: str, lang: str) -> tuple:
    """Return (match_count, total_letters, script_name)."""
    lo, hi, name = SCRIPTS[lang]
    letters = [c for c in text if c.isalpha()]
    matches = [c for c in letters if lo <= ord(c) <= hi]
    return len(matches), len(letters), name


def main():
    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    teacher_email = f"teacher_{stamp}@test.edu"
    student_email = f"student_{stamp}@test.edu"

    print("=" * 70)
    print("END-TO-END DUBBING PIPELINE TEST")
    print("=" * 70)

    with httpx.Client(base_url=API_BASE, timeout=120.0) as client:
        # --- 1. Register + login teacher ---
        r = client.post("/api/auth/register", json={
            "email": teacher_email, "password": "TestPass123!",
            "full_name": "Test Teacher", "role": "teacher",
        })
        r.raise_for_status()
        print(f"[1] Teacher registered: {teacher_email}")

        r = client.post("/api/auth/login", data={
            "username": teacher_email, "password": "TestPass123!",
        })
        r.raise_for_status()
        teacher_token = r.json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        print("[2] Teacher logged in (JWT OK)")

        # --- 2. Register + login student ---
        r = client.post("/api/auth/register", json={
            "email": student_email, "password": "TestPass123!",
            "full_name": "Test Student", "role": "student",
            "preferred_language": "hi", "grade_level": 5,
        })
        r.raise_for_status()
        r = client.post("/api/auth/login", data={
            "username": student_email, "password": "TestPass123!",
        })
        r.raise_for_status()
        student_token = r.json()["access_token"]
        student_headers = {"Authorization": f"Bearer {student_token}"}
        print("[3] Student registered + logged in")

        # --- 3. Upload lecture ---
        with open(LECTURE_FILE, "rb") as f:
            r = client.post(
                "/api/lectures/upload",
                headers=teacher_headers,
                data={
                    "title": "The Solar System",
                    "description": "An introduction to the solar system for class 5",
                    "subject": "Science",
                    "grade_level": "5",
                    "original_language": "en",
                },
                files={"file": ("solar_system.mp3", f, "audio/mpeg")},
            )
        r.raise_for_status()
        lecture = r.json()
        lecture_id = lecture["id"]
        print(f"[4] Lecture uploaded (id={lecture_id}, title={lecture['title']})")

        # --- 4. Request dubs for each target language ---
        results = {}
        for lang in TARGETS:
            r = client.post(
                f"/api/lectures/{lecture_id}/dub/{lang}",
                headers=student_headers,
            )
            r.raise_for_status()
            body = r.json()
            print(f"[5.{lang}] Dub requested -> status={body['status']} (id={body['id']})")
            results[lang] = {"dub_id": body["id"]}

        # --- 5. Poll until all complete (max 15 min) ---
        deadline = time.time() + 15 * 60
        pending = set(TARGETS)
        while pending and time.time() < deadline:
            time.sleep(8)
            for lang in list(pending):
                r = client.get(
                    f"/api/lectures/{lecture_id}/dub/{lang}/status",
                    headers=student_headers,
                )
                r.raise_for_status()
                body = r.json()
                results[lang].update(body)
                if body["status"] in ("completed", "failed"):
                    pending.discard(lang)
                    print(
                        f"[6.{lang}] Status -> {body['status']} "
                        f"(audio_url={'yes' if body.get('dubbed_audio_url') else 'no'}, "
                        f"transcript_url={'yes' if body.get('transcript_url') else 'no'})"
                    )

        if pending:
            print(f"FAIL: timed out waiting for: {pending}")
            sys.exit(1)

        # --- 6. Verify outputs ---
        print("\n--- VERIFICATION ---")
        all_ok = True

        for lang in TARGETS:
            res = results[lang]
            ok = True
            print(f"\n[{lang}] ")
            if res.get("status") != "completed":
                print(f"  X status = {res['status']} (expected completed)")
                all_ok = False
                continue

            # dubbed audio
            audio_url = res.get("dubbed_audio_url")
            if not audio_url:
                print("  X no dubbed audio URL")
                all_ok = False
            else:
                r = client.get(audio_url)
                if r.status_code != 200 or len(r.content) < 1024:
                    print(f"  X dubbed audio download failed (status={r.status_code}, size={len(r.content)})")
                    all_ok = False
                else:
                    print(f"  OK dubbed audio downloaded ({len(r.content)} bytes)")

            # translated transcript + script sanity
            trans_url = res.get("transcript_url")
            if not trans_url:
                print("  X no translated transcript URL")
                all_ok = False
            else:
                r = client.get(trans_url)
                text = r.text.strip()
                matched, total, script_name = check_script(text, lang)
                print(f"  OK transcript ({len(text)} chars, {matched}/{total} letters in {script_name} script)")
                if total > 0 and matched / total < 0.3:
                    print(f"  X script mismatch: expected {script_name}, only {matched}/{total} letters matched")
                    print(f"    sample: {text[:160]!r}")
                    all_ok = False

        # source transcript present?
        r = client.get(f"/api/lectures/{lecture_id}", headers=student_headers)
        lecture_info = r.json()
        print(f"\nSource transcript present: {'yes' if lecture_info.get('has_transcript') else 'NO'}")
        print(f"Available languages: {lecture_info.get('available_languages')}")
        if not lecture_info.get("has_transcript"):
            all_ok = False

        print("\n" + "=" * 70)
        if all_ok:
            print("RESULT: PASS — full dubbing pipeline works end-to-end")
        else:
            print("RESULT: FAIL — see errors above")
        print("=" * 70)
        sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()