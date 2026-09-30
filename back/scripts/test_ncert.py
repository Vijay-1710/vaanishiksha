"""
Test script for NCERT Curriculum Integration and Chapter Adoption.
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
from app.models import User, Lecture, Worksheet

def main():
    print("=" * 60)
    print("TESTING NCERT CURRICULUM & CUSTOMIZED LESSON ADOPTION")
    print("=" * 60)

    db = SessionLocal()
    teacher = db.query(User).filter(User.role == "teacher").first()
    db.close()

    if not teacher:
        print("❌ Need at least 1 teacher in DB")
        return False

    with TestClient(app) as client:
        # 1. Login
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
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Logged in successfully.")

        # 2. Test Curriculum Overview
        print("\n[2] Testing GET /api/ncert/overview...")
        r = client.get("/api/ncert/overview", headers=headers)
        assert r.status_code == 200, f"Failed: {r.text}"
        overview = r.json()
        assert "classes" in overview
        assert len(overview["classes"]) == 8
        print(f"✅ NCERT Overview returned {len(overview['classes'])} classes and {overview['total_chapters']} total chapters.")

        # 3. Test Search / Filter Chapters for Class 5
        print("\n[3] Testing GET /api/ncert/chapters?grade_level=5...")
        r = client.get("/api/ncert/chapters?grade_level=5", headers=headers)
        assert r.status_code == 200
        chaps = r.json()
        assert len(chaps) >= 1
        super_senses = next((c for c in chaps if "Super Senses" in c["title"]), None)
        assert super_senses is not None
        print(f"✅ Found Class 5 chapter: '{super_senses['title']}' ({super_senses['title_hindi']})")

        # 4. Test Single Chapter Detail
        print(f"\n[4] Testing GET /api/ncert/chapter/{super_senses['id']}...")
        r = client.get(f"/api/ncert/chapter/{super_senses['id']}", headers=headers)
        assert r.status_code == 200
        detail = r.json()
        assert len(detail["core_concepts"]) >= 3
        print(f"✅ Concepts: {detail['core_concepts'][:2]}")

        # 5. Test Adopt Chapter as Active Lecture
        print(f"\n[5] Testing POST /api/ncert/chapter/{super_senses['id']}/adopt...")
        r = client.post(f"/api/ncert/chapter/{super_senses['id']}/adopt", headers=headers)
        assert r.status_code == 200, f"Adoption failed: {r.text}"
        adopted = r.json()
        lecture_id = adopted["lecture_id"]
        print(f"✅ Successfully converted NCERT chapter to interactive lesson! ID={lecture_id}, Title='{adopted['title']}'")

        # 6. Verify Worksheets were generated for this NCERT lesson
        print(f"\n[6] Checking worksheets generated for adopted lecture {lecture_id}...")
        r = client.get(f"/api/worksheets/lecture/{lecture_id}", headers=headers)
        assert r.status_code == 200
        ws_items = r.json()
        assert len(ws_items) >= 1
        print(f"✅ Worksheets generated: {[w['target_language'] for w in ws_items]}")

        print("\n" + "=" * 60)
        print("🎉 ALL NCERT CURRICULUM TESTS PASSED!")
        print("=" * 60)
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
