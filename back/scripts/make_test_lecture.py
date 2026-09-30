"""Generate a short real lecture audio file for end-to-end testing using gTTS."""
from gtts import gTTS
import os

LECTURE_TEXT = (
    "Hello students. Today we will learn about the solar system. "
    "The sun is at the center of our solar system. There are eight planets that orbit around the sun. "
    "The first planet is Mercury. The second planet is Venus. Our home planet Earth is the third planet from the sun. "
    "Mars is the fourth planet and it is called the red planet. Jupiter is the largest planet in our solar system. "
    "Saturn has beautiful rings around it. Remember, the planets are always moving around the sun. "
    "Thank you for listening."
)

OUT_PATH = os.path.join(os.path.dirname(__file__), "test_lecture.mp3")


def main():
    print(f"Generating test lecture audio (English) -> {OUT_PATH}")
    tts = gTTS(text=LECTURE_TEXT, lang="en", slow=False)
    tts.save(OUT_PATH)
    size = os.path.getsize(OUT_PATH)
    print(f"OK: saved {OUT_PATH} ({size} bytes)")
    return OUT_PATH


if __name__ == "__main__":
    main()