const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Add CSS for Chapter 01 HUD Cards and Layout
const chapter1CustomCSS = `
/* ======================== Chapter 01 MedVoice Intake HUD ======================== */
.gate-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--vermilion);
  margin-bottom: 20px;
}

.gate-tag .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--vermilion);
  box-shadow: 0 0 10px var(--vermilion);
}

.ch1-hud-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: clamp(260px, 25vw, 340px);
  position: absolute;
  right: clamp(20px, 4vw, 60px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 5;
}

.ch1-card {
  background: rgba(8, 14, 22, 0.82);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 14px;
  padding: 14px 18px;
  box-shadow: 0 15px 35px -10px rgba(0, 0, 0, 0.8), 0 0 25px -5px rgba(14, 165, 233, 0.18);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ch1-card-head {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ch1-card-icon {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ch1-card-title b {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #e2e8f0;
}

.ch1-card-title p {
  margin: 0;
  font-size: 9px;
  color: #94a3b8;
}

.ch1-wave {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 2px;
}

.ch1-wave span {
  width: 2.5px;
  height: var(--h, 12px);
  background: linear-gradient(180deg, #38bdf8 0%, #0369a1 100%);
  border-radius: 2px;
  animation: wavePulse 1.2s infinite ease-in-out alternate;
  animation-delay: var(--d, 0s);
}

.ch1-checklist {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.ch1-check-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.06em;
  color: #cbd5e1;
}

.ch1-check-icon {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(56, 189, 248, 0.2);
  border: 1px solid rgba(56, 189, 248, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #38bdf8;
  font-size: 9px;
  font-weight: 700;
}

.ch1-priority {
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid rgba(223, 231, 224, 0.1);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.ch1-priority-tag {
  font-size: 9px;
  letter-spacing: 0.16em;
  color: #94a3b8;
  font-weight: 600;
}

.ch1-priority-val {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  color: #ef4444;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ch1-priority-val .p-pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
  animation: redPulse 1.4s infinite ease-in-out alternate;
}

@keyframes redPulse {
  0% { transform: scale(0.8); opacity: 0.6; }
  100% { transform: scale(1.4); opacity: 1; filter: drop-shadow(0 0 8px #ef4444); }
}

@media (max-width: 900px) {
  .ch1-hud-stack { display: none; }
}
`;

// Clean up old CSS
if (html.includes(".fg-doctor")) {
  const cssStart = html.indexOf("/* ======================== Chapter 01 Doctor & Medicine");
  const cssEnd = html.indexOf("</style>");
  if (cssStart !== -1) {
    html = html.substring(0, cssStart) + chapter1CustomCSS.trim() + "\n" + html.substring(cssEnd);
  }
} else {
  html = html.replace("</style>", chapter1CustomCSS + "\n</style>");
}

// 2. Update Chapter 01 HTML matching Image 1
const oldChapter1Regex = /<!-- ============================================================ chapter I -->[\s\S]*?<!-- ============================================================ chapter II -->/;
const newChapter1 = `<!-- ============================================================ chapter I -->
<section class="sec" id="gate" data-cam="1">
  <div class="sec-head" data-rv="fade">
    <span class="k"><b>01</b> — Intake Protocol</span><span class="rule"></span><span class="k">ACOUSTICS</span>
  </div>
  <div class="gate-grid">
    <div class="gate-tag" data-rv="fade"><span class="dot"></span> 01 · INTAKE</div>
    <h2 class="display h-sec" data-rv="up">CLINICAL SPEECH CAPTURE, BIOMARKER <span class="h-grad">MINING, ZERO LATENCY.</span></h2>
    <div class="gate-copy">
      <p class="lead" data-rv="up">Real-time clinical voice intelligence, acoustic biomarker extraction, and automated triage — designed for human-first care.</p>
      <p class="body" data-rv="up">Continuous 16kHz speech ingestion captures vocal tremor, speech rate, and respiratory pauses to predict clinical urgency before patient intake paperwork is opened. Certified zero-retention HIPAA and ABDM compliant.</p>
      <a class="arrowlink" href="/demo" data-rv="fade" data-cursor>
        <span>Launch triage intake demo</span>
        <span class="ar"><svg viewBox="0 0 14 14" fill="none"><path d="M3 11 11 3M5 3h6v6" stroke="#dfe7e0" stroke-width="1.3"/></svg></span>
      </a>
    </div>
  </div>

  <!-- Futuristic Clinical HUD Stack matching Image 1 -->
  <div class="ch1-hud-stack" data-rv="fade">
    <div class="ch1-card">
      <div class="ch1-card-head">
        <div class="ch1-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" width="14" height="14"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
        </div>
        <div class="ch1-card-title">
          <b>AI VOICE TRIAGE</b>
          <p>Intelligent. Instant. Human-first.</p>
        </div>
      </div>
      <div class="ch1-wave">
        <span style="--d:0.1s; --h:12px;"></span>
        <span style="--d:0.3s; --h:20px;"></span>
        <span style="--d:0.15s; --h:8px;"></span>
        <span style="--d:0.4s; --h:24px;"></span>
        <span style="--d:0.25s; --h:16px;"></span>
        <span style="--d:0.5s; --h:22px;"></span>
        <span style="--d:0.2s; --h:10px;"></span>
        <span style="--d:0.35s; --h:18px;"></span>
        <span style="--d:0.18s; --h:14px;"></span>
        <span style="--d:0.45s; --h:20px;"></span>
      </div>
    </div>

    <div class="ch1-card">
      <div class="ch1-card-head">
        <div class="ch1-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
        </div>
        <div class="ch1-card-title">
          <b>BIOMARKER SIGNAL</b>
          <p>Real-time frequency telemetry</p>
        </div>
      </div>
      <div class="ch1-wave">
        <span style="--d:0.2s; --h:14px;"></span>
        <span style="--d:0.4s; --h:22px;"></span>
        <span style="--d:0.1s; --h:18px;"></span>
        <span style="--d:0.3s; --h:10px;"></span>
        <span style="--d:0.5s; --h:24px;"></span>
        <span style="--d:0.25s; --h:16px;"></span>
        <span style="--d:0.35s; --h:20px;"></span>
        <span style="--d:0.15s; --h:8px;"></span>
      </div>
    </div>

    <div class="ch1-card">
      <div class="ch1-card-head">
        <div class="ch1-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
        <div class="ch1-card-title">
          <b>NLP EXTRACTION</b>
          <p>ICD-10 clinical mapping</p>
        </div>
      </div>
      <div class="ch1-checklist">
        <div class="ch1-check-item"><span class="ch1-check-icon">✓</span> Chest Pain (I20.9)</div>
        <div class="ch1-check-item"><span class="ch1-check-icon">✓</span> Dyspnea / Breath (R06.0)</div>
        <div class="ch1-check-item"><span class="ch1-check-icon">✓</span> Radiating Pain (M79.6)</div>
      </div>
      <div class="ch1-priority">
        <span class="ch1-priority-tag">TRIAGE PRIORITY</span>
        <span class="ch1-priority-val"><span class="p-pulse"></span> HIGH (ESI 2)</span>
      </div>
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

// 3. Update buildTemple to transition between Chapter 00 (Hospital Wide) and Chapter 01 (Intake Beauty Pass)
const updatedBuildTemple = `/* ======================================================= 4 · hospital center & intake */
function buildTemple() {
  const g = new THREE.Group();
  
  const texLoader = new THREE.TextureLoader();
  
  // Chapter 00 Wide Hospital View
  const heroTex = texLoader.load('/images/medvoice-hospital-hero.jpg');
  heroTex.encoding = THREE.sRGBEncoding;
  heroTex.generateMipmaps = false;
  heroTex.minFilter = THREE.LinearFilter;
  heroTex.magFilter = THREE.LinearFilter;

  // Chapter 01 Doctor & Levitating Medicine Beauty Pass View
  const ch1Tex = texLoader.load('/images/medvoice-chapter1-hero.jpg');
  ch1Tex.encoding = THREE.sRGBEncoding;
  ch1Tex.generateMipmaps = false;
  ch1Tex.minFilter = THREE.LinearFilter;
  ch1Tex.magFilter = THREE.LinearFilter;

  const planeW = 112, planeH = 63;
  
  // Chapter 00 Plane
  const heroPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({ map: heroTex, transparent: true, depthWrite: true, fog: false, opacity: 1 })
  );
  heroPlane.position.set(0, 17.0, -58);
  g.add(heroPlane);
  WORLD.heroPlane = heroPlane;

  // Chapter 01 Plane (Cross-fades seamlessly with scroll progress)
  const ch1Plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({ map: ch1Tex, transparent: true, depthWrite: false, fog: false, opacity: 0 })
  );
  ch1Plane.position.set(0, 17.0, -57.8);
  g.add(ch1Plane);
  WORLD.ch1Plane = ch1Plane;

  // Subtle Rooftop Cross Glow Enhancement
  const crossGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({
      map: tx(texGlow('rgba(56,189,248,0.95)', 'rgba(2,132,199,0.25)')),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.6
    })
  );
  crossGlow.position.set(0, 36.5, -57.5);
  crossGlow.renderOrder = 3;
  g.add(crossGlow);

  WORLD.templeTop = 38;
  scene.add(g);
  WORLD.temple = g;
}`;

// Replace buildTemple block
const templeStart = html.indexOf("/* ======================================================= 4 · hospital center */");
const moonStart = html.indexOf("/* --------------------------------------------------- moon & portal handles */");

if (templeStart !== -1 && moonStart !== -1) {
  html = html.substring(0, templeStart) + updatedBuildTemple + "\n\n" + html.substring(moonStart);
}

// 4. Update updateWorld to cross-fade between Chapter 00 and Chapter 01
const updateWorldHook = `
    // Cross-fade backdrop between Chapter 00 (Overview) and Chapter 01 (Physician & Levitating Meds)
    if (WORLD.heroPlane && WORLD.ch1Plane && typeof RIG !== 'undefined') {
      const p = RIG.smooth || 0;
      // Fade in Chapter 01 from scroll 0.08 to 0.28
      const ch1Alpha = clamp((p - 0.05) / 0.20, 0, 1);
      WORLD.ch1Plane.material.opacity = ch1Alpha;
      WORLD.heroPlane.material.opacity = 1 - ch1Alpha * 0.9;
    }
`;

if (!html.includes("WORLD.ch1Plane.material.opacity")) {
  const renderLoopSpot = html.indexOf("function updateWorld(dt) {");
  if (renderLoopSpot !== -1) {
    html = html.substring(0, renderLoopSpot + 26) + updateWorldHook + html.substring(renderLoopSpot + 26);
  }
}

// 5. Clean up old processAlphaCutout if present
if (html.includes("function processAlphaCutout")) {
  const alphaStart = html.indexOf("/* --------------------------------------------------- alpha cutout processor */");
  const bootStart = html.indexOf("function boot()");
  if (alphaStart !== -1 && bootStart !== -1) {
    html = html.substring(0, alphaStart) + html.substring(bootStart);
  }
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully applied Chapter 01 beauty pass and HUD in " + targetFile);
