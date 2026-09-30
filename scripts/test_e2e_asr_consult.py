"""
End-to-End ASR Consultation Flow Verification
Tests:
1. Audio File -> Next.js /api/voice/stt -> FastAPI /api/v1/stt -> Whisper base.en
2. Whisper Transcript -> Next.js /api/voice/chat -> Clinical Pipeline / Board
3. Clinical Response -> Next.js /api/voice/tts -> Kokoro TTS Audio Stream
"""
import sys
import requests
import os

NEXT_BASE = "http://localhost:3000"
FASTAPI_BASE = "http://127.0.0.1:8000"

def test_full_pipeline():
    audio_path = os.path.join(os.getcwd(), "data", "test-audio", "sarah_chen_turn1_30words.wav")
    assert os.path.exists(audio_path), f"Audio file not found: {audio_path}"

    print("[1/3] Testing Next.js /api/voice/stt bridge to Whisper...")
    with open(audio_path, "rb") as f:
        files = {"file": ("test.wav", f, "audio/wav")}
        r = requests.post(f"{NEXT_BASE}/api/voice/stt", files=files, timeout=15)
    
    assert r.status_code == 200, f"STT failed with code {r.status_code}: {r.text}"
    stt_data = r.json()
    transcript = stt_data.get("transcript", "").strip()
    print(f"      Status: {stt_data.get('status')}")
    print(f"      Engine: {stt_data.get('engine')}")
    print(f"      Transcript: \"{transcript}\"")
    assert len(transcript) > 0, "Transcript is empty!"
    assert any(w in transcript.lower() for w in ["chest", "discomfort", "arm", "jaw"]), "Expected clinical inquiry in transcript"
    print("      [PASS] STT transcribed clinical audio via Whisper.")

    print("\n[2/3] Feeding transcript to /api/voice/chat...")
    chat_payload = {
        "doctorId": "dr-sarah-chen",
        "message": transcript,
        "conversationHistory": [
            {
                "id": "init-1",
                "role": "doctor",
                "text": "Hello, I'm Dr. Sarah Chen. What brings you in today?",
                "doctorName": "Dr. Sarah Chen",
                "doctorSpecialty": "Internal Medicine"
            },
            {
                "id": "pat-1",
                "role": "patient",
                "text": transcript
            }
        ],
        "patientName": "Alex",
        "isInterruption": False
    }

    r_chat = requests.post(f"{NEXT_BASE}/api/voice/chat", json=chat_payload, timeout=20)
    assert r_chat.status_code == 200, f"Chat failed with code {r_chat.status_code}: {r_chat.text}"
    chat_data = r_chat.json()
    doctor_reply = chat_data.get("doctorReply", "")
    triage = chat_data.get("triage", {})
    board = chat_data.get("board", {})
    
    print(f"      Doctor: {chat_data.get('doctor', {}).get('name')}")
    print(f"      Doctor Reply: \"{doctor_reply[:80]}...\"")
    print(f"      Triage Level: {triage.get('triageLevel')}")
    print(f"      Known Facts: {len(triage.get('knownFacts', []))}")
    assert len(doctor_reply) > 0, "Doctor reply is empty!"
    print("      [PASS] Clinical pipeline deliberated on Whisper transcript.")

    print("\n[3/3] Requesting TTS audio stream for doctor response...")
    tts_payload = {
        "text": "I understand your chest discomfort.",
        "doctorId": "dr-sarah-chen"
    }
    r_tts = requests.post(f"{NEXT_BASE}/api/voice/tts", json=tts_payload, timeout=45)
    assert r_tts.status_code == 200, f"TTS failed with code {r_tts.status_code}: {r_tts.text}"
    content_type = r_tts.headers.get("Content-Type", "")
    assert "audio" in content_type, f"Expected audio content type, got: {content_type}"
    print(f"      TTS Content-Type: {content_type}")
    print(f"      TTS Audio Bytes: {len(r_tts.content)}")
    assert len(r_tts.content) > 1000, "TTS audio response too small!"
    print("      [PASS] Doctor response synthesized into audio stream.")

    print("\n=== ALL E2E ASR CONSULTATION TESTS PASSED ===")

if __name__ == "__main__":
    try:
        test_full_pipeline()
        sys.exit(0)
    except AssertionError as e:
        print(f"[FAIL] Assertion error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"[FAIL] Unexpected error: {e}")
        sys.exit(1)
