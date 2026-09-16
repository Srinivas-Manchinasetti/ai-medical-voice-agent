import { KokoroTTS } from "kokoro-js";
import fs from "fs";

function floatTo16BitPCM(float32Array: Float32Array, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = float32Array.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);

  // fmt subchunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);

  // data subchunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    buffer.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, offset);
    offset += 2;
  }

  return buffer;
}

async function testWavGen() {
  const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype: "q8",
    device: "cpu",
  });

  const rawAudio = await tts.generate("Hello, I am Dr. Sarah Chen.", { voice: "af_heart" });
  const wavBuffer = floatTo16BitPCM(rawAudio.audio, rawAudio.sampling_rate || 24000);

  console.log("Generated WAV Buffer size:", wavBuffer.length, "bytes");
  console.log("RIFF header:", wavBuffer.slice(0, 4).toString());
  console.log("WAVE header:", wavBuffer.slice(8, 12).toString());

  fs.writeFileSync("c:/dev/Capstone/data/test-audio/sarah_chen_test_buffer.wav", wavBuffer);
  console.log("✓ Saved sarah_chen_test_buffer.wav successfully!");
}

testWavGen().catch(console.error);
