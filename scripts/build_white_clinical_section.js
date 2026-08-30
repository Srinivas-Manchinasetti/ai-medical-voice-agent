const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Add CSS for Chapter 04 horizontal layout & the White Clinical Container
const whiteSectionCSS = `
/* ======================== Chapter 04 Horizontal Layout & White Medical Container ======================== */
body[data-layout-closing="b"] .fin {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  text-align: center !important;
  min-height: 80vh !important;
  padding: clamp(60px, 10vh, 120px) var(--pad) clamp(40px, 6vh, 80px) !important;
}

body[data-layout-closing="b"] .fin .eyebrow {
  margin-bottom: 20px !important;
  color: var(--vermilion) !important;
  letter-spacing: 0.24em !important;
}

body[data-layout-closing="b"] .fin h2 {
  writing-mode: horizontal-tb !important;
  font-size: clamp(34px, 4.5vw, 68px) !important;
  line-height: 1.08 !important;
  max-width: 20ch !important;
  margin: 0 auto 24px !important;
  text-shadow: 0 4px 30px rgba(0, 0, 0, 0.9);
}

body[data-layout-closing="b"] .fin p {
  max-width: 48ch !important;
  margin: 0 auto 36px !important;
  font-size: clamp(15px, 1.2vw, 19px) !important;
  line-height: 1.65 !important;
  color: #c2cdc5 !important;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.95);
}

.fin-btn-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
}

.fin-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
  color: #05070a !important;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 16px 32px;
  border-radius: 100px;
  text-decoration: none;
  box-shadow: 0 10px 30px -5px rgba(56, 189, 248, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.4);
  transition: transform 0.3s var(--ease-out), box-shadow 0.3s var(--ease-out);
}

.fin-btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 16px 40px -5px rgba(56, 189, 248, 0.7);
}

.fin-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  background: rgba(223, 231, 224, 0.06);
  border: 1px solid rgba(223, 231, 224, 0.2);
  color: var(--bone) !important;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  padding: 15px 28px;
  border-radius: 100px;
  text-decoration: none;
  backdrop-filter: blur(12px);
  transition: background 0.3s, border-color 0.3s, transform 0.3s;
}

.fin-btn-secondary:hover {
  background: rgba(223, 231, 224, 0.12);
  border-color: rgba(56, 189, 248, 0.5);
  transform: translateY(-2px);
}

/* ========================================================
   WHITE MEDICAL ARCHITECTURE CONTAINER & HOW IT WORKS
   ======================================================== */
.white-medical-container {
  position: relative;
  z-index: 30;
  background: #f8fafc;
  color: #0f172a;
  border-radius: clamp(20px, 3vw, 36px);
  margin: clamp(40px, 8vh, 90px) var(--pad) clamp(60px, 10vh, 120px);
  padding: clamp(40px, 6vw, 90px) clamp(24px, 5vw, 70px);
  box-shadow: 0 35px 80px -20px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.9);
}

.w-head {
  text-align: center;
  max-width: 680px;
  margin: 0 auto clamp(40px, 6vh, 70px);
}

.w-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #0284c7;
  background: rgba(2, 132, 199, 0.08);
  padding: 6px 14px;
  border-radius: 100px;
  margin-bottom: 18px;
}

.w-eyebrow .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0284c7;
}

.w-head h2 {
  font-size: clamp(28px, 3.2vw, 48px);
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #0f172a;
  margin: 0 0 16px;
}

.w-head p {
  font-size: clamp(15px, 1.15vw, 17px);
  line-height: 1.6;
  color: #475569;
  margin: 0;
}

/* 3-Pillar Feature Workflow Cards */
.w-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(20px, 2.5vw, 36px);
  margin-bottom: clamp(40px, 6vh, 60px);
}

.w-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: clamp(24px, 2.5vw, 34px);
  box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.02);
  display: flex;
  flex-direction: column;
  transition: transform 0.35s var(--ease-out), box-shadow 0.35s var(--ease-out), border-color 0.35s;
}

.w-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 22px 45px -10px rgba(15, 23, 42, 0.1), 0 0 0 1px #0284c7;
  border-color: #38bdf8;
}

.w-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.w-num {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #0284c7;
  background: #f0f9ff;
  padding: 4px 10px;
  border-radius: 8px;
}

.w-metric {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.1em;
  color: #059669;
  background: #ecfdf5;
  padding: 4px 10px;
  border-radius: 8px;
}

.w-card h3 {
  font-size: clamp(18px, 1.5vw, 22px);
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  margin: 0 0 12px;
}

.w-card p {
  font-size: 13.5px;
  line-height: 1.6;
  color: #64748b;
  margin: 0 0 20px;
}

.w-feats {
  list-style: none;
  padding: 0;
  margin: auto 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-top: 1px solid #f1f5f9;
  padding-top: 18px;
}

.w-feats li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  font-weight: 500;
  color: #334155;
}

.w-feats li svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
  color: #0284c7;
}

/* Compliance Banner */
.w-trust-bar {
  background: #f1f5f9;
  border-radius: 14px;
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  flex-wrap: wrap;
  gap: 16px;
  border: 1px solid #e2e8f0;
}

.w-trust-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #475569;
  text-transform: uppercase;
}

.w-trust-item span.icon {
  color: #0284c7;
  font-size: 14px;
}

@media (max-width: 1024px) {
  .w-grid { grid-template-columns: 1fr; }
  .white-medical-container { margin: 40px 16px 60px; padding: 36px 20px; }
}
`;

if (!html.includes("WHITE MEDICAL ARCHITECTURE CONTAINER")) {
  html = html.replace("</style>", whiteSectionCSS + "\n</style>");
}

// 2. Redesign Chapter 04 & Add the White Medical Container before the footer
const chapter4AndWhiteSection = `<!-- ============================================================ chapter IV -->
<section class="sec fin" id="eternity" data-cam="4">
  <div class="fg" data-fg="eternity" aria-hidden="true"></div>
  <div class="eyebrow" data-rv="fade">04 · CONNECTED CLINICAL TRIAGE</div>
  <h2 class="display" data-rv="up">READY TO DEPLOY CLINICAL VOICE INTELLIGENCE?</h2>
  <p class="body-lg" data-rv="up">Transform emergency triage, eliminate patient intake wait times, and empower physicians with real-time acoustic biomarker extraction and zero-retention HIPAA compliance.</p>
  <div class="fin-btn-row" data-rv="fade">
    <a class="fin-btn-primary" href="/demo" data-cursor>
      <span>Launch Interactive Demo</span>
      <svg viewBox="0 0 14 14" fill="none" width="12" height="12"><path d="M3 11 11 3M5 3h6v6" stroke="#05070a" stroke-width="1.6"/></svg>
    </a>
    <a class="fin-btn-secondary" href="/care" data-cursor>
      <span>Care Network Locator</span>
      <svg viewBox="0 0 14 14" fill="none" width="12" height="12"><path d="M3 11 11 3M5 3h6v6" stroke="#dfe7e0" stroke-width="1.3"/></svg>
    </a>
  </div>
</section>

<!-- ============================================================ white medical container -->
<section class="white-medical-container" id="how-it-works">
  <div class="w-head">
    <div class="w-eyebrow"><span class="dot"></span> CLINICAL INTELLIGENCE ARCHITECTURE</div>
    <h2>How MedVoice Powers Real-Time Triage</h2>
    <p>An end-to-end voice-native intake and diagnostic pipeline designed for emergency departments, clinics, and telemedicine providers.</p>
  </div>

  <div class="w-grid">
    <!-- Pillar 1 -->
    <div class="w-card">
      <div class="w-card-top">
        <span class="w-num">01 / LISTEN</span>
        <span class="w-metric">&lt; 150ms LATENCY</span>
      </div>
      <h3>Acoustic Biomarker Ingestion</h3>
      <p>16kHz continuous PCM audio ingestion captures speech cadence, respiratory pauses, and vocal tremor before paperwork begins.</p>
      <ul class="w-feats">
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Multi-lingual voice acoustic processing
        </li>
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Respiratory distress frequency scoring
        </li>
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Zero audio retention HIPAA security
        </li>
      </ul>
    </div>

    <!-- Pillar 2 -->
    <div class="w-card">
      <div class="w-card-top">
        <span class="w-num">02 / UNDERSTAND</span>
        <span class="w-metric">99.4% ACCURACY</span>
      </div>
      <h3>Clinical Synthesis & Coding</h3>
      <p>Converts conversational symptom dialogue into standardized ICD-10 diagnostic codes, computes ESI urgency scores, and generates SOAP notes.</p>
      <ul class="w-feats">
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Automated EHR-ready SOAP documentation
        </li>
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Evidence-based ESI Level 1–5 triage rating
        </li>
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          ICD-10 clinical diagnostic mapping
        </li>
      </ul>
    </div>

    <!-- Pillar 3 -->
    <div class="w-card">
      <div class="w-card-top">
        <span class="w-num">03 / ACT</span>
        <span class="w-metric">24/7 DISPATCH</span>
      </div>
      <h3>Care Network & Hospital Routing</h3>
      <p>Dynamic patient routing connected to live hospital bed availability, emergency facilities, and automated paramedic handoff.</p>
      <ul class="w-feats">
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Live ER & ICU bed availability telemetry
        </li>
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          HL7 / FHIR clinical system integration
        </li>
        <li>
          <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
          Automated ambulance and triage dispatch
        </li>
      </ul>
    </div>
  </div>

  <div class="w-trust-bar">
    <div class="w-trust-item"><span class="icon">🔒</span> HIPAA Zero-Retention Certified</div>
    <div class="w-trust-item"><span class="icon">🏥</span> ABDM Compliant</div>
    <div class="w-trust-item"><span class="icon">⚡</span> &lt; 2s Triage Response</div>
    <div class="w-trust-item"><span class="icon">🎯</span> 99.4% Diagnostic Precision</div>
  </div>
</section>`;

const ch4OldRegex = /<!-- ============================================================ chapter IV -->[\s\S]*?<!-- ============================================================ footer -->/;
html = html.replace(ch4OldRegex, chapter4AndWhiteSection + "\n\n<!-- ============================================================ footer -->");

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully built horizontal Chapter 04 and White Medical Architecture container in " + targetFile);
