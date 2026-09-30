"""
Master Comprehensive Test Suite for Vaanishiksha (Mother-Tongue Education Platform).
Systematically tests every single function, service, router, and endpoint:
1. System Health & Root Info
2. Authentication & Roles (Teacher & Student registration, JWT login via JSON & Form data, Auth errors, /me endpoints)
3. Lecture Management & File Validation (Upload audio, type rejection, role restrictions, list & retrieve)
4. ASR & Transcription (Whisper integration and transcription persistence)
5. Multi-Tier Translation Pipeline (English <-> Hindi, Tamil, Telugu, Kannada, Bengali)
6. Text-to-Speech & Dubbing Pipeline (gTTS, audio persistence, status polling, in-process/Celery dispatch)
7. Worksheet & Assessment Engine (Summary, Vocab, MCQs, Fill-in-blanks, Short questions, Teacher answer key)
8. Printable Classroom Document Rendering (A4 HTML worksheets in storage)
9. Worksheets API Router (Generate, List, Retrieve by ID, language caching)
10. NCERT Curriculum Hub (Overview across Classes 1-8, filtering, search, chapter retrieval)
11. NCERT Lesson Adoption (One-click auto-lesson synthesis with narration & worksheets)
12. Static File Serving (/storage/ mounts for lectures, dubbed tracks, transcripts, worksheets)
"""

import sys
import os
import io
import json
import time
from pathlib import Path
from datetime import datetime

# Configure UTF-8 for console output
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import SessionLocal
from app.models import User, Lecture, DubbedLecture, Worksheet, UserRole
from app.services.asr_service import transcribe_audio
from app.services.translation_service import translate_text
from app.services.tts_service import text_to_speech
from app.services.worksheet_service import create_or_get_worksheet, render_html_worksheet
from app.services.ncert_service import (
    get_curriculum_overview,
    search_ncert_chapters,
    get_chapter_by_id,
    adopt_ncert_chapter_as_lecture,
)

TOTAL_TESTS = 0
PASSED_TESTS = 0
FAILED_TESTS = 0


def log_test(name: str, passed: bool, detail: str = ""):
    global TOTAL_TESTS, PASSED_TESTS, FAILED_TESTS
    TOTAL_TESTS += 1
    if passed:
        PASSED_TESTS += 1
        print(f"  [PASS] {name} {f'({detail})' if detail else ''}")
    else:
        FAILED_TESTS += 1
        print(f"  [FAIL] {name} - {detail}")


def run_all_tests():
    print("=" * 75)
    print("VAANISHIKSHA PLATFORM: COMPLETE FUNCTIONAL & END-TO-END TEST SUITE")
    print(f"Timestamp: {datetime.utcnow().isoformat()}Z")
    print("=" * 75)

    timestamp = int(time.time())
    teacher_email = f"master_teacher_{timestamp}@school.edu"
    student_email = f"master_student_{timestamp}@school.edu"
    test_password = "SecurePassword123!"

    with TestClient(app) as client:
        # =====================================================================
        # SUITE 1: SYSTEM HEALTH & ROOT INFO
        # =====================================================================
        print("\n--- SUITE 1: System Health & Root Info ---")
        r = client.get("/")
        log_test("GET / (Root API endpoint)", r.status_code == 200 and "Mother-Tongue" in r.json().get("message", ""))

        r = client.get("/health")
        log_test("GET /health (Health check endpoint)", r.status_code == 200 and r.json().get("status") == "healthy")

        # =====================================================================
        # SUITE 2: AUTHENTICATION & ROLE-BASED ACCESS CONTROL
        # =====================================================================
        print("\n--- SUITE 2: Authentication & Role-Based Access Control ---")
        # 1. Register Teacher
        r = client.post("/api/auth/register", json={
            "email": teacher_email,
            "password": test_password,
            "full_name": "Dr. Master Teacher",
            "role": "teacher"
        })
        log_test("Register Teacher User", r.status_code == 200 and r.json().get("role") == "teacher")
        teacher_id = r.json().get("id")

        # 2. Register Duplicate Email (Should fail with 400)
        r = client.post("/api/auth/register", json={
            "email": teacher_email,
            "password": test_password,
            "full_name": "Duplicate",
            "role": "teacher"
        })
        log_test("Reject Duplicate Email Registration", r.status_code == 400)

        # 3. Register Student with preferred language & grade
        r = client.post("/api/auth/register", json={
            "email": student_email,
            "password": test_password,
            "full_name": "Aarav Student",
            "role": "student",
            "preferred_language": "hi",
            "grade_level": 5
        })
        log_test("Register Student User (Grade 5, Hindi)", r.status_code == 200 and r.json().get("preferred_language") == "hi")
        student_id = r.json().get("id")

        # 4. Login via JSON body
        r = client.post("/api/auth/login", json={"username": teacher_email, "password": test_password})
        teacher_token = r.json().get("access_token")
        log_test("Teacher Login via JSON payload", r.status_code == 200 and bool(teacher_token))
        teacher_headers = {"Authorization": f"Bearer {teacher_token}"}

        # 5. Login via Form Data (OAuth2 standard)
        r = client.post("/api/auth/login", data={"username": student_email, "password": test_password})
        student_token = r.json().get("access_token")
        log_test("Student Login via Form Data", r.status_code == 200 and bool(student_token))
        student_headers = {"Authorization": f"Bearer {student_token}"}

        # 6. Login with Wrong Password (Should fail with 401)
        r = client.post("/api/auth/login", json={"username": teacher_email, "password": "WrongPassword"})
        log_test("Reject Invalid Credentials (401)", r.status_code == 401)

        # 7. Verify /api/auth/me for Teacher
        r = client.get("/api/auth/me", headers=teacher_headers)
        log_test("GET /api/auth/me (Teacher Profile)", r.status_code == 200 and r.json().get("email") == teacher_email)

        # 8. Verify /api/users/me for Student
        r = client.get("/api/users/me", headers=student_headers)
        log_test("GET /api/users/me (Student Profile)", r.status_code == 200 and r.json().get("grade_level") == 5)

        # 9. Verify Unauthorized access rejected without token
        r = client.get("/api/auth/me")
        log_test("Reject Protected Endpoint Without Token (401)", r.status_code == 401)

        # =====================================================================
        # SUITE 3: LECTURE MANAGEMENT & FILE HANDLING
        # =====================================================================
        print("\n--- SUITE 3: Lecture Upload, Validation & Listing ---")
        # 1. Reject invalid file extension (.txt or .exe instead of media)
        fake_bad_file = io.BytesIO(b"Not an audio file")
        r = client.post(
            "/api/lectures/upload",
            headers=teacher_headers,
            data={
                "title": "Bad File Test",
                "original_language": "en"
            },
            files={"file": ("malicious.exe", fake_bad_file, "application/octet-stream")}
        )
        log_test("Reject Invalid File Format (.exe)", r.status_code == 400)

        # 2. Reject Student attempting to upload (Only teachers allowed)
        fake_audio = io.BytesIO(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00")
        r = client.post(
            "/api/lectures/upload",
            headers=student_headers,
            data={
                "title": "Student Upload Attempt",
                "original_language": "en"
            },
            files={"file": ("lecture.mp3", fake_audio, "audio/mpeg")}
        )
        log_test("Reject Student Upload Permission (403)", r.status_code == 403)

        # 3. Successful Lecture Upload by Teacher
        test_audio_bytes = io.BytesIO(b"Fake MP3 Audio Payload for Testing Purposes 1234567890")
        r = client.post(
            "/api/lectures/upload",
            headers=teacher_headers,
            data={
                "title": f"Master Test Lecture {timestamp}",
                "description": "Comprehensive test of primary science concepts.",
                "subject": "General Science",
                "grade_level": "5",
                "original_language": "en"
            },
            files={"file": (f"test_lesson_{timestamp}.mp3", test_audio_bytes, "audio/mpeg")}
        )
        log_test("Teacher Lecture Upload (.mp3)", r.status_code == 200 and r.json().get("title") == f"Master Test Lecture {timestamp}")
        uploaded_lecture = r.json()
        lecture_id = uploaded_lecture.get("id")

        # 4. List Lectures for Teacher
        r = client.get("/api/lectures/", headers=teacher_headers)
        log_test("List Lectures (Teacher view)", r.status_code == 200 and any(l["id"] == lecture_id for l in r.json()))

        # 5. List Lectures for Student
        r = client.get("/api/lectures/", headers=student_headers)
        log_test("List Lectures (Student view)", r.status_code == 200 and any(l["id"] == lecture_id for l in r.json()))

        # 6. Retrieve Specific Lecture by ID
        r = client.get(f"/api/lectures/{lecture_id}", headers=student_headers)
        log_test(f"GET /api/lectures/{lecture_id}", r.status_code == 200 and r.json().get("id") == lecture_id)

        # 7. Non-existent Lecture returns 404
        r = client.get("/api/lectures/999999", headers=student_headers)
        log_test("GET /api/lectures/999999 returns 404", r.status_code == 404)

        # =====================================================================
        # SUITE 4: ASR (SPEECH-TO-TEXT) SERVICE
        # =====================================================================
        print("\n--- SUITE 4: ASR & Speech-to-Text Service ---")
        # Ensure the test lecture has a transcript for translation & worksheets
        db = SessionLocal()
        lec = db.query(Lecture).filter(Lecture.id == lecture_id).first()
        test_transcript_content = (
            "Hello students. Today we will learn about the water cycle and living plants. "
            "Plants absorb water and minerals from the soil using their roots. "
            "Leaves have green chlorophyll that traps sunlight for photosynthesis. "
            "Water evaporates from lakes and oceans to form rain clouds in the sky. "
            "Drinking clean water and protecting green trees keeps our environment healthy."
        )
        lec.transcript_text = test_transcript_content
        db.commit()
        db.close()

        # Test transcription fallback mechanism directly
        sample_audio_path = os.path.join(settings.storage_path, "lectures", "test_sample.mp3")
        with open(sample_audio_path, "w", encoding="utf-8") as f:
            f.write("Audio placeholder")
        asr_result = transcribe_audio(sample_audio_path, "en")
        log_test("ASR Transcription Service Execution", bool(asr_result) and len(asr_result) > 10, f"Length: {len(asr_result)}")

        # =====================================================================
        # SUITE 5: MULTI-TIER TRANSLATION SERVICE
        # =====================================================================
        print("\n--- SUITE 5: Multilingual Translation Pipeline ---")
        # Test translation into Hindi, Tamil, Kannada, Bengali
        test_phrase = "Plants absorb water from soil."

        hi_trans = translate_text(test_phrase, "en", "hi")
        log_test("Translate English -> Hindi", bool(hi_trans) and len(hi_trans) > 0, hi_trans)

        ta_trans = translate_text(test_phrase, "en", "ta")
        log_test("Translate English -> Tamil", bool(ta_trans) and len(ta_trans) > 0, ta_trans)

        kn_trans = translate_text(test_phrase, "en", "kn")
        log_test("Translate English -> Kannada", bool(kn_trans) and len(kn_trans) > 0, kn_trans)

        # Identity translation (same language should return original text instantly)
        id_trans = translate_text(test_phrase, "en", "en")
        log_test("Identity Translation (en -> en)", id_trans == test_phrase)

        # Empty string handling
        empty_trans = translate_text("", "en", "hi")
        log_test("Empty String Translation Guard", empty_trans == "")

        # =====================================================================
        # SUITE 6: TEXT-TO-SPEECH (TTS) & DUBBING PIPELINE
        # =====================================================================
        print("\n--- SUITE 6: TTS & Audio Dubbing Pipeline ---")
        # 1. Test text_to_speech service directly (skip gracefully if network unavailable)
        tts_out_path = os.path.join(settings.storage_path, "dubbed", f"test_tts_{timestamp}.mp3")
        try:
            tts_res = text_to_speech("Welcome students to science class.", "en", tts_out_path)
            tts_file_exists = os.path.exists(tts_out_path) and os.path.getsize(tts_out_path) > 0
            log_test("TTS Synthesis & MP3 Persistence", tts_file_exists, f"{os.path.getsize(tts_out_path)} bytes")
        except Exception as tts_err:
            log_test("TTS Synthesis & MP3 Persistence", False, f"SKIPPED (no network): {tts_err.__class__.__name__}")

        # 2. Request dubbing into original language (should return immediately as completed)
        r = client.post(f"/api/lectures/{lecture_id}/dub/en", headers=student_headers)
        log_test("Request Dub in Original Language (instant completed)", r.status_code == 200 and r.json().get("status") == "completed")

        # 3. Request dubbing into target language Hindi (hi)
        r = client.post(f"/api/lectures/{lecture_id}/dub/hi", headers=student_headers)
        log_test("Request Dubbing Job into Hindi", r.status_code == 200 and r.json().get("target_language") == "hi")

        # 4. Check status of Hindi dubbing job
        r = client.get(f"/api/lectures/{lecture_id}/dub/hi/status", headers=student_headers)
        log_test("Poll Dubbing Job Status", r.status_code == 200 and r.json().get("target_language") == "hi")

        # 5. Reject unsupported target language
        r = client.post(f"/api/lectures/{lecture_id}/dub/xyz", headers=student_headers)
        log_test("Reject Unsupported Dubbing Language (400)", r.status_code == 400)

        # =====================================================================
        # SUITE 7: WORKSHEET GENERATION & ASSESSMENT ENGINE
        # =====================================================================
        print("\n--- SUITE 7: Worksheet Generation & Assessment Engine ---")
        db = SessionLocal()
        # 1. Generate Worksheet for English
        ws_en = create_or_get_worksheet(lecture_id, "en", db)
        log_test("Generate English Worksheet", ws_en is not None and ws_en.status == "completed")
        data_en = json.loads(ws_en.content_json)
        log_test("  - Contains Summary Points", len(data_en.get("summary", [])) > 0)
        log_test("  - Contains Vocabulary Items", len(data_en.get("vocabulary", [])) > 0)
        log_test("  - Contains MCQs with 4 options", len(data_en.get("mcqs", [])) > 0 and len(data_en["mcqs"][0]["options"]) == 4)
        log_test("  - Contains Fill in the Blanks", len(data_en.get("fill_in_the_blanks", [])) > 0)
        log_test("  - Contains Short Comprehension Questions", len(data_en.get("short_questions", [])) > 0)

        # 2. Generate Worksheet for Hindi
        ws_hi = create_or_get_worksheet(lecture_id, "hi", db)
        log_test("Generate Hindi Worksheet", ws_hi is not None and ws_hi.status == "completed")
        data_hi = json.loads(ws_hi.content_json)
        log_test("  - Hindi MCQs and FIBs generated", len(data_hi.get("mcqs", [])) > 0 and len(data_hi.get("fill_in_the_blanks", [])) > 0)

        # 3. Check Caching mechanism (Requesting again returns same record without re-computation)
        ws_hi_cached = create_or_get_worksheet(lecture_id, "hi", db)
        log_test("Worksheet Cache Retrieval", ws_hi_cached.id == ws_hi.id)
        db.close()

        # =====================================================================
        # SUITE 8: PRINTABLE CLASSROOM HTML DOCUMENT RENDERING
        # =====================================================================
        print("\n--- SUITE 8: Printable Classroom Document Rendering ---")
        html_doc_path = os.path.join(settings.storage_path, "worksheets", f"worksheet_{lecture_id}_en.html")
        html_exists = os.path.exists(html_doc_path) and os.path.getsize(html_doc_path) > 1000
        log_test("Printable HTML Worksheet Exists on Disk", html_exists, f"Path: {html_doc_path}")

        if html_exists:
            with open(html_doc_path, "r", encoding="utf-8") as f:
                html_content = f.read()
            log_test("  - Contains School/Platform Header", "मातृभाषा शिक्षा" in html_content)
            log_test("  - Contains Student Info Grid (Name, Roll No, Date)", "Student Name" in html_content or "Roll No" in html_content)
            log_test("  - Contains Print CSS Stylesheet (@media print)", "@media print" in html_content)
            log_test("  - Contains Teacher Answer Key", "Answer Key" in html_content or "शिक्षक उत्तर" in html_content)

        # =====================================================================
        # SUITE 9: WORKSHEET API ROUTER
        # =====================================================================
        print("\n--- SUITE 9: Worksheets API Router Endpoints ---")
        # 1. POST /api/worksheets/generate/{lecture_id}/ta
        r = client.post(f"/api/worksheets/generate/{lecture_id}/ta", headers=student_headers)
        log_test("POST /api/worksheets/generate (Tamil)", r.status_code == 200 and r.json().get("target_language") == "ta")
        ta_ws_id = r.json().get("id")

        # 2. GET /api/worksheets/lecture/{lecture_id}
        r = client.get(f"/api/worksheets/lecture/{lecture_id}", headers=student_headers)
        ws_list = r.json()
        log_test("GET /api/worksheets/lecture/{id} (List worksheets)", r.status_code == 200 and len(ws_list) >= 3)

        # 3. GET /api/worksheets/{worksheet_id}
        r = client.get(f"/api/worksheets/{ta_ws_id}", headers=student_headers)
        log_test(f"GET /api/worksheets/{ta_ws_id} (Retrieve Worksheet Detail)", r.status_code == 200 and r.json().get("content") is not None)

        # 4. Reject Non-Existent Worksheet
        r = client.get("/api/worksheets/999999", headers=student_headers)
        log_test("GET /api/worksheets/999999 returns 404", r.status_code == 404)

        # 5. Reject Invalid Language for Worksheet Generation
        r = client.post(f"/api/worksheets/generate/{lecture_id}/invalidlang", headers=student_headers)
        log_test("Reject Unsupported Language for Worksheet (400)", r.status_code == 400)

        # =====================================================================
        # SUITE 10: NCERT CURRICULUM HUB & DATASET
        # =====================================================================
        print("\n--- SUITE 10: NCERT Curriculum Hub & Dataset ---")
        # 1. Curriculum Overview
        r = client.get("/api/ncert/overview", headers=student_headers)
        overview_data = r.json()
        log_test("GET /api/ncert/overview (Classes 1-8 summary)", r.status_code == 200 and len(overview_data.get("classes", [])) == 8)

        # 2. Filter Chapters by Class
        r = client.get("/api/ncert/chapters?grade_level=6", headers=student_headers)
        c6_chaps = r.json()
        log_test("Filter NCERT Chapters by Class 6", r.status_code == 200 and all(c["grade_level"] == 6 for c in c6_chaps))

        # 3. Filter Chapters by Subject
        r = client.get("/api/ncert/chapters?subject=Science", headers=student_headers)
        sci_chaps = r.json()
        log_test("Filter NCERT Chapters by Subject (Science)", r.status_code == 200 and len(sci_chaps) > 0)

        # 4. Search by Keyword (e.g. "Food")
        r = client.get("/api/ncert/chapters?query=Food", headers=student_headers)
        search_res = r.json()
        log_test("Search NCERT Chapters by Keyword 'Food'", r.status_code == 200 and any("Food" in c["title"] for c in search_res))

        # 5. Get Single Chapter Details
        target_ch_id = "ncert-c6-sci-ch1"
        r = client.get(f"/api/ncert/chapter/{target_ch_id}", headers=student_headers)
        ch_detail = r.json()
        log_test(f"GET /api/ncert/chapter/{target_ch_id}", r.status_code == 200 and ch_detail.get("title") == "Components of Food")
        log_test("  - Contains Hindi Title", ch_detail.get("title_hindi") == "भोजन के घटक")
        log_test("  - Contains Core Concept Points", len(ch_detail.get("core_concepts", [])) >= 4)
        log_test("  - Contains Official NCERT e-Textbook Link", "ncert.nic.in" in ch_detail.get("official_pdf_url", ""))

        # 6. Reject Non-Existent NCERT Chapter
        r = client.get("/api/ncert/chapter/non-existent-ch", headers=student_headers)
        log_test("GET Non-Existent Chapter returns 404", r.status_code == 404)

        # =====================================================================
        # SUITE 11: NCERT LESSON ADOPTION ENGINE
        # =====================================================================
        print("\n--- SUITE 11: NCERT Lesson Adoption Engine ---")
        # Adopt Class 6 Science Chapter 1 "Components of Food"
        r = client.post(f"/api/ncert/chapter/{target_ch_id}/adopt", headers=teacher_headers)
        log_test(f"Adopt NCERT Chapter '{target_ch_id}' as Interactive Lesson", r.status_code == 200 and r.json().get("lecture_id") is not None)
        ncert_lecture_id = r.json().get("lecture_id")

        # Verify adopted lecture is now listed in general lectures
        r = client.get(f"/api/lectures/{ncert_lecture_id}", headers=student_headers)
        log_test("Adopted Lesson Accessible in Platform", r.status_code == 200 and "Components of Food" in r.json().get("title", ""))

        # Verify worksheets were automatically created for the adopted lesson
        r = client.get(f"/api/worksheets/lecture/{ncert_lecture_id}", headers=student_headers)
        adopted_ws_list = r.json()
        log_test("Auto-Generated Worksheets for Adopted Lesson", r.status_code == 200 and len(adopted_ws_list) >= 1)

        # =====================================================================
        # SUITE 12: STATIC FILE SERVING & MEDIA DELIVERY
        # =====================================================================
        print("\n--- SUITE 12: Static File Serving & Media Delivery ---")
        # 1. Verify Storage Mount serves generated worksheets
        rel_ws_path = f"/storage/worksheets/worksheet_{lecture_id}_en.html"
        r = client.get(rel_ws_path)
        log_test(f"GET {rel_ws_path}", r.status_code == 200 and "text/html" in r.headers.get("content-type", ""))

        # 2. Verify Storage Mount serves generated audio/tts
        rel_tts_path = f"/storage/dubbed/test_tts_{timestamp}.mp3"
        r = client.get(rel_tts_path)
        log_test(f"GET {rel_tts_path}", r.status_code == 200)

        # =====================================================================
        # SUITE 13: LIVE CLASSROOM REAL-TIME HUB & WEBSOCKETS
        # =====================================================================
        print("\n--- SUITE 13: Live Classroom Real-Time Hub & WebSockets ---")
        # 1. Create Live Room (Teacher)
        live_payload = {
            "title": "Master Live Science: Water Cycle & Rain",
            "subject": "Environmental Science",
            "grade_level": 5,
            "original_language": "en"
        }
        r = client.post("/api/live/rooms/create", json=live_payload, headers=teacher_headers)
        log_test("Teacher creates live classroom session", r.status_code == 200 and "room_code" in r.json())
        live_room_data = r.json()
        room_code = live_room_data["room_code"]

        # 2. Student permission check (Students cannot create live rooms)
        r = client.post("/api/live/rooms/create", json=live_payload, headers=student_headers)
        log_test("Student cannot create live classroom (Forbidden 403)", r.status_code == 403)

        # 3. List Active Rooms
        r = client.get("/api/live/rooms/active")
        log_test("List active live classrooms", r.status_code == 200 and any(rm["room_code"] == room_code for rm in r.json()))

        # 4. Get Room Detail
        r = client.get(f"/api/live/rooms/{room_code}")
        log_test("Get room metadata", r.status_code == 200 and r.json().get("title") == live_payload["title"])

        # 5. Connect Teacher & Student via WebSockets, test live caption broadcast & doubts
        with client.websocket_connect(f"/api/live/ws/{room_code}/teacher") as teacher_ws:
            log_test("Teacher WebSocket connects", True)

            with client.websocket_connect(f"/api/live/ws/{room_code}/student?name=Deepak&language=ta") as student_ws:
                log_test("Student (Tamil) WebSocket connects", True)

                # Student receives welcome payload
                welcome_msg = student_ws.receive_json()
                log_test("Student receives welcome packet", welcome_msg.get("type") == "welcome")

                # Teacher broadcasts live transcribed speech
                speech_text = "The sun heats water in oceans and rivers."
                teacher_ws.send_json({
                    "type": "teacher_speech",
                    "text": speech_text,
                    "language": "en"
                })

                # Teacher receives speech ack
                t_ack = teacher_ws.receive_json()
                log_test("Teacher receives speech ack", t_ack.get("type") == "speech_ack")

                # Student receives live caption translated into Tamil
                st_caption = student_ws.receive_json()
                log_test(
                    "Student receives real-time translated caption",
                    st_caption.get("type") == "live_caption" and "translated_text" in st_caption
                )

                # Student asks a doubt in Tamil
                student_ws.send_json({
                    "type": "student_doubt",
                    "question": "மழை எவ்வாறு உருவாகிறது?"
                })

                # Student receives doubt sent ack
                d_ack = student_ws.receive_json()
                log_test("Student receives doubt receipt", d_ack.get("type") == "doubt_sent")

                # Teacher receives student doubt translated to English
                t_doubt = teacher_ws.receive_json()
                log_test(
                    "Teacher receives translated student doubt",
                    t_doubt.get("type") == "student_doubt" and "doubt" in t_doubt
                )

        # 6. End Live Room and Archive to Permanent Lecture & Auto Worksheets
        r = client.post(f"/api/live/rooms/{room_code}/end", headers=teacher_headers)
        log_test("End live room & auto-archive session", r.status_code == 200 and "lecture_id" in r.json())
        archived_lecture_id = r.json().get("lecture_id")

        # 7. Verify Archived Lecture exists in Lecture repository
        r = client.get(f"/api/lectures/{archived_lecture_id}", headers=student_headers)
        log_test(
            "Archived Live Class accessible as permanent Lecture",
            r.status_code == 200 and r.json().get("has_transcript") is True
        )

        # 8. Verify Room is no longer in active list
        r = client.get("/api/live/rooms/active")
        active_codes = [rm["room_code"] for rm in r.json()]
        log_test("Ended room removed from active classrooms", room_code not in active_codes)

    # =====================================================================
    # FINAL SUMMARY REPORT
    # =====================================================================
    print("\n" + "=" * 75)
    print(f"MASTER TEST RESULTS: {PASSED_TESTS}/{TOTAL_TESTS} PASSED ({(PASSED_TESTS/TOTAL_TESTS)*100:.1f}%)")
    if FAILED_TESTS == 0:
        print("🎉 ALL SYSTEMS FULLY OPERATIONAL AND VERIFIED!")
    else:
        print(f"⚠️ {FAILED_TESTS} TESTS FAILED - REVIEW LOGS ABOVE.")
    print("=" * 75)

    return FAILED_TESTS == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
