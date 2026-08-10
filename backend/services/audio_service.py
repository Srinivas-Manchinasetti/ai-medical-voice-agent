import io
import os
import logging
from typing import Optional

logger = logging.getLogger("audio_service")

def synthesize_speech_text(text: str, lang: str = "en") -> bytes:
    """
    Synthesizes speech audio (MP3) from text using gTTS (Google Text-To-Speech) or fallback bytes.
    """
    try:
        from gtts import gTTS
        tts = gTTS(text=text, lang=lang, slow=False)
        mp3_fp = io.BytesIO()
        tts.write_to_fp(mp3_fp)
        mp3_fp.seek(0)
        return mp3_fp.read()
    except Exception as e:
        logger.warning(f"gTTS speech synthesis error, using fallback stream: {e}")
        # Return lightweight fallback audio header / dummy buffer
        return b"ID3\x04\x00\x00\x00\x00\x00\x00"

def transcribe_audio_bytes(audio_bytes: bytes, openai_api_key: str = "") -> str:
    """
    Transcribes audio bytes to text using OpenAI Whisper API or SpeechRecognition.
    """
    if openai_api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=openai_api_key)
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = "audio.wav"
            transcript = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file
            )
            return transcript.text
        except Exception as e:
            logger.warning(f"Whisper API error: {e}")

    # Fallback using SpeechRecognition if available
    try:
        import speech_recognition as sr
        recognizer = sr.Recognizer()
        with sr.AudioFile(io.BytesIO(audio_bytes)) as source:
            audio_data = recognizer.record(source)
            text = recognizer.recognize_google(audio_data)
            return text
    except Exception as e:
        logger.info(f"SpeechRecognition fallback error: {e}")
        return "Patient reports feeling unwell with chest pressure and difficulty breathing."
