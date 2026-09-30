"""
Worksheet generation service.
Produces structured educational worksheets (summary, vocabulary, MCQs,
fill-in-the-blanks, short questions) from lecture transcripts in any Indian language.
Generates printable classroom worksheets and interactive quiz data.
"""

import os
import json
import logging
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Lecture, DubbedLecture, Worksheet
from app.services.translation_service import translate_text

logger = logging.getLogger(__name__)

# Language labels for worksheet headers
SECTION_TITLES = {
    "en": {
        "title": "Practice Worksheet & Assessment",
        "name": "Student Name",
        "roll": "Roll No.",
        "date": "Date",
        "grade": "Grade",
        "subject": "Subject",
        "score": "Score",
        "summary": "Key Learning Concepts",
        "vocab": "Important Vocabulary",
        "mcq": "Section A: Multiple Choice Questions",
        "fib": "Section B: Fill in the Blanks",
        "short": "Section C: Short Answer Questions",
        "answers": "Teacher's Answer Key",
        "instructions": "Read all questions carefully and write your answers neatly.",
    },
    "hi": {
        "title": "अभ्यास कार्यपत्रक एवं मूल्यांकन",
        "name": "विद्यार्थी का नाम",
        "roll": "क्रमांक (Roll No.)",
        "date": "दिनांक",
        "grade": "कक्षा",
        "subject": "विषय",
        "score": "प्राप्तांक",
        "summary": "मुख्य शिक्षण बिंदु (सारांश)",
        "vocab": "महत्वपूर्ण शब्दावली",
        "mcq": "खंड 'क': बहुविकल्पीय प्रश्न (MCQs)",
        "fib": "खंड 'ख': रिक्त स्थान भरें",
        "short": "खंड 'ग': लघु उत्तरीय प्रश्न",
        "answers": "शिक्षक उत्तर कुंजी (Answer Key)",
        "instructions": "सभी प्रश्नों को ध्यानपूर्वक पढ़ें और स्पष्ट रूप से उत्तर लिखें।",
    },
    "ta": {
        "title": "பயிற்சி பணித்தாள் மற்றும் மதிப்பீடு",
        "name": "மாணவர் பெயர்",
        "roll": "வரிசை எண்",
        "date": "தேதி",
        "grade": "வகுப்பு",
        "subject": "பாடம்",
        "score": "மதிப்பெண்",
        "summary": "முக்கிய கருத்துக்கள்",
        "vocab": "முக்கிய கலைச்சொற்கள்",
        "mcq": "பிரிவு அ: சரியான விடையைத் தேர்ந்தெடு",
        "fib": "பிரிவு ஆ: கோடிட்ட இடங்களை நிரப்புக",
        "short": "பிரிவு இ: குறு வினாக்கள்",
        "answers": "ஆசிரியர் விடைக்குறிப்பு",
        "instructions": "அனைத்து வினாக்களையும் கவனமாகப் படித்து விடையளிக்கவும்.",
    },
    "te": {
        "title": "అభ్యాస వర్క్‌షీట్ & మూల్యాంకనం",
        "name": "విద్యార్థి పేరు",
        "roll": "రోల్ నంబర్",
        "date": "తేదీ",
        "grade": "తరగతి",
        "subject": "విషయం",
        "score": "మార్కులు",
        "summary": "కీలక అభ్యాస భావనలు",
        "vocab": "ముఖ్యమైన పదజాలం",
        "mcq": "విభాగం A: బహుళైచ్ఛిక ప్రశ్నలు",
        "fib": "విభాగం B: ఖాళీలను పూరించండి",
        "short": "విభాగం C: సంక్షిప్త సమాధాన ప్రశ్నలు",
        "answers": "సమాధానాల సూచిక (Answer Key)",
        "instructions": "అన్ని ప్రశ్నలను శ్రద్ధగా చదివి సమాధానాలు రాయండి.",
    },
    "kn": {
        "title": "ಅಭ್ಯಾಸ ವರ್ಕ್‌ಶೀಟ್ ಮತ್ತು ಮೌಲ್ಯಮಾಪನ",
        "name": "ವಿದ್ಯಾರ್ಥಿಯ ಹೆಸರು",
        "roll": "ಕ್ರಮಾಂಕ",
        "date": "ದಿನಾಂಕ",
        "grade": "ತರಗತಿ",
        "subject": "ವಿಷಯ",
        "score": "ಅಂಕಗಳು",
        "summary": "ಪ್ರಮುಖ ಕಲಿಕಾ ಅಂಶಗಳು",
        "vocab": "ಪ್ರಮುಖ ಶಬ್ದಕೋಶ",
        "mcq": "ವಿಭಾಗ ಎ: ಬಹು ಆಯ್ಕೆ ಪ್ರಶ್ನೆಗಳು",
        "fib": "ವಿಭಾಗ ಬಿ: ಬಿಟ್ಟ ಸ್ಥಳ ತುಂಬಿರಿ",
        "short": "ವಿಭಾಗ ಸಿ: ಕಿರು ಉತ್ತರ ಪ್ರಶ್ನೆಗಳು",
        "answers": "ಶಿಕ್ಷಕರ ಉತ್ತರ ಸೂಚಿ",
        "instructions": "ಎಲ್ಲಾ ಪ್ರಶ್ನೆಗಳನ್ನು ಎಚ್ಚರಿಕೆಯಿಂದ ಓದಿ ಉತ್ತರಿಸಿ.",
    },
    "bn": {
        "title": "অনুশীলন ওয়ার্কশীট ও মূল্যায়ন",
        "name": "শিক্ষার্থীর নাম",
        "roll": "রোল নং",
        "date": "তারিখ",
        "grade": "শ্রেণী",
        "subject": "বিষয়",
        "score": "প্রাপ্ত নম্বর",
        "summary": "মূল শিখন ধারণা",
        "vocab": "গুরুত্বপূর্ণ শব্দভাণ্ডার",
        "mcq": "বিভাগ ক: বহুনির্বাচনী প্রশ্ন",
        "fib": "বিভাগ খ: শূন্যস্থান পূরণ করো",
        "short": "বিভাগ গ: সংক্ষিপ্ত উত্তর প্রশ্ন",
        "answers": "শিক্ষকের উত্তর নির্দেশিকা",
        "instructions": "সমস্ত প্রশ্ন মনোযোগ সহকারে পড়ুন এবং স্পষ্ট করে উত্তর লিখুন।",
    },
}


def _get_labels(lang: str) -> Dict[str, str]:
    return SECTION_TITLES.get(lang, SECTION_TITLES["en"])


def _generate_via_omniroute(
    lecture_title: str,
    subject: str,
    grade_level: int,
    transcript_text: str,
    target_lang: str,
) -> Optional[Dict[str, Any]]:
    """Try to generate structured worksheet JSON using local Omniroute / LLM gateway."""
    import httpx

    api_key = settings.gemini_api_key
    if not api_key:
        return None

    lang_name = settings.language_names.get(target_lang, target_lang)

    system_prompt = f"""You are an expert primary school curriculum teacher and educator in India.
Your task is to create a complete, high-quality practice worksheet and quiz in the language '{lang_name}' (ISO code: {target_lang}) based on the educational lecture transcript provided.

The lecture is for Grade/Class {grade_level}, Subject: {subject or 'General Studies'}.
Title: {lecture_title}.

You MUST return a valid JSON object strictly matching this schema:
{{
  "title": "Worksheet title in {lang_name}",
  "summary": [
    "3 to 5 clear bullet points explaining key concepts in simple words for class {grade_level} in {lang_name}"
  ],
  "vocabulary": [
    {{"term": "Keyword in {lang_name}", "meaning": "Simple explanation in {lang_name}"}}
  ],
  "mcqs": [
    {{
      "id": 1,
      "question": "Question text in {lang_name}",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 0,
      "explanation": "Why this answer is correct in {lang_name}"
    }}
  ],
  "fill_in_the_blanks": [
    {{
      "id": 1,
      "sentence": "Sentence with blank '_____' in {lang_name}",
      "answer": "The missing word in {lang_name}"
    }}
  ],
  "short_questions": [
    {{
      "id": 1,
      "question": "Comprehension question in {lang_name}",
      "model_answer": "Clear sample answer in {lang_name}"
    }}
  ]
}}

Generate at least 3 MCQs, 3 Fill-in-the-blanks, 2 short questions, and 3 vocabulary terms.
Output ONLY the JSON object. Do not enclose in markdown blocks if possible, or use standard ```json.
"""

    url = "http://localhost:20128/v1/chat/completions"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    payload = {
        "model": "cl/anthropic/claude-opus-4.8",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Transcript text:\n\n{transcript_text[:3500]}"},
        ],
        "temperature": 0.2,
    }

    try:
        with httpx.Client(timeout=45.0) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                content = data["choices"][0]["message"]["content"].strip()
                # Remove markdown fences if present
                clean = re.sub(r"^```(?:json)?\s*", "", content, flags=re.MULTILINE)
                clean = re.sub(r"\s*```$", "", clean, flags=re.MULTILINE).strip()
                parsed = json.loads(clean)
                if "mcqs" in parsed and "summary" in parsed:
                    return parsed
    except Exception as e:
        logger.info(f"LLM worksheet generation skipped ({e}), falling back to NLP extractor.")

    return None


def _extract_words(text: str) -> List[str]:
    """Split on whitespace and punctuation to reliably extract words in any Indian script."""
    raw_tokens = re.split(r"[\s,;:!?।॥'\"()\[\]{}–—\-]+", text)
    tokens = [t.strip() for t in raw_tokens if len(t.strip()) >= 3 and not t.strip().isdigit()]
    return tokens


def _extract_keywords(text: str) -> List[str]:
    """Extract informative words/terms from text."""
    words = _extract_words(text)
    stop_words = {
        "that", "this", "with", "from", "they", "will", "have", "were", "what", "when",
        "where", "which", "there", "their", "about", "today", "hello", "students", "learn",
        "thank", "listening", "remember", "always", "these", "those", "also", "into",
        "और", "तथा", "यह", "वह", "हैं", "था", "थे", "थी", "का", "के", "की", "में", "से", "पर", "लिए",
        "என்று", "மற்றும்", "இந்த", "அந்த", "உள்ளது", "ஆகும்"
    }
    keywords = []
    seen = set()
    for w in words:
        wl = w.lower()
        if wl not in stop_words and wl not in seen and not w.isdigit():
            seen.add(wl)
            keywords.append(w)
    return keywords


def _generate_rule_based(
    lecture_title: str,
    subject: str,
    grade_level: int,
    transcript_text: str,
    target_lang: str,
) -> Dict[str, Any]:
    """
    Intelligent NLP fallback generator.
    Parses transcript sentences and generates complete, well-formed worksheet content.
    Guarantees 100% availability offline or in low-resource environments.
    """
    labels = _get_labels(target_lang)

    # Split into clean sentences
    raw_sentences = re.split(r"(?<=[.!?।])\s+", transcript_text.strip())
    sentences = [s.strip() for s in raw_sentences if len(s.strip()) > 15]

    if not sentences:
        sentences = [transcript_text.strip()]

    # Extract keywords
    keywords = _extract_keywords(transcript_text)
    if len(keywords) < 4:
        keywords.extend(["Concept", "Lesson", "Process", "Principle"])

    # 1. Summary
    summary_points = []
    for s in sentences[:4]:
        summary_points.append(s)
    if not summary_points:
        summary_points = [f"{lecture_title} - {subject or 'Primary Lesson'}"]

    # 2. Vocabulary
    vocab_items = []
    for kw in keywords[:4]:
        vocab_items.append({
            "term": kw,
            "meaning": f"Important concept in {lecture_title}."
        })

    # 3. Fill in the blanks
    fib_list = []
    used_fib_sentences = sentences[:4]
    for i, sent in enumerate(used_fib_sentences, start=1):
        # Find a suitable keyword in this sentence to mask
        sent_words = _extract_words(sent)
        target_word = None
        for w in sent_words:
            if w in keywords or w.lower() in [k.lower() for k in keywords]:
                target_word = w
                break
        if not target_word and sent_words:
            target_word = sent_words[-1]

        if target_word:
            masked = re.sub(re.escape(target_word), "__________", sent, count=1)
            fib_list.append({
                "id": i,
                "sentence": masked,
                "answer": target_word
            })

    # 4. MCQs
    mcqs = []
    mcq_sentences = sentences[1:5] or sentences[:1]
    for i, sent in enumerate(mcq_sentences, start=1):
        words = _extract_words(sent)
        correct_answer = words[0] if words else f"Key Fact {i}"

        # Generate 3 plausible distractors from other keywords
        distractors = [k for k in keywords if k.lower() != correct_answer.lower()]
        while len(distractors) < 3:
            distractors.append(f"Option {len(distractors) + 1}")

        options = [correct_answer, distractors[0], distractors[1], distractors[2]]
        # Shuffle deterministically based on index so answer isn't always A
        shift = (i % 4)
        shuffled_options = options[shift:] + options[:shift]
        correct_idx = shuffled_options.index(correct_answer)

        mcqs.append({
            "id": i,
            "question": f"Based on the lesson: {sent}",
            "options": shuffled_options,
            "correct_index": correct_idx,
            "explanation": f"As explained in the lecture: '{sent}'"
        })

    # 5. Short answer questions
    short_questions = [
        {
            "id": 1,
            "question": f"What is the main topic of '{lecture_title}' and what did you learn?",
            "model_answer": f"The lesson introduces {lecture_title}. " + (" ".join(summary_points[:2]))
        },
        {
            "id": 2,
            "question": "Write two key facts mentioned by the teacher in this lesson.",
            "model_answer": " ".join(summary_points[-2:]) if len(summary_points) >= 2 else summary_points[0]
        }
    ]

    return {
        "title": f"{lecture_title} - {labels['title']}",
        "summary": summary_points,
        "vocabulary": vocab_items,
        "mcqs": mcqs,
        "fill_in_the_blanks": fib_list,
        "short_questions": short_questions,
    }


def render_html_worksheet(worksheet_data: Dict[str, Any], meta: Dict[str, Any]) -> str:
    """
    Renders a print-ready, high-resolution A4 educational worksheet HTML.
    Includes school header, student info lines, MCQ bubbles, ruled writing lines,
    and a teacher's answer key section.
    """
    lang = meta.get("target_language", "en")
    labels = _get_labels(lang)

    title = worksheet_data.get("title", meta.get("title", "Worksheet"))
    grade = meta.get("grade_level", "General")
    subject = meta.get("subject", "Science / General")
    date_str = datetime.utcnow().strftime("%d-%m-%Y")

    mcqs_html = ""
    for mcq in worksheet_data.get("mcqs", []):
        options_html = ""
        option_letters = ["A", "B", "C", "D"]
        for idx, opt in enumerate(mcq.get("options", [])):
            letter = option_letters[idx] if idx < 4 else str(idx + 1)
            options_html += f"""
            <div class="option-item">
              <span class="option-circle">({letter})</span>
              <span class="option-text">{opt}</span>
            </div>
            """
        mcqs_html += f"""
        <div class="question-block">
          <p class="question-title"><strong>Q{mcq.get('id', 1)}.</strong> {mcq.get('question')}</p>
          <div class="options-grid">
            {options_html}
          </div>
        </div>
        """

    fib_html = ""
    for fib in worksheet_data.get("fill_in_the_blanks", []):
        fib_html += f"""
        <div class="fib-block">
          <p><strong>{fib.get('id', 1)}.</strong> {fib.get('sentence')}</p>
        </div>
        """

    short_html = ""
    for sq in worksheet_data.get("short_questions", []):
        short_html += f"""
        <div class="short-q-block">
          <p class="question-title"><strong>{sq.get('id', 1)}.</strong> {sq.get('question')}</p>
          <div class="ruled-lines">
            <div class="line"></div>
            <div class="line"></div>
            <div class="line"></div>
          </div>
        </div>
        """

    summary_items = "".join(f"<li>{s}</li>" for s in worksheet_data.get("summary", []))
    vocab_items = "".join(
        f"<li><strong>{v.get('term')}:</strong> {v.get('meaning')}</li>"
        for v in worksheet_data.get("vocabulary", [])
    )

    # Answer Key for teachers
    answer_key_mcqs = "".join(
        f"<li><strong>Q{m.get('id')}:</strong> Option ({['A','B','C','D'][m.get('correct_index', 0)]}) - {m.get('options', [''])[m.get('correct_index', 0)]} <em>({m.get('explanation', '')})</em></li>"
        for m in worksheet_data.get("mcqs", [])
    )
    answer_key_fib = "".join(
        f"<li><strong>{f.get('id')}:</strong> {f.get('answer')}</li>"
        for f in worksheet_data.get("fill_in_the_blanks", [])
    )

    html = f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <title>{title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&family=Noto+Sans+Tamil:wght@400;600;700&display=swap');
    
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      font-family: 'Noto Sans', 'Noto Sans Devanagari', 'Noto Sans Tamil', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1f2937;
      background-color: #f3f4f6;
      padding: 20px;
      line-height: 1.6;
    }}
    .sheet-page {{
      max-width: 800px;
      margin: 0 auto 30px auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      border: 1px solid #e5e7eb;
    }}
    .header-bar {{
      text-align: center;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }}
    .header-logo {{
      font-size: 26px;
      font-weight: 800;
      color: #1d4ed8;
      letter-spacing: -0.5px;
    }}
    .header-subtitle {{
      font-size: 14px;
      color: #6b7280;
      margin-top: 4px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }}
    .worksheet-title {{
      font-size: 20px;
      font-weight: 700;
      color: #111827;
      margin-top: 12px;
    }}
    .student-info-grid {{
      display: grid;
      grid-template-columns: 2fr 1fr 1fr;
      gap: 12px;
      background-color: #f8fafc;
      padding: 12px 16px;
      border-radius: 6px;
      border: 1px dashed #cbd5e1;
      margin-bottom: 24px;
      font-size: 14px;
    }}
    .info-line {{
      display: flex;
      align-items: baseline;
      gap: 6px;
    }}
    .info-line strong {{
      color: #475569;
    }}
    .info-fill {{
      border-bottom: 1px solid #94a3b8;
      flex: 1;
      min-height: 18px;
    }}
    .section-header {{
      background: #eff6ff;
      color: #1e40af;
      padding: 8px 14px;
      font-weight: 700;
      font-size: 15px;
      border-left: 4px solid #2563eb;
      border-radius: 0 4px 4px 0;
      margin: 22px 0 12px 0;
    }}
    .summary-box {{
      background: #faf5ff;
      border: 1px solid #f3e8ff;
      border-radius: 6px;
      padding: 14px 20px;
      font-size: 14px;
    }}
    .summary-box ul {{
      padding-left: 20px;
    }}
    .summary-box li {{
      margin-bottom: 6px;
    }}
    .vocab-box {{
      background: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 6px;
      padding: 14px 20px;
      font-size: 14px;
    }}
    .vocab-box ul {{
      list-style-type: square;
      padding-left: 20px;
    }}
    .vocab-box li {{
      margin-bottom: 6px;
    }}
    .question-block {{
      margin-bottom: 18px;
      padding-bottom: 12px;
      border-bottom: 1px dotted #e2e8f0;
    }}
    .question-title {{
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 8px;
    }}
    .options-grid {{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      padding-left: 14px;
    }}
    .option-item {{
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
    }}
    .option-circle {{
      font-weight: 700;
      color: #4b5563;
    }}
    .fib-block {{
      font-size: 15px;
      margin-bottom: 14px;
      padding: 6px 0;
    }}
    .short-q-block {{
      margin-bottom: 22px;
    }}
    .ruled-lines {{
      margin-top: 10px;
      padding-left: 10px;
    }}
    .line {{
      border-bottom: 1px solid #cbd5e1;
      height: 28px;
    }}
    .footer-bar {{
      margin-top: 36px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #64748b;
    }}
    .signature-box {{
      width: 200px;
      border-top: 1px solid #64748b;
      text-align: center;
      padding-top: 4px;
      margin-top: 24px;
    }}
    .answer-key-section {{
      page-break-before: always;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px dashed #94a3b8;
    }}
    .answer-key-section h3 {{
      color: #dc2626;
      margin-bottom: 12px;
    }}
    .answer-key-section ol {{
      padding-left: 20px;
      font-size: 14px;
      color: #374151;
    }}
    .answer-key-section li {{
      margin-bottom: 6px;
    }}
    .print-button-bar {{
      text-align: center;
      margin-bottom: 20px;
    }}
    .btn-print {{
      background-color: #2563eb;
      color: white;
      border: none;
      padding: 10px 24px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
    }}
    .btn-print:hover {{
      background-color: #1d4ed8;
    }}

    @media print {{
      body {{
        background: none;
        padding: 0;
      }}
      .sheet-page {{
        box-shadow: none;
        border: none;
        padding: 20px;
        max-width: 100%;
        page-break-after: always;
      }}
      .print-button-bar {{
        display: none;
      }}
    }}
  </style>
</head>
<body>

  <div class="print-button-bar">
    <button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  </div>

  <div class="sheet-page">
    <div class="header-bar">
      <div class="header-logo">मातृभाषा शिक्षा • Mother-Tongue Learning</div>
      <div class="header-subtitle">{subject} | Class {grade} | {labels['title']}</div>
      <h1 class="worksheet-title">{title}</h1>
    </div>

    <div class="student-info-grid">
      <div class="info-line">
        <strong>{labels['name']}:</strong>
        <span class="info-fill"></span>
      </div>
      <div class="info-line">
        <strong>{labels['roll']}:</strong>
        <span class="info-fill"></span>
      </div>
      <div class="info-line">
        <strong>{labels['date']}:</strong>
        <span>{date_str}</span>
      </div>
      <div class="info-line">
        <strong>{labels['grade']}:</strong>
        <span>Class {grade}</span>
      </div>
      <div class="info-line">
        <strong>{labels['subject']}:</strong>
        <span>{subject}</span>
      </div>
      <div class="info-line">
        <strong>{labels['score']}:</strong>
        <span>______ / 20</span>
      </div>
    </div>

    <!-- Summary Box -->
    <div class="section-header">{labels['summary']}</div>
    <div class="summary-box">
      <ul>
        {summary_items}
      </ul>
    </div>

    <!-- Vocabulary Box -->
    <div class="section-header">{labels['vocab']}</div>
    <div class="vocab-box">
      <ul>
        {vocab_items}
      </ul>
    </div>

    <!-- MCQs -->
    <div class="section-header">{labels['mcq']}</div>
    {mcqs_html}

    <!-- Fill in the Blanks -->
    <div class="section-header">{labels['fib']}</div>
    {fib_html}

    <!-- Short Questions -->
    <div class="section-header">{labels['short']}</div>
    {short_html}

    <div class="footer-bar">
      <div>मातृभाषा शिक्षा - Primary Education for All</div>
      <div class="signature-box">Teacher's Signature & Remarks</div>
    </div>

    <!-- Teacher Answer Key -->
    <div class="answer-key-section">
      <h3>🔒 {labels['answers']}</h3>
      <p style="font-size: 13px; color: #6b7280; margin-bottom: 12px;">(For teachers and self-evaluation)</p>
      
      <h4 style="margin-bottom: 6px;">MCQ Answers:</h4>
      <ol>
        {answer_key_mcqs}
      </ol>

      <h4 style="margin: 12px 0 6px 0;">Fill in the Blanks Answers:</h4>
      <ol>
        {answer_key_fib}
      </ol>
    </div>
  </div>

</body>
</html>
"""
    return html


def create_or_get_worksheet(lecture_id: int, target_language: str, db: Session) -> Worksheet:
    """
    Generate or retrieve a cached worksheet for a given lecture and target language.
    1. Check if existing completed worksheet exists.
    2. If not, acquire transcript in target language.
    3. Generate structured worksheet content (LLM or rule-based fallback).
    4. Render printable HTML document and save to storage.
    5. Save to database and return.
    """
    # 1. Check existing
    existing = db.query(Worksheet).filter(
        Worksheet.lecture_id == lecture_id,
        Worksheet.target_language == target_language
    ).first()

    if existing and existing.status == "completed" and existing.content_json:
        return existing

    # 2. Get lecture
    lecture = db.query(Lecture).filter(Lecture.id == lecture_id).first()
    if not lecture:
        raise ValueError(f"Lecture {lecture_id} not found")

    # Target language transcript
    transcript_text = ""
    if target_language == lecture.original_language:
        transcript_text = lecture.transcript_text or ""
    else:
        # Check dubbed version
        dubbed = db.query(DubbedLecture).filter(
            DubbedLecture.lecture_id == lecture_id,
            DubbedLecture.target_language == target_language
        ).first()
        if dubbed and dubbed.translated_transcript_text:
            transcript_text = dubbed.translated_transcript_text
        elif lecture.transcript_text:
            # On-the-fly translation
            transcript_text = translate_text(
                lecture.transcript_text,
                source_lang=lecture.original_language,
                target_lang=target_language
            )

    if not transcript_text:
        transcript_text = f"Educational lesson: {lecture.title}. {lecture.description or ''}"

    # 3. Generate structured content
    worksheet_data = _generate_via_omniroute(
        lecture_title=lecture.title,
        subject=lecture.subject or "General",
        grade_level=lecture.grade_level or 1,
        transcript_text=transcript_text,
        target_lang=target_language
    )

    if not worksheet_data:
        worksheet_data = _generate_rule_based(
            lecture_title=lecture.title,
            subject=lecture.subject or "General",
            grade_level=lecture.grade_level or 1,
            transcript_text=transcript_text,
            target_lang=target_language
        )

    # 4. Render HTML worksheet file
    os.makedirs(f"{settings.storage_path}/worksheets", exist_ok=True)
    html_filename = f"worksheet_{lecture.id}_{target_language}.html"
    html_file_path = f"{settings.storage_path}/worksheets/{html_filename}"
    meta = {
        "title": lecture.title,
        "subject": lecture.subject or "General",
        "grade_level": lecture.grade_level or 1,
        "target_language": target_language
    }
    html_content = render_html_worksheet(worksheet_data, meta)
    with open(html_file_path, "w", encoding="utf-8") as f:
        f.write(html_content)

    content_json_str = json.dumps(worksheet_data, ensure_ascii=False)
    relative_doc_path = f"/storage/worksheets/{html_filename}"

    # 5. Persist to DB
    if not existing:
        existing = Worksheet(
            lecture_id=lecture.id,
            target_language=target_language,
            pdf_path=relative_doc_path,
            content_json=content_json_str,
            status="completed",
            completed_at=datetime.utcnow()
        )
        db.add(existing)
    else:
        existing.pdf_path = relative_doc_path
        existing.content_json = content_json_str
        existing.status = "completed"
        existing.completed_at = datetime.utcnow()

    db.commit()
    db.refresh(existing)
    return existing
