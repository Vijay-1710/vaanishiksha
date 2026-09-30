"""
Text-to-Speech service for generating dubbed audio.

For MVP: Using Google's TTS API or Coqui TTS with multi-language support.
For production: Should integrate AI4Bharat IndicTTS for better Indian language support.
"""
from gtts import gTTS
import os


def text_to_speech(text: str, language: str, output_path: str) -> str:
    """
    Convert text to speech audio file.
    
    Args:
        text: Text to convert
        language: Target language ISO code
        output_path: Where to save the audio file
    
    Returns:
        Path to generated audio file
    """
    # Map our language codes to gTTS language codes
    lang_map = {
        "en": "en",
        "hi": "hi",
        "ta": "ta",
        "te": "te",
        "kn": "kn",
        "bn": "bn"
    }
    
    gtts_lang = lang_map.get(language, language)
    
    try:
        # Generate speech
        tts = gTTS(text=text, lang=gtts_lang, slow=False)
        tts.save(output_path)
        return output_path
    
    except Exception as e:
        print(f"gTTS failed for language {language}: {e}")
        # Fall back to English if language not supported
        if language != "en":
            print("Falling back to English TTS")
            tts = gTTS(text=text, lang="en", slow=False)
            tts.save(output_path)
            return output_path
        raise


def text_to_speech_with_timestamps(text: str, language: str, output_path: str):
    """
    Generate TTS with word-level timestamps for subtitle synchronization.
    
    This is a more advanced feature needed for proper caption sync.
    Requires a more sophisticated TTS engine than gTTS.
    
    TODO: Implement with a TTS engine that supports timestamp output
    (e.g., Coqui TTS, Azure TTS, or custom IndicTTS)
    """
    # For now, use basic TTS
    return text_to_speech(text, language, output_path)


# In-memory cache for live spoken translations
_tts_cache: dict[str, bytes] = {}
_MAX_CACHE_SIZE = 500


def get_tts_audio_bytes(text: str, language: str) -> bytes:
    """
    Generate MP3 audio bytes in-memory for instant streaming to live clients.
    Uses in-memory cache to ensure repeated sentences return in <5ms.
    """
    import io
    import hashlib

    cleaned_text = text.strip()
    if not cleaned_text:
        return b""

    # Cache key based on language and normalized text
    cache_key = hashlib.md5(f"{language}:{cleaned_text}".encode("utf-8")).hexdigest()
    if cache_key in _tts_cache:
        return _tts_cache[cache_key]

    lang_map = {
        "en": "en",
        "hi": "hi",
        "ta": "ta",
        "te": "te",
        "kn": "kn",
        "bn": "bn",
    }
    gtts_lang = lang_map.get(language, language)

    fp = io.BytesIO()
    try:
        tts = gTTS(text=cleaned_text, lang=gtts_lang, slow=False)
        tts.write_to_fp(fp)
    except Exception as e:
        # Fall back to English if requested language fails
        try:
            fp = io.BytesIO()
            tts = gTTS(text=cleaned_text, lang="en", slow=False)
            tts.write_to_fp(fp)
        except Exception:
            return b""

    fp.seek(0)
    audio_data = fp.read()

    # Store in cache with simple size management
    if len(_tts_cache) >= _MAX_CACHE_SIZE:
        # Evict some entries
        for _ in range(50):
            try:
                _tts_cache.pop(next(iter(_tts_cache)))
            except (StopIteration, KeyError):
                break

    _tts_cache[cache_key] = audio_data
    return audio_data

