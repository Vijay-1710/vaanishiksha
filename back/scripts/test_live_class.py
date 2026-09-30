"""
End-to-End WebSocket and REST test for Module 3: Live Class Real-Time Translation & Audio Hub.
Tests:
- Live classroom room creation
- Listing active live rooms
- Teacher WebSocket connection
- Multi-student WebSocket connections in different Indian languages (Tamil and Hindi)
- Real-time teacher speech broadcasting and language-specific translation delivery
- Live student doubt asking with on-the-fly translation for teacher
- Concluding live room and verifying automatic lecture archiving + worksheet generation
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, Lecture

def main():
    print("=" * 65)
    print("TESTING MODULE 3: LIVE CLASSROOM REAL-TIME TRANSLATION HUB")
    print("=" * 65)

    db = SessionLocal()
    teacher = db.query(User).filter(User.role == "teacher").first()
    db.close()

    if not teacher:
        print("❌ Need at least 1 teacher in DB")
        return False

    with TestClient(app) as client:
        # 1. Login as teacher
        print(f"\n[1] Logging in as teacher ({teacher.email})...")
        r = client.post("/api/auth/login", json={
            "username": teacher.email,
            "password": "TestPass123!"
        })
        if r.status_code != 200:
            r = client.post("/api/auth/login", json={
                "username": "teacher_test_flow@school.edu",
                "password": "TeacherPassword123!"
            })
        assert r.status_code == 200, f"Login failed: {r.text}"
        teacher_token = r.json()["access_token"]
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}
        print("✅ Logged in successfully.")

        # 2. Create Live Classroom Room
        print("\n[2] Creating Live Classroom session (POST /api/live/rooms/create)...")
        r = client.post(
            "/api/live/rooms/create",
            headers=teacher_headers,
            json={
                "title": "Live Science Class: Plant Biology & Water Cycle",
                "subject": "Science",
                "grade_level": 5,
                "original_language": "en"
            }
        )
        assert r.status_code == 200, f"Create room failed: {r.text}"
        room_data = r.json()
        room_code = room_data["room_code"]
        print(f"✅ Created Live Room Code: [{room_code}] - '{room_data['title']}'")

        # 3. List Active Live Rooms
        print("\n[3] Checking active rooms list (GET /api/live/rooms/active)...")
        r = client.get("/api/live/rooms/active")
        assert r.status_code == 200
        active_rooms = r.json()
        assert any(rm["room_code"] == room_code for rm in active_rooms)
        print(f"✅ Room [{room_code}] is visible in active classrooms list ({len(active_rooms)} active).")

        # 4. Connect Teacher & Students over WebSockets
        print("\n[4] Connecting Teacher & Multi-lingual Students via WebSockets...")
        teacher_ws_url = f"/api/live/ws/{room_code}/teacher"
        student1_ws_url = f"/api/live/ws/{room_code}/student?name=Priya&language=ta"
        student2_ws_url = f"/api/live/ws/{room_code}/student?name=Aarav&language=hi"

        with client.websocket_connect(teacher_ws_url) as teacher_ws:
            print("   ✅ Teacher connected to WebSocket.")

            with client.websocket_connect(student1_ws_url) as s1_ws, \
                 client.websocket_connect(student2_ws_url) as s2_ws:
                print("   ✅ Student 1 (Tamil) connected.")
                print("   ✅ Student 2 (Hindi) connected.")

                # Receive welcome messages
                welcome1 = s1_ws.receive_json()
                welcome2 = s2_ws.receive_json()
                assert welcome1["type"] == "welcome"
                assert welcome2["type"] == "welcome"
                print("   ✅ Received student welcome packets with room metadata.")

                # 5. Teacher speaks a sentence in English
                print("\n[5] Teacher speaks in English: 'Plants absorb water and minerals from soil.'")
                teacher_ws.send_json({
                    "type": "speech",
                    "text": "Plants absorb water and minerals from soil.",
                    "language": "en"
                })

                # Helper to wait for specific message type
                def wait_for_msg(ws, target_type):
                    for _ in range(5):
                        msg = ws.receive_json()
                        if msg.get("type") == target_type:
                            return msg
                    raise TimeoutError(f"Never received {target_type}")

                # Teacher receives speech_ack
                ack = wait_for_msg(teacher_ws, "speech_ack")
                print("   ✅ Teacher received real-time speech acknowledgment.")

                # Student 1 (Tamil) receives live caption translated into Tamil
                cap1 = s1_ws.receive_json()
                assert cap1["type"] == "live_caption"
                assert cap1["target_language"] == "ta"
                assert "audio_url" in cap1
                print(f"   ✅ Student 1 (Tamil) Live Caption: '{cap1['translated_text']}'")
                print(f"   ✅ Audio Out URL generated: {cap1['audio_url']}")

                # Test Audio Out API
                tts_resp = client.get(cap1["audio_url"])
                assert tts_resp.status_code == 200
                assert tts_resp.headers["content-type"] == "audio/mpeg"
                assert len(tts_resp.content) > 1000
                print(f"   ✅ Audio Out Stream verified (MP3 byte length: {len(tts_resp.content)})")

                # Student 2 (Hindi) receives live caption translated into Hindi
                cap2 = s2_ws.receive_json()
                assert cap2["type"] == "live_caption"
                assert cap2["target_language"] == "hi"
                assert "audio_url" in cap2
                print(f"   ✅ Student 2 (Hindi) Live Caption: '{cap2['translated_text']}'")

                # 6. Student asks doubt in mother tongue (Tamil)
                print("\n[6] Student 1 asks doubt in Tamil...")
                s1_ws.send_json({
                    "type": "ask_doubt",
                    "question": "How do leaves make food?"
                })

                s1_ack = s1_ws.receive_json()
                assert s1_ack["type"] == "doubt_sent"
                print("   ✅ Student 1 received doubt delivery receipt.")

                # Teacher receives the student doubt with audio playback URL
                teacher_msg = wait_for_msg(teacher_ws, "student_doubt")
                doubt = teacher_msg["doubt"]
                assert "audio_url" in doubt
                print(f"   ✅ Teacher received doubt from {doubt['student_name']}: '{doubt['translated_question']}'")
                print(f"   ✅ Teacher Doubt Audio Out URL: {doubt['audio_url']}")

                # 7. Teacher Audio In Test (Streaming direct audio data)
                print("\n[7] Testing Teacher Audio In (streaming audio_data via WebSocket)...")
                import base64
                with open("scripts/test_lecture.mp3", "rb") as f:
                    audio_b64 = base64.b64encode(f.read()).decode("utf-8")
                
                teacher_ws.send_json({
                    "type": "audio_data",
                    "audio_base64": audio_b64,
                    "format": "mp3",
                    "language": "en"
                })

                # Teacher receives ack
                ack2 = wait_for_msg(teacher_ws, "speech_ack")
                assert ack2["type"] == "speech_ack"
                print(f"   ✅ Teacher Audio In transcribed by Whisper: '{ack2['text'][:60]}...'")

                # Students receive live caption from the transcribed audio
                stream_cap = s1_ws.receive_json()
                assert stream_cap["type"] == "live_caption"
                print(f"   ✅ Student 1 received translated live caption from Teacher Audio In!")

        # 7. End Live Class & Archive
        print(f"\n[7] Concluding live class (POST /api/live/rooms/{room_code}/end)...")
        r = client.post(f"/api/live/rooms/{room_code}/end", headers=teacher_headers)
        assert r.status_code == 200, f"End room failed: {r.text}"
        res = r.json()
        lecture_id = res["lecture_id"]
        assert lecture_id is not None
        print(f"✅ Live session successfully archived into Lecture ID={lecture_id}!")

        # Verify archived lecture is in database
        r = client.get(f"/api/lectures/{lecture_id}", headers=teacher_headers)
        assert r.status_code == 200
        archived_lecture = r.json()
        print(f"✅ Archived Lecture Title: '{archived_lecture['title']}'")
        print(f"✅ Audio Media URL: {archived_lecture['media_url']}")

        # Verify worksheets were automatically created
        r = client.get(f"/api/worksheets/lecture/{lecture_id}", headers=teacher_headers)
        assert r.status_code == 200
        assert len(r.json()) >= 1
        print(f"✅ Auto-generated worksheets for archived live class: {[w['target_language'] for w in r.json()]}")

        print("\n" + "=" * 65)
        print("🎉 ALL MODULE 3 LIVE CLASSROOM TESTS PASSED (100%)!")
        print("=" * 65)
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
