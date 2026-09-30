import time
import os
import whisper

def main():
    print("=================================================================")
    print("        LOCAL OPENAI WHISPER ASR BENCHMARK (base.en)")
    print("=================================================================")
    audio_path = "data/test-audio/sarah_chen_turn1_30words.wav"
    if not os.path.exists(audio_path):
        print(f"Error: {audio_path} does not exist")
        return

    # Check file size
    file_size_kb = os.path.getsize(audio_path) / 1024
    print(f"Test audio: {audio_path} ({file_size_kb:.1f} KB)")

    # 1. Benchmark Model Load
    print("\nLoading model 'base.en'...")
    t0 = time.time()
    model = whisper.load_model("base.en")
    load_time = time.time() - t0
    print(f"[OK] Model loaded in {load_time:.2f} seconds")

    # 2. Benchmark Cold Transcription
    print("\nRunning Cold Transcription Turn 1...")
    t1 = time.time()
    result_cold = model.transcribe(audio_path)
    cold_time = time.time() - t1
    print(f"[OK] Cold Transcription in {cold_time:.2f} seconds")
    print(f"Transcript: \"{result_cold['text'].strip()}\"")

    # 3. Benchmark Warm Transcription
    print("\nRunning Warm Transcription Turn 2 (simulating active consult)...")
    t2 = time.time()
    result_warm = model.transcribe(audio_path)
    warm_time = time.time() - t2
    print(f"[OK] Warm Transcription in {warm_time:.2f} seconds")
    print(f"Transcript: \"{result_warm['text'].strip()}\"")

    print("\n-----------------------------------------------------------------")
    print(f"Summary: Load: {load_time:.2f}s | Cold: {cold_time:.2f}s | Warm: {warm_time:.2f}s")
    print("-----------------------------------------------------------------")

if __name__ == "__main__":
    main()
