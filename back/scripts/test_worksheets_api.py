"""
End-to-end API test for Module 2: Worksheets router and endpoints.
Uses ASGI in-process client to test authentication, generation, retrieval, and listing.
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
    print("=" * 60)
    print("TESTING WORKSHEETS API (ENDPOINTS & ROUTING)")
    print("=" * 60)

    db = SessionLocal()
    teacher = db.query(User).filter(User.role == "teacher").first()
    lecture = db.query(Lecture).first()
    db.close()

    if not teacher or not lecture:
        print("❌ Prerequisites not met: need at least 1 teacher and 1 lecture in DB")
        return False

    with TestClient(app) as client:
        # 1. Login
        print(f"\n[1] Logging in as teacher ({teacher.email})...")
        r = client.post("/api/auth/login", json={
            "username": teacher.email,
            "password": "TestPass123!"
        })
        if r.status_code != 200:
            # Fallback to test flow teacher
            r = client.post("/api/auth/login", json={
                "username": "teacher_test_flow@school.edu",
                "password": "TeacherPassword123!"
            })
        
        if r.status_code != 200:
            print(f"Login failed: {r.status_code} {r.text}")
            return False

        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("✅ Logged in successfully. JWT obtained.")

        # 2. Test generate worksheet endpoint (Hindi)
        print(f"\n[2] Testing POST /api/worksheets/generate/{lecture.id}/hi...")
        r = client.post(f"/api/worksheets/generate/{lecture.id}/hi", headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["status"] == "completed"
        assert data["target_language"] == "hi"
        assert "mcqs" in data["content"]
        assert len(data["content"]["mcqs"]) > 0
        worksheet_id = data["id"]
        print(f"✅ Generated Hindi worksheet (ID={worksheet_id}) with {len(data['content']['mcqs'])} MCQs and {len(data['content']['fill_in_the_blanks'])} FIBs")

        # 3. Test list worksheets for lecture
        print(f"\n[3] Testing GET /api/worksheets/lecture/{lecture.id}...")
        r = client.get(f"/api/worksheets/lecture/{lecture.id}", headers=headers)
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        languages_found = [i["target_language"] for i in items]
        print(f"✅ Found {len(items)} worksheets for lecture {lecture.id}. Languages: {languages_found}")

        # 4. Test get single worksheet details
        print(f"\n[4] Testing GET /api/worksheets/{worksheet_id}...")
        r = client.get(f"/api/worksheets/{worksheet_id}", headers=headers)
        assert r.status_code == 200
        single_data = r.json()
        assert single_data["id"] == worksheet_id
        assert single_data["content"] is not None
        print(f"✅ Successfully fetched worksheet details for ID={worksheet_id}")

        # 5. Test generate worksheet for Kannada (kn)
        print(f"\n[5] Testing POST /api/worksheets/generate/{lecture.id}/kn...")
        r = client.post(f"/api/worksheets/generate/{lecture.id}/kn", headers=headers)
        assert r.status_code == 200
        kn_data = r.json()
        assert kn_data["target_language"] == "kn"
        print(f"✅ Generated Kannada worksheet (ID={kn_data['id']}) Title: {kn_data['content']['title']}")

        print("\n" + "=" * 60)
        print("🎉 ALL WORKSHEET API ENDPOINT TESTS PASSED!")
        print("=" * 60)
        return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
