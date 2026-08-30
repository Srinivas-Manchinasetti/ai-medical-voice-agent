const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Remove <base href="...">
html = html.replace(/<base href="https:\/\/threeui\.com\/landing-pages\/">\s*/g, "");

// 2. Replace secret-pathways-assets/ with full CDN URL
html = html.replaceAll("secret-pathways-assets/", "https://threeui.com/landing-pages/secret-pathways-assets/");

// 3. Replace all Japanese phrases with English clinical terminology
const replacements = [
  { from: /<span class="p-jp jp">診療所<\/span>/g, to: '<span class="p-jp">TRIAGE</span>' },
  { from: /<span class="p-alt jp">実演模擬<\/span>/g, to: '<span class="p-alt">LIVE DEMO</span>' },
  { from: /<span class="p-alt jp">救急医療<\/span>/g, to: '<span class="p-alt">HOSPITALS</span>' },
  { from: /<span class="p-alt jp">暗号保護<\/span>/g, to: '<span class="p-alt">SECURITY</span>' },
  
  // Hero preview badge & side text
  { from: /<b class="jp">山門<\/b><i>Sanmon — before the bell<\/i>/g, to: '<b>VOICE</b><i>16kHz Acoustic Intake</i>' },
  { from: /<span class="v jp">影の道<\/span>/g, to: '<span class="v">MEDVOICE AI</span>' },
  
  // Chapter markers & cards
  { from: /<span class="k jp">山門<\/span>/g, to: '<span class="k">INTAKE</span>' },
  { from: /<span class="k jp">庭園<\/span>/g, to: '<span class="k">TRIAGE</span>' },
  { from: /<span class="jp">参道<\/span>/g, to: '<span>16kHz PCM</span>' },
  { from: /<span class="jp">灯籠<\/span>/g, to: '<span>BIOMARKERS</span>' },
  { from: /<span class="jp">月影<\/span>/g, to: '<span>ICD-10 MINING</span>' },
  
  // Chapter III syllabus
  { from: /<span class="k jp">手業<\/span>/g, to: '<span class="k">CLINICAL ENGINE</span>' },
  { from: /<em class="jp">山門<\/em>/g, to: '<em>VOICE STREAM</em>' },
  { from: /<em class="jp">借景<\/em>/g, to: '<em>BIOMARKERS</em>' },
  { from: /<em class="jp">焼杉<\/em>/g, to: '<em>ICD-10 MINING</em>' },
  { from: /<em class="jp">灯籠<\/em>/g, to: '<em>SOAP NOTES</em>' },
  { from: /<em class="jp">朱月<\/em>/g, to: '<em>EMERGENCY DISPATCH</em>' },
  
  // Footer quote
  { from: /<span class="jp">静けさは一つの技である<\/span>/g, to: '<span>REAL-TIME CLINICAL VOICE INTELLIGENCE</span>' },

  // Remaining Japanese characters if any
  { from: /影の道/g, to: 'MEDVOICE' },
  { from: /山門/g, to: 'INTAKE' },
  { from: /庭園/g, to: 'TRIAGE' },
  { from: /神事/g, to: 'ENGINE' },
  { from: /残光/g, to: 'CARE' },
  { from: /伽藍/g, to: 'OVERVIEW' },
  { from: /手業/g, to: 'CLINICAL' }
];

for (const rep of replacements) {
  html = html.replace(rep.from, rep.to);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully replaced all Japanese text with English clinical terms and fixed link routing in " + targetFile);
