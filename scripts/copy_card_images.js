const fs = require("fs");
const path = require("path");

const imgDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imgDir, { recursive: true });

const brainDir = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957";
const doctorsSrc = path.join(brainDir, "med_doctors_screen_1787815165678.jpg");
const agentSrc = path.join(brainDir, "med_voice_agent_1787815193652.jpg");
const hospitalSrc = path.join(brainDir, "med_hospital_building_1787815360031.jpg");

// Card 1 (Large left card / Approach / 16kHz PCM): Group of doctors looking at screen
fs.copyFileSync(doctorsSrc, path.join(imgDir, "kage-approach.jpg"));
fs.copyFileSync(doctorsSrc, path.join(imgDir, "kage-sanmon-preview.jpg"));

// Card 2 (Top right card / Lanterns / Biomarkers): Medical voice AI agent on tablet
fs.copyFileSync(agentSrc, path.join(imgDir, "kage-lantern-court.jpg"));

// Card 3 (Bottom right card / Moonwater / ICD-10 Mining): Modern hospital emergency center
fs.copyFileSync(hospitalSrc, path.join(imgDir, "kage-moonwater.jpg"));

console.log("Successfully copied all 3 medical images to public/images/");
