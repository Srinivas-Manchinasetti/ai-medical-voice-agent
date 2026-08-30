const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Add CSS for Hero Explore Button and Live Triage Card
const heroCustomCSS = `
/* ======================== MedVoice AI Hero UI Extensions ======================== */
.h-grad {
  background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.hero-explore-btn {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
  padding: 12px 24px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.18) 0%, rgba(2, 132, 199, 0.28) 100%);
  border: 1px solid rgba(56, 189, 248, 0.45);
  border-radius: 9999px;
  color: #f0fdf4;
  font-family: 'Onest', sans-serif;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 20px -2px rgba(14, 165, 233, 0.35);
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.hero-explore-btn:hover {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.4) 0%, rgba(2, 132, 199, 0.55) 100%);
  border-color: rgba(56, 189, 248, 0.8);
  box-shadow: 0 6px 28px rgba(14, 165, 233, 0.55);
  transform: translateY(-2px) scale(1.02);
  color: #fff;
}

.hero-explore-btn svg {
  transition: transform 0.3s ease;
}

.hero-explore-btn:hover svg {
  transform: translateX(4px);
}

.live-triage-card {
  position: absolute;
  z-index: 4;
  right: clamp(24px, 4vw, 56px);
  bottom: clamp(28px, 5vh, 64px);
  width: clamp(240px, 22vw, 320px);
  background: rgba(7, 12, 18, 0.82);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(56, 189, 248, 0.22);
  border-radius: 16px;
  padding: 16px 20px;
  box-shadow: 0 20px 40px -10px rgba(0, 0, 0, 0.7), 0 0 30px -5px rgba(14, 165, 233, 0.15);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.lt-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.lt-pulse-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(56, 189, 248, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.lt-title-info b {
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #e2e8f0;
}

.lt-title-info p {
  margin: 0;
  font-size: 10px;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.lt-wave-bars {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 4px;
}

.lt-wave-bars span {
  width: 3px;
  height: var(--h, 16px);
  background: linear-gradient(180deg, #38bdf8 0%, #0369a1 100%);
  border-radius: 3px;
  animation: wavePulse 1.2s infinite ease-in-out alternate;
  animation-delay: var(--d, 0s);
}

@keyframes wavePulse {
  0% { transform: scaleY(0.3); opacity: 0.4; }
  100% { transform: scaleY(1.3); opacity: 1; filter: drop-shadow(0 0 6px #38bdf8); }
}

@media (max-width: 820px) {
  .live-triage-card { display: none; }
}
`;

// Insert CSS if not present
if (!html.includes(".hero-explore-btn")) {
  html = html.replace("</style>", heroCustomCSS + "\n</style>");
}

// 2. Update Hero Markup
const oldHeroContentRegex = /<section class="hero" id="hero" data-cam="0">[\s\S]*?<\/section>/;
const newHeroContent = `<section class="hero" id="hero" data-cam="0">
  <div class="hero-top">
    <div class="eyebrow" data-rv="fade"><span class="dot"></span> Chapter 00 — Clinical AI Triage</div>
    <h1 class="display h-hero">
      <span class="mask-line"><span>WHERE STILLNESS</span></span>
      <span class="mask-line"><span>REVEALS THE</span></span>
      <span class="mask-line"><span class="h-grad">UNSEEN.</span></span>
    </h1>
    <p class="hero-sub body" data-rv="up">Real-time clinical voice intelligence, acoustic biomarker extraction, and automated ESI triage routing.</p>
    <a href="/demo" target="_top" class="hero-explore-btn" data-cursor>
      <span>EXPLORE THE JOURNEY</span>
      <svg viewBox="0 0 16 16" fill="none" width="14" height="14"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </a>
  </div>

  <div class="hero-spacer"></div>

  <div class="hero-foot">
    <div class="hero-cue" data-rv="fade"><span>Scroll to explore</span><span class="track"><i></i></span></div>
    <div class="chapters" id="chips">
      <div class="chip" data-chip="0" data-rv="up" data-cursor><span class="num">01</span>
        <span class="tx"><b>LISTEN</b><p>16kHz acoustic ingestion & vital vocal capture.</p></span></div>
      <div class="chip" data-chip="1" data-rv="up" data-cursor><span class="num">02</span>
        <span class="tx"><b>UNDERSTAND</b><p>Acoustic biomarkers & ICD-10 diagnostic mining.</p></span></div>
      <div class="chip" data-chip="2" data-rv="up" data-cursor><span class="num">03</span>
        <span class="tx"><b>ACT</b><p>Automated SOAP synthesis & emergency escalation.</p></span></div>
      <div class="chip" data-chip="3" data-rv="up" data-cursor><span class="num">04</span>
        <span class="tx"><b>CARE NETWORK</b><p>Direct ABDM telemetry & hospital dispatch.</p></span></div>
    </div>
  </div>

  <div class="live-triage-card" data-rv="fade">
    <div class="lt-header">
      <div class="lt-pulse-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" width="16" height="16"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
      </div>
      <div class="lt-title-info">
        <b>AI VOICE TRIAGE</b>
        <p>Intelligent. Instant. Human-first.</p>
      </div>
    </div>
    <div class="lt-wave-bars">
      <span style="--d:0.1s; --h:18px;"></span>
      <span style="--d:0.3s; --h:28px;"></span>
      <span style="--d:0.15s; --h:12px;"></span>
      <span style="--d:0.4s; --h:32px;"></span>
      <span style="--d:0.25s; --h:22px;"></span>
      <span style="--d:0.5s; --h:36px;"></span>
      <span style="--d:0.2s; --h:16px;"></span>
      <span style="--d:0.35s; --h:30px;"></span>
      <span style="--d:0.18s; --h:14px;"></span>
      <span style="--d:0.45s; --h:24px;"></span>
      <span style="--d:0.3s; --h:20px;"></span>
      <span style="--d:0.1s; --h:10px;"></span>
    </div>
  </div>

  <div class="word-fb" aria-hidden="true">MEDVOICE</div>

  <div class="hero-side" data-rv="up">
    <span class="v">MEDVOICE AI</span>
  </div>
</section>`;

html = html.replace(oldHeroContentRegex, newHeroContent);

// 3. Update 3D WebGL buildTemple to render the photorealistic backdrop plate and clinical lighting
const updated3DCode = `/* ======================================================= 4 · hospital center */
/* Photorealistic Architectural Hospital Environment & Clinical Lighting */
function buildTemple() {
  const g = new THREE.Group();
  
  // Load the high-resolution photorealistic hospital hero texture
  const texLoader = new THREE.TextureLoader();
  const hospitalTex = texLoader.load('/images/medvoice-hospital-hero.jpg');
  hospitalTex.encoding = THREE.sRGBEncoding;

  // Background Hospital Environment Plane at TEMPLE_Z
  const planeW = 128, planeH = 72;
  const hospitalPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeW, planeH),
    new THREE.MeshBasicMaterial({
      map: hospitalTex,
      transparent: false,
      depthWrite: true,
      fog: false
    })
  );
  hospitalPlane.position.set(0, PODIUM + 16, TEMPLE_Z);
  g.add(hospitalPlane);

  // Luminous Clinical Cyan Medical Cross Glow Overlay on Rooftop
  const crossGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({
      map: tx(texGlow('rgba(56,189,248,0.95)', 'rgba(2,132,199,0.25)')),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.85
    })
  );
  crossGlow.position.set(0, PODIUM + 34, TEMPLE_Z + 1.2);
  crossGlow.renderOrder = 3;
  g.add(crossGlow);

  // Central Holographic Avatar Cyan Light Halo
  const avatarHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 38),
    new THREE.MeshBasicMaterial({
      map: tx(texGlow('rgba(56,189,248,0.7)', 'rgba(3,105,161,0.18)')),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
      opacity: 0.65
    })
  );
  avatarHalo.position.set(0, PODIUM + 18, TEMPLE_Z + 1.0);
  avatarHalo.renderOrder = 3;
  g.add(avatarHalo);

  WORLD.templeTop = PODIUM + 36;
  scene.add(g);
  WORLD.temple = g;

  // Ground Fog & Atmospheric Ambient Light
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(90, 24),
    new THREE.MeshBasicMaterial({ map: tx(texGlow('rgba(15,23,42,0.85)', 'rgba(2,132,199,0.12)')),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: 0.4 }));
  mist.position.set(0, PODIUM - 2, TEMPLE_Z + 8);
  mist.renderOrder = 2;
  scene.add(mist);
}

/* --------------------------------------------------- the vermilion moon */
const MOON = { x: 17.9, y: 31.9, z: -72, r: 8.6 };
function buildMoon() {
  // Built directly into the beauty pass hero visual
  WORLD.moon = null;
}

function placeMoon() {
  // No-op
}

/* --------------------------------------------------- modern emergency portal */
function buildTorii() {
  // Entrance integrated directly into the photorealistic hospital architecture
  WORLD.torii = null;
}`;

// Replace buildTemple & buildTorii blocks
const templeStart = html.indexOf("function buildTemple()");
const lanternStart = html.indexOf("function buildLantern(x, z, s, y)");

if (templeStart !== -1 && lanternStart !== -1) {
  html = html.substring(0, templeStart) + updated3DCode + "\n\n" + html.substring(lanternStart);
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully applied photorealistic hospital hero and UI in " + targetFile);
