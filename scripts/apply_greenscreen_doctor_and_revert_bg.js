const fs = require("fs");
const path = require("path");

const imgDir = path.join(process.cwd(), "public", "images");
fs.mkdirSync(imgDir, { recursive: true });

const brainDir = "C:\\Users\\punee\\.gemini\\antigravity\\brain\\aa991c70-dfe8-4532-8b01-f5fda716f957";
const docSrc = path.join(brainDir, "new_doctor_greenscreen_1787840038351.jpg");
const medSrc = path.join(brainDir, "new_simple_medicine_greenscreen_1787840068022.jpg");

fs.copyFileSync(docSrc, path.join(imgDir, "doctor-greenscreen.jpg"));
fs.copyFileSync(medSrc, path.join(imgDir, "medicine-greenscreen.jpg"));

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Revert buildTemple back to single clean 3D hospital hero visual
const revertedBuildTemple = `/* ======================================================= 4 · hospital center */
function buildTemple() {
  const g = new THREE.Group();
  
  const texLoader = new THREE.TextureLoader();
  const hospitalTex = texLoader.load('/images/medvoice-hospital-hero.jpg');
  hospitalTex.encoding = THREE.sRGBEncoding;
  hospitalTex.generateMipmaps = false;
  hospitalTex.minFilter = THREE.LinearFilter;
  hospitalTex.magFilter = THREE.LinearFilter;

  // Exact 16:9 wide aspect ratio matching camera FOV
  const planeW = 112, planeH = 63;
  const hospitalPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({
      map: hospitalTex,
      transparent: false,
      depthWrite: true,
      fog: false
    })
  );
  hospitalPlane.position.set(0, 17.0, -58);
  g.add(hospitalPlane);

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
const templeStart = html.indexOf("/* ======================================================= 4 · hospital center");
const moonStart = html.indexOf("/* --------------------------------------------------- moon & portal handles */");

if (templeStart !== -1 && moonStart !== -1) {
  html = html.substring(0, templeStart) + revertedBuildTemple + "\n\n" + html.substring(moonStart);
}

// Remove the crossfade from updateWorld if present
html = html.replace(/if \(WORLD\.heroPlane && WORLD\.ch1Plane[\s\S]*?}/g, '');

// 2. Add Green-Screen Chroma Keyer in JS
const chromaKeyerCode = `
/* --------------------------------------------------- chroma key cutout processor */
function processGreenChroma(imgEl) {
  if (!imgEl) return;
  const rawImg = new Image();
  rawImg.crossOrigin = 'anonymous';
  rawImg.onload = () => {
    const c = document.createElement('canvas');
    c.width = rawImg.naturalWidth || rawImg.width;
    c.height = rawImg.naturalHeight || rawImg.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(rawImg, 0, 0);
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    const d = imgData.data;

    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // Accurate chroma key for bright studio green background
      if (g > 65 && g > r * 1.18 && g > b * 1.18) {
        d[i + 3] = 0; // Pure transparent background
      } else {
        d[i + 3] = 255; // 100% Solid Opaque Subject (hair, clothes, skin, stethoscope)
        // Despill green rim
        if (g > r && g > b && g > 60) {
          d[i + 1] = Math.round((r + b) / 2);
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
    imgEl.src = c.toDataURL('image/png');
    imgEl.style.opacity = '1';
  };
  rawImg.src = imgEl.src;
}

function initForegroundAlpha() {
  const docImg = document.querySelector('[data-fg="gate"] .fg-doctor img');
  const medImg = document.querySelector('[data-fg="gate"] .fg-medicine img');
  if (docImg) processGreenChroma(docImg);
  if (medImg) processGreenChroma(medImg);
}
`;

// Insert chromaKeyerCode
if (html.includes("function initForegroundAlpha()")) {
  const alphaStart = html.indexOf("function initForegroundAlpha()");
  const bootStart = html.indexOf("function boot()", alphaStart);
  html = html.substring(0, alphaStart) + chromaKeyerCode.trim() + "\n\n" + html.substring(bootStart);
} else {
  html = html.replace("function boot() {", chromaKeyerCode + "\n\nfunction boot() {\n  try { initForegroundAlpha(); } catch(e) { console.warn(e); }");
}

// 3. Update Chapter 01 HTML with fg doctor and floating medicine
const chapter1Markup = `<!-- ============================================================ chapter I -->
<section class="sec" id="gate" data-cam="1">
  <!-- foreground: friendly doctor with 100% opaque ponytail on left, sleek floating medicine on right -->
  <div class="fg" data-fg="gate" aria-hidden="true">
    <span class="fg-el fg-doctor" data-fg-in="left">
      <img src="/images/doctor-greenscreen.jpg" alt="Clinical Physician" width="800" height="1066" loading="lazy" decoding="async" style="opacity: 0; transition: opacity 0.3s;">
    </span>
    <span class="fg-el fg-medicine" data-fg-in="right">
      <img src="/images/medicine-greenscreen.jpg" alt="Levitating Clinical Medicine" width="800" height="1066" loading="lazy" decoding="async" style="opacity: 0; transition: opacity 0.3s;">
    </span>
  </div>
  <div class="sec-head" data-rv="fade">
    <span class="k"><b>01</b> — Intake Protocol</span><span class="rule"></span><span class="k">ACOUSTICS</span>
  </div>
  <div class="gate-grid">
    <div class="gate-tag" data-rv="fade"><span class="dot"></span> 01 · INTAKE</div>
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

const oldChapter1Regex = /<!-- ============================================================ chapter I -->[\s\S]*?<!-- ============================================================ chapter II -->/;
html = html.replace(oldChapter1Regex, chapter1Markup);

// 4. Update CSS for .fg-doctor and .fg-medicine
const updatedCSS = `
/* ======================== Chapter 01 Doctor & Medicine Alpha Overlays ======================== */
[data-fg="gate"] .fg-doctor {
  left: 1%;
  bottom: -15px;
  width: clamp(230px, 26vw, 410px);
  pointer-events: none;
  z-index: 10;
}

[data-fg="gate"] .fg-medicine {
  right: 2%;
  bottom: 10px;
  width: clamp(220px, 24vw, 380px);
  pointer-events: none;
  z-index: 10;
  animation: floatLevitate 5s ease-in-out infinite;
}

@keyframes floatLevitate {
  0% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-16px) rotate(2deg); }
  100% { transform: translateY(0px) rotate(0deg); }
}

[data-fg="gate"] .fg-doctor img,
[data-fg="gate"] .fg-medicine img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 15px 35px rgba(0, 0, 0, 0.9)) drop-shadow(0 0 25px rgba(56, 189, 248, 0.18));
}

@media (max-width: 820px) {
  [data-fg="gate"] .fg-doctor,
  [data-fg="gate"] .fg-medicine {
    display: none;
  }
}
`;

const cssStart = html.indexOf("/* ======================== Chapter 01");
const cssEnd = html.indexOf("</style>");
if (cssStart !== -1 && cssEnd !== -1) {
  html = html.substring(0, cssStart) + updatedCSS.trim() + "\n" + html.substring(cssEnd);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully applied green-screen chroma key doctor, sleek medicine, and reverted background in " + targetFile);
