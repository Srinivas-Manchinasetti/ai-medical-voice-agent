/**
 * Adversarial test battery for lib/triage/universal-red-flags.ts  (DRAFT v0.1)
 *
 * Run:   npx tsx tests/adversarial-red-flags.ts          (adjust the import path below to your repo)
 * Exit:  code 1 if any HARD failure (missed escalation or crash).
 *
 * Expectations
 *   E        must return EMERGENCY_NOW                        -> miss = HARD (under-triage)
 *   ESC      must return EMERGENCY_NOW, URGENT_SAME_DAY or DISCRIMINATE -> miss = HARD
 *   NOT_E    must NOT return EMERGENCY_NOW                    -> miss = SOFT (over-trigger / false alarm)
 *   NO_THROW must not throw and must finish < 250 ms          -> miss = HARD (robustness)
 *
 * `control: true` cases are expected to PASS against the current code. If a control fails,
 * the harness assumption is wrong, not the code. They exist to prove the harness can pass.
 *
 * NOTE: all gold labels here are developer-written and unreviewed. Treat as a regression/probe suite,
 * not as clinical validation. A clinician must approve labels before they count as evidence.
 */
import { evaluateUniversalRedFlags } from "../lib/triage/universal-red-flags";
import type { UniversalScreenInput } from "../lib/triage/universal-red-flags";

type Expect = "E" | "ESC" | "NOT_E" | "NO_THROW";
interface Case { id: string; group: string; expect: Expect; input: UniversalScreenInput; control?: boolean; note?: string }

const cases: Case[] = [];
const add = (id: string, group: string, expect: Expect, input: UniversalScreenInput, opts: { control?: boolean; note?: string } = {}) =>
  cases.push({ id, group, expect, input, ...opts });

// ---------------------------------------------------------------- A. natural-phrasing emergencies
const A = "A natural phrasing";
add("A01", A, "E", { rawText: "I can't breathe" });
add("A02", A, "E", { rawText: "she is struggling to breathe" }, { control: true });
add("A03", A, "E", { rawText: "he has difficulty breathing and can't finish a sentence" });
add("A04", A, "E", { rawText: "my father is gasping for air" }, { control: true });
add("A05", A, "E", { rawText: "his lips are turning blue" });
add("A06", A, "E", { rawText: "my chest feels tight and heavy" });
add("A07", A, "E", { rawText: "crushing chest pain going to my jaw" });
add("A08", A, "E", { rawText: "there is an elephant sitting on my chest" });
add("A09", A, "E", { rawText: "I have pressure in my chest" });
add("A10", A, "ESC", { rawText: "I have severe chest pain" });
add("A11", A, "ESC", { rawText: "I have chest pain" });
add("A12", A, "E", { rawText: "my father's mouth is drooping and he can't lift his arm" });
add("A13", A, "E", { rawText: "she suddenly can't speak properly" }, { control: true });
add("A14", A, "E", { rawText: "he fell down and is not responding" });
add("A15", A, "E", { rawText: "he is unconscious" });
add("A16", A, "E", { rawText: "she had a fit and is still shaking" });
add("A17", A, "E", { rawText: "his seizures started again" });
add("A18", A, "E", { rawText: "a snake bit my son's leg" });
add("A19", A, "E", { rawText: "he drank pesticide" }, { control: true });
add("A20", A, "E", { rawText: "I want to end it all" });
add("A21", A, "E", { rawText: "the bleeding will not stop" });
add("A22", A, "E", { rawText: "she is vomiting blood and feels dizzy" });
add("A23", A, "E", { rawText: "ate prawns, now her lips and tongue are swelling and she is wheezing" });
add("A24", A, "E", { rawText: "my baby is 10 weeks old and has fever" });
add("A25", A, "E", { rawText: "my 6-week-old has a temperature of 38.5" });
add("A26", A, "E", { rawText: "my 2 month old has a temperature of 39" });
add("A27", A, "E", { rawText: "my newborn is very hot" }, { control: true });
add("A28", A, "E", { rawText: "my daughter's inhaler did not help and she is wheezing" });

// ---------------------------------------------------------------- B. negation traps (must still escalate)
const B = "B negation traps";
add("B01", B, "E", { rawText: "his slurred speech is not getting better" });
add("B02", B, "E", { rawText: "the chest pressure is not going away" });
add("B03", B, "E", { rawText: "I could not sleep because of the chest tightness" });
add("B04", B, "E", { rawText: "I have never felt chest pressure like this before" });
add("B05", B, "ESC", { rawText: "not sure if it's chest tightness or just gas" });
add("B06", B, "E", { rawText: "my father has face droop and no one is at home to help" }, { control: true });

// ---------------------------------------------------------------- C. benign twins / denials (must NOT be emergency)
const C = "C benign twins";
add("C01", C, "NOT_E", { rawText: "no chest pain, no shortness of breath, no sweating", patient: { ageYears: 55, modifiers: ["diabetes"] } }, { control: true });
add("C02", C, "NOT_E", { rawText: "I have heartburn after dinner but I don't have chest pain, sweating or arm pain", patient: { ageYears: 50, modifiers: ["diabetes"] } }, { note: "distributed negation" });
add("C03", C, "NOT_E", { rawText: "he has never had a seizure" }, { control: true });
add("C04", C, "NOT_E", { rawText: "no slurred speech or facial droop" }, { control: true });
add("C05", C, "NOT_E", { rawText: "I was walking in the park and I have heartburn", patient: { ageYears: 45 } });
add("C06", C, "NOT_E", { rawText: "heartburn after spicy biryani, no sweating, it doesn't get worse on walking", patient: { ageYears: 24, sexAtBirth: "male" } }, { control: true });
add("C07", C, "NOT_E", { rawText: "the bleeding stopped after 10 minutes pressure" });
add("C08", C, "NOT_E", { rawText: "my newborn is feeding well but the milk was too hot", patient: { ageMonths: 0 } });
add("C09", C, "NOT_E", { rawText: "my 6 week old baby has no fever and is feeding well" }, { control: true });
add("C10", C, "NOT_E", { rawText: "I have severe abdominal pain after oily food, my period came on time", patient: { ageYears: 30, sexAtBirth: "female" } }, { note: "spec UNI-ABD-03 needs pregnancy possibility" });

// ---------------------------------------------------------------- D. normalization / language
const D = "D normalization";
add("D01", D, "E", { rawText: "I can’t speak" }, { note: "curly apostrophe from phone keyboards/ASR" });
add("D02", D, "ESC", { rawText: "mere seene me bahut dard hai" }, { note: "Hinglish spelling variant" });
add("D03", D, "ESC", { rawText: "सीने में दर्द है" }, { note: "Devanagari: chest pain" });
add("D04", D, "E", { rawText: "ఊపిరి ఆడట్లేదు" }, { note: "Telugu script: can't breathe" });
add("D05", D, "E", { rawText: "oopiri aadatledu" }, { control: true });
add("D06", D, "E", { rawText: "saans nahi aa rahi" }, { control: true });
add("D07", D, "E", { rawText: "I CAN'T SPEAK" }, { control: true });

// ---------------------------------------------------------------- E. demographics from speech / amplifiers
const E = "E demographics";
add("E01", E, "E", { rawText: "I am 62 years old and diabetic. I have burning in my upper stomach and I am sweating a lot" }, { note: "unprofiled caller" });
add("E02", E, "E", { rawText: "I am 62 years old and diabetic. I have burning in my upper stomach and I am sweating a lot", patient: { modifiers: [] } });
add("E03", E, "E", { rawText: "I have diabetes. I have burning in my upper stomach and I am sweating a lot", patient: { modifiers: [] } }, { control: true });
add("E04", E, "E", { rawText: "I am 8 months pregnant and I have a severe headache and blurry vision" }, { note: "pregnancy only read from profile" });
add("E05", E, "E", { rawText: "I have a bad headache", patient: { pregnancy: { status: "pregnant" } } }, { control: true });
add("E06", E, "E", { rawText: "my 2 month old baby has fever" }, { control: true });
add("E07", E, "ESC", { rawText: "my 70 year old father has acidity and sweating since morning" }, { note: "unprofiled + India idiom" });
add("E08", E, "E", { rawText: "acidity and sweating since morning", patient: { ageYears: 70 } }, { note: "India idiom 'acidity'/'gas'" });
add("E09", E, "E", { rawText: "pain in my left arm and I am sweating", patient: { ageYears: 62, modifiers: ["diabetes"] } });
add("E10", E, "E", { rawText: "burning in the upper stomach and sweating", patient: { ageYears: 62, modifiers: ["diabetes"] } });
add("E11", E, "E", { rawText: "nausea and breathlessness with sweating since morning", patient: { ageYears: 62, modifiers: ["diabetes"] } });

// ---------------------------------------------------------------- F. stale denials / facts / multi-turn
const F = "F state & denials";
add("F01", F, "E", { rawText: "my six week old has a fever", patient: { ageMonths: 1 } }, { control: true });
add("F02", F, "E", { rawText: "my six week old has a fever", patient: { ageMonths: 1 }, deniedSymptoms: ["fever"] }, { note: "stale denial from an earlier turn" });
add("F03", F, "E", { rawText: "she passed black tarry stool and is very weak" }, { control: true });
add("F04", F, "E", { rawText: "she passed black tarry stool and is very weak", deniedSymptoms: ["vomiting"] }, { note: "denial matched against regex source text" });
add("F05", F, "NOT_E", { rawText: "ok", clinicalFacts: ["patient denies chest tightness"] }, { note: "format-sensitive: facts matched without negation" });
add("F06", F, "E", { rawText: "and she has chest pain also", cumulativeTranscript: "my mother fainted. and she has chest pain also", clinicalFacts: [] }, { note: "cumulativeTranscript is not used for rule matching" });

// ---------------------------------------------------------------- G. spec rules with no implementation (probes)
const G = "G spec coverage";
add("G01", G, "E", { rawText: "my heart is racing and I feel dizzy and short of breath" }, { note: "UNI-CIR-04" });
add("G02", G, "E", { rawText: "sudden loss of vision in my right eye" }, { note: "UNI-NEU-02" });
add("G03", G, "E", { rawText: "he is very drowsy and confused since this morning, not himself" }, { note: "UNI-NEU-05" });
add("G04", G, "E", { rawText: "he hit his head on the floor, vomited twice and is sleepy" }, { note: "UNI-NEU-07" });
add("G05", G, "E", { rawText: "sudden severe pain in my testicle" }, { note: "UNI-ABD-05" });
add("G06", G, "E", { rawText: "heavy vaginal bleeding, soaking a pad every hour", patient: { ageYears: 28, sexAtBirth: "female" } }, { note: "UNI-BLD-02" });
add("G07", G, "E", { rawText: "I am coughing up a lot of blood" }, { note: "UNI-BLD-03" });
add("G08", G, "E", { rawText: "he fell from the terrace and is confused and in severe pain" }, { note: "UNI-BLD-04" });
add("G09", G, "E", { rawText: "I have vaginal bleeding", patient: { pregnancy: { status: "pregnant", weeks: 30 } } }, { note: "UNI-PRG-02" });
add("G10", G, "E", { rawText: "I delivered a week ago and now I have chest pain and breathlessness", patient: { pregnancy: { status: "postpartum" } } }, { note: "UNI-PRG-03" });
add("G11", G, "E", { rawText: "my baby is breathing very fast and grunting with every breath", patient: { ageMonths: 5 } }, { note: "UNI-PED-03" });
add("G12", G, "E", { rawText: "my baby is vomiting green fluid", patient: { ageMonths: 4 } }, { note: "UNI-PED-05" });
add("G13", G, "E", { rawText: "no urine for twelve hours and not drinking", patient: { ageMonths: 8 } }, { note: "UNI-PED-06" });
add("G14", G, "E", { rawText: "my 2 year old swallowed a battery" }, { note: "UNI-PED-07 / TOX-02 wording" });
add("G15", G, "E", { rawText: "he has high fever, is confused and breathing very fast" }, { note: "UNI-SEP-01" });
add("G16", G, "E", { rawText: "fever with a rash that does not fade when I press it" }, { note: "UNI-SEP-04" });
add("G17", G, "E", { rawText: "vomiting, very drowsy, breathing fast, breath smells fruity", patient: { ageYears: 30, modifiers: ["diabetes"] } }, { note: "UNI-MET-01" });
add("G18", G, "E", { rawText: "I am sweating, shaking and confused", patient: { ageYears: 40, modifiers: ["diabetes", "insulin"] } }, { note: "UNI-MET-02" });
add("G19", G, "E", { rawText: "he was in the sun all day and now is confused with hot dry skin" }, { note: "UNI-MET-03" });
add("G20", G, "E", { rawText: "we are all having headache and drowsiness, a charcoal stove is burning in the closed room" }, { note: "UNI-TOX-03" });
add("G21", G, "E", { rawText: "a scorpion stung my 3 year old and he is sweating and breathless" }, { note: "UNI-TOX-04" });
add("G22", G, "ESC", { rawText: "I don't want to live anymore" }, { note: "UNI-PSY-02" });
add("G23", G, "E", { rawText: "I feel like harming my baby" }, { note: "UNI-PSY-01 harm to others" });
add("G24", G, "E", { rawText: "I think he's dying" }, { note: "UNI-GEN-01" });
add("G25", G, "E", { rawText: "he looks very sick and is not responding properly" }, { note: "UNI-GEN-01 spec wording" });
add("G26", G, "E", { rawText: "sudden severe pain in my belly and back", patient: { ageYears: 70 } }, { note: "UNI-ABD-04" });
add("G27", G, "E", { rawText: "sudden tearing pain in my chest going to my back" }, { note: "UNI-CAR-04 wording" });
add("G28", G, "E", { rawText: "headache and fever and I cannot look at light" }, { note: "UNI-NEU-06 photophobia" });
add("G29", G, "E", { rawText: "my tongue is swelling" }, { note: "UNI-AIR-03 wording" });

// ---------------------------------------------------------------- H. robustness
const H = "H robustness";
add("H01", H, "NO_THROW", { rawText: "" });
add("H02", H, "NO_THROW", { rawText: undefined as unknown as string }, { note: "undefined text from upstream" });
add("H03", H, "NO_THROW", { rawText: "chest tightness", deniedSymptoms: ["pain (severe"] }, { note: "unescaped regex built from data" });
add("H04", H, "NO_THROW", { rawText: "ok", clinicalFacts: [null as unknown as string, 5 as unknown as string, { fact: "x" } as unknown as string] });
add("H05", H, "NO_THROW", { rawText: "chest ".repeat(40000) }, { note: "240k chars, latency bound" });

// ---------------------------------------------------------------- runner
const OK = new Set(["EMERGENCY_NOW", "URGENT_SAME_DAY", "DISCRIMINATE"]);
let hard = 0, soft = 0, pass = 0, controlFail = 0, eExpected = 0, eHit = 0;
const hardByGroup: Record<string, number> = {};
const rows: string[] = [];

for (const c of cases) {
  const t0 = performance.now();
  let level = "-", rules = "", err = "";
  try {
    const r = evaluateUniversalRedFlags(c.input);
    level = r.level; rules = r.firedRules.map(f => f.ruleId).join(",");
  } catch (e) { err = String(e).slice(0, 60); }
  const ms = performance.now() - t0;

  let ok: boolean;
  if (c.expect === "NO_THROW") ok = !err && ms < 250;
  else if (err) ok = false;
  else if (c.expect === "E") ok = level === "EMERGENCY_NOW";
  else if (c.expect === "ESC") ok = OK.has(level);
  else ok = level !== "EMERGENCY_NOW";

  if (c.expect === "E" || c.expect === "ESC") { eExpected++; if (ok) eHit++; }
  const isHard = !ok && c.expect !== "NOT_E";
  let tag = "PASS      ";
  if (ok) pass++;
  else if (c.control) { controlFail++; tag = "CTRL-FAIL "; }
  else if (isHard) { hard++; hardByGroup[c.group] = (hardByGroup[c.group] || 0) + 1; tag = "FAIL-HARD "; }
  else { soft++; tag = "FAIL-SOFT "; }

  const shown = typeof c.input.rawText === "string" ? c.input.rawText.slice(0, 58) : String(c.input.rawText);
  rows.push(`${tag}${c.id} ${c.expect.padEnd(8)} got=${(err ? "THROW " + err : level).padEnd(15)} ${rules.padEnd(14)} ${c.control ? "[ctrl] " : ""}${shown}${c.note ? "  // " + c.note : ""}${c.expect === "NO_THROW" ? ` (${ms.toFixed(0)}ms)` : ""}`);
}

console.log(rows.join("\n"));
console.log("\n================ SUMMARY ================");
console.log(`cases: ${cases.length}   pass: ${pass}   HARD fail: ${hard}   SOFT fail: ${soft}   control-fail: ${controlFail}`);
console.log(`escalation recall on expected-escalation cases: ${eHit}/${eExpected} = ${(100 * eHit / eExpected).toFixed(1)}%  (target: 100%)`);
console.log("HARD fails by group:", JSON.stringify(hardByGroup));
if (controlFail) console.log("WARNING: a control case failed; the harness assumption is wrong for that case.");
process.exitCode = hard > 0 ? 1 : 0;
