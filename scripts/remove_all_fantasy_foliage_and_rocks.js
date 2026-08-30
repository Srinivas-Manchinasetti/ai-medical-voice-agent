const fs = require("fs");
const path = require("path");

const targetFile = path.join(process.cwd(), "public", "landing-pages", "kage.html");
let html = fs.readFileSync(targetFile, "utf8");

// 1. Remove all old Japanese foliage foreground elements from Chapter 2, 3, 4, and footer
const cleanForegroundReplacements = [
  // Chapter 2 pathways
  {
    from: /<div class="fg" data-fg="pathways" aria-hidden="true">[\s\S]*?<\/div>/,
    to: '<div class="fg" data-fg="pathways" aria-hidden="true"></div>'
  },
  // Chapter 3 lessons
  {
    from: /<div class="fg" data-fg="lessons" aria-hidden="true">[\s\S]*?<\/div>/,
    to: '<div class="fg" data-fg="lessons" aria-hidden="true"></div>'
  },
  // Chapter 4 eternity
  {
    from: /<div class="fg" data-fg="eternity" aria-hidden="true">[\s\S]*?<\/div>/,
    to: '<div class="fg" data-fg="eternity" aria-hidden="true"></div>'
  },
  // Footer foot
  {
    from: /<div class="fg" data-fg="foot" aria-hidden="true">[\s\S]*?<\/div>/,
    to: '<div class="fg" data-fg="foot" aria-hidden="true"></div>'
  }
];

cleanForegroundReplacements.forEach(({ from, to }) => {
  html = html.replace(from, to);
});

// 2. Update Chapter 03 and Chapter 04 copy to clinical voice AI terminology
const ch3OldRegex = /<div class="cur-head">[\s\S]*?<\/div>\s*<div class="cur" id="cur">[\s\S]*?<\/div>\s*<\/section>/;
const ch3New = `<div class="cur-head">
    <h2 class="display h-sec" data-rv="up">Five neural stages. Instant SOAP notes. Zero data latency.</h2>
    <p class="body-lg" data-rv="up">Every triage call is processed through a structured clinical NLP pipeline: from high-fidelity 16kHz speech ingestion to automated ICD-10 extraction and emergency care routing.</p>
  </div>
  <div class="cur" id="cur">
    <div class="les" data-les="0" data-cursor>
      <span class="k">01</span>
      <h3>Acoustic Ingestion<em>VOICE STREAM</em></h3>
      <p>16kHz continuous PCM audio ingestion with live jitter, shimmer, and vocal tremor telemetry.</p>
      <span class="t">&lt; 150ms</span><i class="bar"></i>
    </div>
    <div class="les" data-les="1" data-cursor>
      <span class="k">02</span>
      <h3>Biomarker Mining<em>BIOMARKERS</em></h3>
      <p>Real-time extraction of respiratory distress, speech cadence, and acute acoustic biomarkers.</p>
      <span class="t">&lt; 300ms</span><i class="bar"></i>
    </div>
    <div class="les" data-les="2" data-cursor>
      <span class="k">03</span>
      <h3>Diagnostic Mapping<em>ICD-10 MINING</em></h3>
      <p>Automated conversion of conversational symptom descriptions into clinical ICD-10 diagnostic codes.</p>
      <span class="t">99.4% acc</span><i class="bar"></i>
    </div>
    <div class="les" data-les="3" data-cursor>
      <span class="k">04</span>
      <h3>Clinical Synthesis<em>SOAP NOTES</em></h3>
      <p>Instant EHR-ready synthesis of Subjective, Objective, Assessment, and Plan documentation.</p>
      <span class="t">&lt; 800ms</span><i class="bar"></i>
    </div>
    <div class="les" data-les="4" data-cursor>
      <span class="k">05</span>
      <h3>Emergency Escalation<em>CARE DISPATCH</em></h3>
      <p>Dynamic patient routing with live geo-spatial hospital bed availability and emergency dispatch.</p>
      <span class="t">24/7 Live</span><i class="bar"></i>
    </div>
  </div>
</section>`;

html = html.replace(ch3OldRegex, ch3New);

// 3. Update Chapter 04 (Afterlight / Final CTA)
const ch4OldRegex = /<!-- ============================================================ chapter IV -->[\s\S]*?<!-- ============================================================ footer -->/;
const ch4New = `<!-- ============================================================ chapter IV -->
<section class="sec fin" id="eternity" data-cam="4">
  <div class="fg" data-fg="eternity" aria-hidden="true"></div>
  <div class="eyebrow" data-rv="fade">Chapter 04 — Connected Care</div>
  <h2 class="display" data-rv="up">Ready to deploy clinical voice intelligence?</h2>
  <p class="body-lg" data-rv="up">Transform emergency triage, shorten wait times, and empower physicians with real-time vocal biomarker intelligence and zero-retention HIPAA compliance.</p>
  <a class="cta" href="/demo" data-rv="fade" data-cursor>
    <i></i><span>Launch Interactive Demo</span>
    <svg viewBox="0 0 14 14" fill="none" width="13" height="13"><path d="M3 11 11 3M5 3h6v6" stroke="#dfe7e0" stroke-width="1.3"/></svg>
  </a>
</section>

<!-- ============================================================ footer -->`;

html = html.replace(ch4OldRegex, ch4New);

// 4. Ensure buildLeafFall is empty in JS
if (html.includes("function buildLeafFall")) {
  html = html.replace(/function buildLeafFall\(\)\s*\{[\s\S]*?\}/, 'function buildLeafFall() { WORLD.leaves = null; }');
}

fs.writeFileSync(targetFile, html, "utf8");
console.log("Successfully removed all fantasy foliage and updated chapters 2-4 in " + targetFile);
