const fs = require("fs");
const path = require("path");

const imgDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imgDir, { recursive: true });

const brainDir = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957";
const docSrc = path.join(brainDir, "med_doctor_cutout_1787831914970.jpg");
const medSrc = path.join(brainDir, "med_medicine_kit_cutout_1787831941509.jpg");

fs.copyFileSync(docSrc, path.join(imgDir, "doctor-foreground.jpg"));
fs.copyFileSync(medSrc, path.join(imgDir, "medicine-foreground.jpg"));

console.log("Successfully copied doctor and medicine images to public/images/");
