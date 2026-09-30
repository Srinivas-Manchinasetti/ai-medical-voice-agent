import os
import sys
import time

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.services.audio_service import transcribe_audio_bytes

def run_tests():
    print("=================================================================")
    print("      TESTING LOCAL WHISPER ASR & CLINICAL SAFETY INVARIANTS")
    print("=================================================================\n")

    passed = 0
    failed = 0

    def assert_test(cond, name, detail=""):
        nonlocal passed, failed
        if cond:
            print(f"[PASS] {name}")
            passed += 1
        else:
            print(f"[FAIL] {name}: {detail}")
            failed += 1

    # --- Test 1: Real Clinical Audio Transcription ---
    audio_file = "data/test-audio/sarah_chen_turn1_30words.wav"
    assert_test(os.path.exists(audio_file), f"Test audio exists ({audio_file})")

    with open(audio_file, "rb") as f:
        audio_bytes = f.read()

    print(f"\nTranscribing {len(audio_bytes)} bytes using local Whisper base.en...")
    t0 = time.time()
    transcript = transcribe_audio_bytes(audio_bytes, filename="turn1.wav", model_name="base.en")
    latency = time.time() - t0
    print(f"Latency: {latency:.2f} seconds")
    print(f"Transcript: \"{transcript}\"")

    assert_test(len(transcript) > 10, "Transcription produced non-empty text")
    assert_test("chest" in transcript.lower(), "Transcription captured clinical keyword 'chest'")
    assert_test(latency < 15.0, f"Transcription completed within acceptable turn latency (<15s, actual: {latency:.2f}s)")

    # --- Test 2: Safety Invariant — Zero Fabricated Clinical Transcripts ---
    print("\nVerifying safety invariant: Zero fabricated clinical symptoms on failure...")
    
    # 2a. Empty bytes
    empty_error_raised = False
    try:
        transcribe_audio_bytes(b"", filename="empty.wav")
    except ValueError as ve:
        empty_error_raised = True
        assert_test("empty" in str(ve).lower(), "Explicit error raised for empty audio buffer")
    except Exception as e:
        empty_error_raised = True
        print(f"Empty buffer error: {e}")
    assert_test(empty_error_raised, "Empty audio buffer rejected with explicit error")

    # 2b. Corrupted / invalid audio bytes
    corrupt_error_raised = False
    fake_symptoms_detected = False
    try:
        corrupt_bytes = b"NOT_A_VALID_AUDIO_FILE_JUST_CORRUPTED_BYTES"
        res = transcribe_audio_bytes(corrupt_bytes, filename="corrupt.wav")
        # Check if the old dangerous fallback text was returned
        if "chest pressure and difficulty breathing" in res.lower():
            fake_symptoms_detected = True
    except Exception as e:
        corrupt_error_raised = True

    assert_test(corrupt_error_raised, "Corrupted audio buffer rejected with explicit exception")
    assert_test(not fake_symptoms_detected, "Zero fabricated clinical symptoms returned on ASR failure")

    print("\n=================================================================")
    print(f"TEST SUMMARY: {passed} PASSED, {failed} FAILED")
    print("=================================================================")
    if failed > 0:
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
