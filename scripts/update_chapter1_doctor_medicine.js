const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Add CSS for fg-doctor and fg-medicine
const fgDoctorCSS = `
/* ======================== Chapter 01 Doctor & Medicine Cutouts ======================== */
[data-fg="gate"] .fg-doctor {
  left: 1%;
  bottom: -20px;
  width: clamp(240px, 26vw, 420px);
  mix-blend-mode: screen;
  filter: contrast(1.12) brightness(1.05);
  pointer-events: none;
}

[data-fg="gate"] .fg-medicine {
  right: 1%;
  bottom: -30px;
  width: clamp(250px, 27vw, 430px);
  mix-blend-mode: screen;
  filter: contrast(1.12) brightness(1.05);
  pointer-events: none;
}

@media (max-width: 820px) {
  [data-fg="gate"] .fg-doctor,
  [data-fg="gate"] .fg-medicine {
    display: none;
  }
}
`;

if (!html.includes(".fg-doctor")) {
  html = html.replace("</style>", fgDoctorCSS + "\n</style>");
}

// 2. Replace Chapter 01 markup
const oldChapter1Regex = /<!-- ============================================================ chapter I -->[\s\S]*?<!-- ============================================================ chapter II -->/;
const newChapter1 = `<!-- ============================================================ chapter I -->
<section class="sec" id="gate" data-cam="1">
  <!-- foreground: professional doctor on left, medicine kit on right -->
  <div class="fg" data-fg="gate" aria-hidden="true">
    <span class="fg-el fg-doctor" data-fg-in="left">
      <img src="/images/doctor-foreground.jpg" alt="Clinical Physician" width="800" height="1066" loading="lazy" decoding="async">
    </span>
    <span class="fg-el fg-medicine" data-fg-in="right">
      <img src="/images/medicine-foreground.jpg" alt="Clinical Telemetry & Diagnostics" width="800" height="1066" loading="lazy" decoding="async">
    </span>
  </div>
  <div class="sec-head" data-rv="fade">
    <span class="k"><b>01</b> — Intake Protocol</span><span class="rule"></span><span class="k">ACOUSTICS</span>
  </div>
  <div class="gate-grid">
    <h2 class="display h-sec" data-rv="up">Clinical speech capture, biomarker mining, zero latency.</h2>
    <div class="gate-copy">
      <p class="lead" data-rv="up">MedVoice begins at the point of vocal contact. Continuous 16kHz speech ingestion measures vocal tremor, respiratory distress, and speech rate to predict clinical urgency before patient intake paperwork is even opened.</p>
      <p class="body" data-rv="up">Our clinical NLP pipeline maps conversational symptoms directly to standardized ICD-10 diagnostic codes, generating structured SOAP notes and ESI urgency scores with 99.4% precision. Certified zero-retention HIPAA and ABDM compliant.</p>
      <a class="arrowlink" href="/demo" data-rv="fade" data-cursor>
        <span>Launch triage intake demo</span>
        <span class="ar"><svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="#dfe7e0" stroke-width="1.3"/></svg></span>
      </a>
    </div>
  </div>
  <div class="gate-stats" data-rv="up">
    <div><b>16</b><span>kHz PCM Audio</span></div>
    <div><b>&lt; 2s</b><span>Triage Latency</span></div>
    <div><b>99.4%</b><span>ICD-10 Precision</span></div>
    <div><b>24/7</b><span>Care Dispatch</span></div>
  </div>
</section>

<!-- ============================================================ chapter II -->`;

html = html.replace(oldChapter1Regex, newChapter1);

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully updated Chapter 01 with Doctor and Medicine cutouts in " + targetFile);
