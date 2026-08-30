const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// Replacement for buildTemple() and buildTorii()
const hospitalCode = `/* ======================================================= 4 · hospital center */
/* Modern architectural metropolitan medical center & clinical triage complex:
   3-storey ribbon curtain glass, glowing clinical telemetry bays, rooftop helipad,
   and illuminated emergency medical cross beacon.                             */
function buildTemple() {
  const g = new THREE.Group();
  
  const facadeDark   = new THREE.MeshStandardMaterial({ color: 0x121820, roughness: 0.65, metalness: 0.4 });
  const facadePanel  = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.55 });
  const steelMullion = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.8 });
  const tintedGlass  = new THREE.MeshStandardMaterial({ color: 0x07111a, roughness: 0.10, metalness: 0.9, transparent: true, opacity: 0.88 });
  
  const wardGlow     = new THREE.MeshBasicMaterial({ color: hdr(1.08, 0.76, 0.45), fog: true, toneMapped: false });
  const telemetryGlow= new THREE.MeshBasicMaterial({ color: hdr(0.25, 1.6, 2.0), fog: true, toneMapped: false });
  const redCrossMat  = new THREE.MeshBasicMaterial({ color: hdr(4.2, 0.35, 0.28), fog: false, toneMapped: false });
  const neonCyanMat  = new THREE.MeshBasicMaterial({ color: hdr(0.35, 2.2, 2.6), fog: false, toneMapped: false });

  WORLD.paper = wardGlow;

  const F = PODIUM;

  /* ---- Central Hospital Tower (3 Storeys of Ribbon Glass & Steel Facades) --- */
  const mainCore = new THREE.Mesh(new THREE.BoxGeometry(15.4, 12.0, 9.4), facadeDark);
  mainCore.position.set(0, F + 6.0, TEMPLE_Z);
  mainCore.castShadow = true;
  g.add(mainCore);

  for (let floor = 0; floor < 3; floor++) {
    const fy = F + 2.0 + floor * 3.8;
    for (let bay = 0; bay < 5; bay++) {
      const bx = -5.6 + bay * 2.8;
      const isTealBay = (bay === 2 && floor === 1) || (bay === 4 && floor === 2);
      const glassPane = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.0), isTealBay ? telemetryGlow : wardGlow);
      glassPane.position.set(bx, fy, TEMPLE_Z + 4.74);
      g.add(glassPane);

      const glassTint = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.0), tintedGlass);
      glassTint.position.set(bx, fy, TEMPLE_Z + 4.78);
      g.add(glassTint);
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.45, 10.2), facadePanel);
    slab.position.set(0, fy + 1.25, TEMPLE_Z);
    slab.castShadow = true;
    g.add(slab);
  }

  /* ---- Rooftop Helipad & Emergency Command Penthouse ------------------- */
  const penthouse = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.8, 6.4), facadePanel);
  penthouse.position.set(0, F + 13.4, TEMPLE_Z);
  g.add(penthouse);

  const helipad = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.5, 0.45, 32), steelMullion);
  helipad.position.set(0, F + 15.0, TEMPLE_Z);
  g.add(helipad);

  /* Glowing Emergency Medical Cross (+) on Rooftop Penthouse */
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.55, 2.4, 0.28), redCrossMat);
  crossV.position.set(0, F + 13.4, TEMPLE_Z + 3.26);
  g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.55, 0.28), redCrossMat);
  crossH.position.set(0, F + 13.4, TEMPLE_Z + 3.26);
  g.add(crossH);

  /* ---- Left & Right Hospital Wings (Ambulance Drop-Off & Trauma Bays) --- */
  [-1, 1].forEach(s => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(9.6, 7.2, 7.0), facadeDark);
    wing.position.set(s * 12.8, F + 3.6, TEMPLE_Z + 1.2);
    wing.castShadow = true;
    g.add(wing);

    for (let floor = 0; floor < 2; floor++) {
      const fy = F + 1.8 + floor * 3.4;
      for (let bay = 0; bay < 3; bay++) {
        const bx = s * 12.8 + (bay - 1) * 2.8;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.8), wardGlow);
        win.position.set(bx, fy, TEMPLE_Z + 4.74);
        g.add(win);
      }
    }

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.35, 4.6), steelMullion);
    canopy.position.set(s * 12.8, F + 1.2, TEMPLE_Z + 4.8);
    canopy.castShadow = true;
    g.add(canopy);

    const neon = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.10, 0.14), s === -1 ? redCrossMat : neonCyanMat);
    neon.position.set(s * 12.8, F + 1.15, TEMPLE_Z + 7.12);
    g.add(neon);
  });

  WORLD.templeTop = F + 16.0;
  scene.add(g);
  WORLD.temple = g;

  /* Hospital Facade Lighting Spill */
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(36, 20),
    new THREE.MeshBasicMaterial({ map: tx(texGlow('rgba(56,189,248,.65)', 'rgba(14,165,233,.18)')),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: .35 }));
  spill.position.set(0, F + 5.0, TEMPLE_Z + 6.0); spill.renderOrder = 2;
  scene.add(spill); WORLD.hallHalo = spill;

  const mist = new THREE.Mesh(new THREE.PlaneGeometry(64, 20),
    new THREE.MeshBasicMaterial({ map: tx(texGlow('rgba(148,163,184,.45)', 'rgba(71,85,105,.15)')),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, opacity: .18 }));
  mist.position.set(0, F - 1.4, TEMPLE_Z + 10); mist.renderOrder = 2; scene.add(mist);
}

/* --------------------------------------------------- modern emergency portal */
function buildTorii() {
  const pylonMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.75 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.25, metalness: 0.85 });
  const redGlowMat = new THREE.MeshBasicMaterial({ color: hdr(4.0, 0.35, 0.25), fog: false, toneMapped: false });
  const cyanGlowMat = new THREE.MeshBasicMaterial({ color: hdr(0.3, 2.0, 2.6), fog: false, toneMapped: false });

  const g = new THREE.Group();
  const BASE = 0.78, H = 8.4, SPAN = 3.8;

  // Twin Architectural Entrance Columns
  [-1, 1].forEach(s => {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.65, H, 0.65), pylonMat);
    col.position.set(s * SPAN, BASE + H / 2, 0);
    col.castShadow = true;
    g.add(col);

    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.55, 0.92), steelMat);
    foot.position.set(s * SPAN, BASE + 0.28, 0);
    foot.castShadow = true;
    g.add(foot);

    const band = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.35, 0.72), cyanGlowMat);
    band.position.set(s * SPAN, BASE + H - 1.2, 0);
    g.add(band);
  });

  // Emergency Transverse Header Canopy
  const beam = new THREE.Mesh(new THREE.BoxGeometry(10.2, 0.65, 0.8), pylonMat);
  beam.position.set(0, BASE + H - 0.8, 0);
  beam.castShadow = true;
  g.add(beam);

  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.12, 0.84), redGlowMat);
  ledStrip.position.set(0, BASE + H - 1.15, 0);
  g.add(ledStrip);

  // Central Medical Cross (+) on Gateway
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.9), redGlowMat);
  crossV.position.set(0, BASE + H - 0.1, 0);
  g.add(crossV);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.35, 0.9), redGlowMat);
  crossH.position.set(0, BASE + H - 0.1, 0);
  g.add(crossH);

  const GS = 0.72;
  g.position.set(0, -BASE * GS, -8.6);
  g.scale.setScalar(GS);
  scene.add(g);
  WORLD.torii = g;
}`;

// Replace buildTemple & buildTorii blocks
const templeStart = html.indexOf("function buildTemple()");
const toriiEnd = html.indexOf("function buildLantern(x, z, s, y)");

if (templeStart !== -1 && toriiEnd !== -1) {
  html = html.substring(0, templeStart) + hospitalCode + "\n\n" + html.substring(toriiEnd);
  fs.writeFileSync(targetFile, html, "utf8");
  console.log("Successfully transformed 3D temple and torii into modern hospital complex in " + targetFile);
} else {
  console.error("Could not find function buildTemple or buildLantern bounds");
}
