"""
Verification script for Module 2: Auto Worksheet Generation.
Tests worksheet generation across English, Hindi, and Tamil for lecture 1.
"""
import sys
import os
import json
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

from app.database import SessionLocal
from app.models import Lecture, Worksheet
from app.services.worksheet_service import create_or_get_worksheet
from app.config import settings

def main():
    print("=" * 60)
    print("TESTING MODULE 2: AUTO WORKSHEET GENERATION")
    print("=" * 60)

    db = SessionLocal()
    try:
        lecture = db.query(Lecture).first()
        if not lecture:
            print("❌ No lecture found in database. Run e2e_dubbing_test.py or make_test_lecture.py first.")
            return False

        print(f"Testing on lecture ID={lecture.id}: '{lecture.title}' (Original: {lecture.original_language})")

        test_languages = ["en", "hi", "ta"]
        for lang in test_languages:
            print(f"\n--- Generating Worksheet for Language: [{lang}] ---")
            ws = create_or_get_worksheet(lecture.id, lang, db)
            
            assert ws is not None, f"Worksheet creation returned None for {lang}"
            assert ws.status == "completed", f"Worksheet status is {ws.status}"
            assert ws.content_json, f"Worksheet content_json is empty for {lang}"

            data = json.loads(ws.content_json)
            summary_count = len(data.get("summary", []))
            vocab_count = len(data.get("vocabulary", []))
            mcq_count = len(data.get("mcqs", []))
            fib_count = len(data.get("fill_in_the_blanks", []))
            short_count = len(data.get("short_questions", []))

            print(f"✅ Status: {ws.status}")
            print(f"✅ Title: {data.get('title')}")
            print(f"✅ Summary points: {summary_count}")
            print(f"✅ Vocabulary items: {vocab_count}")
            print(f"✅ MCQs generated: {mcq_count}")
            print(f"✅ Fill-in-the-blanks: {fib_count}")
            print(f"✅ Short questions: {short_count}")

            # Verify document file exists on disk
            full_doc_path = os.path.join(settings.storage_path, "worksheets", f"worksheet_{lecture.id}_{lang}.html")
            if os.path.exists(full_doc_path):
                file_size = os.path.getsize(full_doc_path)
                print(f"✅ Printable HTML Document exists: {full_doc_path} ({file_size} bytes)")
            else:
                print(f"⚠️ Warning: Document path {full_doc_path} not found on disk")

            # Sample MCQ preview
            if mcq_count > 0:
                first_mcq = data["mcqs"][0]
                print(f"   Sample MCQ: {first_mcq.get('question')}")
                print(f"   Choices: {first_mcq.get('options')}")
                correct_letter = ['A','B','C','D'][first_mcq.get('correct_index', 0)]
                print(f"   Correct Answer: ({correct_letter}) {first_mcq.get('options')[first_mcq.get('correct_index', 0)]}")

        print("\n" + "=" * 60)
        print("🎉 ALL WORKSHEET TESTS PASSED SUCCESSFULLY!")
        print("=" * 60)
        return True

    finally:
        db.close()

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
