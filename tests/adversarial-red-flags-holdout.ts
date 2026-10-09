/**
 * HOLDOUT battery v2 for lib/triage/universal-red-flags.ts  (DRAFT, unreviewed labels)
 *
 * Purpose: v1 (adversarial-red-flags.ts) has now been tuned against, so passing it is a regression
 * result, not evidence. This file uses NEW phrasings, assertion-status traps (negated / historical /
 * hypothetical / other-person), entity-attribution traps, numeric/age formats, scripts and metamorphic
 * invariants. Every phrasing here was written WITHOUT looking at the patched code.
 *
 * HOW TO USE (important for it to stay meaningful):
 *   1. Run it once. Look at the AGGREGATE (groups + metamorphic breaks), not at individual strings.
 *   2. Fix by CATEGORY (e.g. "age words", "assertion status"), never by adding the failing string.
 *   3. Do not paste these strings into the lexicon. Ask for a fresh batch before claiming anything.
 *
 * Run:  npx tsx tests/adversarial-red-flags-holdout.ts      Exit 1 on any HARD failure.
 * Labels: E = EMERGENCY_NOW; ESC = E/URGENT/DISCRIMINATE; NOT_E = anything except EMERGENCY_NOW.
 * Hindi/Telugu strings need native-speaker review before they count as evidence.
 */
import { evaluateUniversalRedFlags } from "../lib/triage/universal-red-flags";
import type { UniversalScreenInput } from "../lib/triage/universal-red-flags";

type Expect = "E" | "ESC" | "NOT_E" | "NO_THROW";
interface Case { id: string; group: string; expect: Expect; input: UniversalScreenInput; control?: boolean; note?: string }
const cases: Case[] = [];
const add = (id: string, group: string, expect: Expect, input: UniversalScreenInput, o: { control?: boolean; note?: string } = {}) => cases.push({ id, group, expect, input, ...o });

// ---------- P. paraphrased emergencies (never seen in v1)
const P = "P paraphrase";
add("P01", P, "E", { rawText: "I am finding it very hard to catch my breath even while sitting still" });
add("P02", P, "E", { rawText: "he can only say two or three words at a time and is breathing very fast" });
add("P03", P, "E", { rawText: "my mother's lips and fingertips have gone bluish" });
add("P04", P, "E", { rawText: "it feels like a heavy stone is sitting on my chest" });
add("P05", P, "E", { rawText: "my chest is being squeezed and my left arm has gone numb" });
add("P06", P, "E", { rawText: "intense pain in the middle of my chest for twenty minutes with a cold sweat" });
add("P07", P, "E", { rawText: "my dad's face looks lopsided and his words are coming out slurred" });
add("P08", P, "E", { rawText: "she can't move her left side and she can't talk" });
add("P09", P, "E", { rawText: "he collapsed and is not waking up" });
add("P10", P, "E", { rawText: "she has been fitting for ten minutes" });
add("P11", P, "E", { rawText: "my toddler had convulsions and is now limp" });
add("P12", P, "E", { rawText: "two fang marks on my husband's ankle and the leg is swelling fast, probably a snake" });
add("P13", P, "E", { rawText: "my brother drank Tik 20" }, { note: "India: paraquat hair-dye poison" });
add("P14", P, "E", { rawText: "she swallowed a whole strip of tablets on purpose" });
add("P15", P, "E", { rawText: "I suddenly lost all vision in my left eye" });
add("P16", P, "E", { rawText: "this is the worst headache I have ever had and it hit me in seconds" });
add("P17", P, "E", { rawText: "my wife is 34 weeks pregnant, her face and hands are swollen and she has a pounding headache" });
add("P18", P, "E", { rawText: "I am ten weeks pregnant and bleeding heavily" });
add("P19", P, "E", { rawText: "my 20 day old baby is feeding poorly and feels warm" });
add("P20", P, "E", { rawText: "my 5 week old has been crying nonstop and is very floppy" });
add("P21", P, "E", { rawText: "my 3 year old is breathing fast and his ribs are pulling in with every breath" });
add("P22", P, "E", { rawText: "my baby threw up green fluid", patient: { ageMonths: 6 } });
add("P23", P, "E", { rawText: "she hasn't passed urine for ten hours and her eyes look sunken", patient: { ageMonths: 6 } });
add("P24", P, "E", { rawText: "my father is diabetic, vomiting, very sleepy and his breath smells of acetone" });
add("P25", P, "E", { rawText: "my father is diabetic, he is sweating, trembling and talking nonsense" });
add("P26", P, "E", { rawText: "all of us have headache and vomiting since we lit the coal angithi in the closed room" }, { note: "India: CO" });
add("P27", P, "E", { rawText: "a scorpion stung my 4 year old, he is sweating heavily and breathing fast" });
add("P28", P, "E", { rawText: "dengue fever day 4 with bleeding gums and stomach pain" }, { control: true });
add("P29", P, "E", { rawText: "fever with purple spots that do not go away when pressed" });
add("P30", P, "E", { rawText: "I want to end my life tonight and I have tablets with me" });
add("P31", P, "ESC", { rawText: "I think everyone would be better off without me" });
add("P32", P, "E", { rawText: "I am scared I will hurt my newborn" });
add("P33", P, "E", { rawText: "sudden tearing pain in my back, sweating, almost fainted", patient: { ageYears: 68, sexAtBirth: "male" } });
add("P34", P, "E", { rawText: "I coughed up about a cupful of blood" });
add("P35", P, "E", { rawText: "he was hit by a speeding bike, hit his head on the road, vomited and is drowsy" });
add("P36", P, "E", { rawText: "she is 8 months pregnant and the baby has stopped moving since morning" });
add("P37", P, "E", { rawText: "my heart is racing and I nearly fainted" });
add("P38", P, "E", { rawText: "my toddler swallowed a button battery" });
add("P39", P, "E", { rawText: "after the bee sting her face swelled up and she is wheezing" });
add("P40", P, "E", { rawText: "his stomach is hard like a board and he screams if touched" });
add("P41", P, "E", { rawText: "he is gasping and cannot speak" }, { control: true });
add("P42", P, "E", { rawText: "he is struggling for breath" }, { control: true });

// ---------- Q. assertion status: negated / historical / hypothetical / other-person (must NOT be emergency)
const Q = "Q assertion status";
add("Q01", Q, "NOT_E", { rawText: "I have no history of chest pain or breathlessness, I just have a cold" }, { control: true });
add("Q02", Q, "NOT_E", { rawText: "denies chest tightness, denies sweating, denies arm pain", patient: { ageYears: 55, modifiers: ["diabetes"] } }, { control: true });
add("Q03", Q, "NOT_E", { rawText: "my ECG yesterday ruled out chest tightness from the heart, now I only have a cold" }, { control: true });
add("Q04", Q, "NOT_E", { rawText: "my uncle had slurred speech and a stroke last year, I am only asking about prevention" }, { note: "family history" });
add("Q05", Q, "NOT_E", { rawText: "what are the warning signs of a seizure? I want to learn first aid" }, { note: "educational question" });
add("Q06", Q, "NOT_E", { rawText: "I had chest tightness last month after a workout and it settled by itself" }, { note: "historical, resolved" });
add("Q07", Q, "NOT_E", { rawText: "it is not chest tightness, it is a pulled muscle from the gym" }, { control: true });
add("Q08", Q, "NOT_E", { rawText: "I saw a snake in the garden but it did not bite anyone" }, { control: true });
add("Q09", Q, "NOT_E", { rawText: "no one in the house has any trouble breathing" }, { control: true });
add("Q10", Q, "NOT_E", { rawText: "should I worry if my baby gets a fever? she is 2 months old and fine today" }, { note: "hypothetical; DISCRIMINATE acceptable" });
add("Q11", Q, "NOT_E", { rawText: "my newborn feels warm after two blankets but the thermometer shows 36.8", patient: { ageMonths: 0 } });
add("Q12", Q, "NOT_E", { rawText: "I have a mild headache, my sister who is 32 weeks pregnant also has one but she is fine" }, { control: true, note: "pregnancy belongs to someone else" });
add("Q13", Q, "NOT_E", { rawText: "my father is 70 and diabetic. I am 24, I have heartburn and I am sweating because it is 40 degrees outside" }, { control: true, note: "age/comorbidity belong to someone else" });
add("Q14", Q, "NOT_E", { rawText: "mild heartburn once after a heavy dinner, no sweating, no breathlessness, nothing on walking or stairs", patient: { ageYears: 50, modifiers: ["diabetes"] } }, { control: true });
add("Q15", Q, "NOT_E", { rawText: "my 8 month old has a runny nose and slight cough, feeding well and playful", patient: { ageMonths: 8 } }, { control: true });
add("Q16", Q, "NOT_E", { rawText: "my 3 week old is feeding well, sleeping well, no fever and has normal wet diapers", patient: { ageMonths: 1 } }, { control: true });
add("Q17", Q, "NOT_E", { rawText: "a paper cut bled a little and stopped in two minutes" }, { control: true });
add("Q18", Q, "NOT_E", { rawText: "I am 6 weeks pregnant with mild morning nausea, no bleeding, no pain", patient: { pregnancy: { status: "pregnant", weeks: 6 } } }, { control: true });

// ---------- R. entity attribution, age words, temperatures
const R = "R entities";
add("R01", R, "E", { rawText: "I am 24. My mother is 62 and diabetic, she has burning in her upper stomach and is sweating a lot" }, { note: "caregiver reporting" });
add("R02", R, "E", { rawText: "my husband is sixty two, he has sugar, and since morning he has burning in his stomach and cold sweat" });
add("R03", R, "E", { rawText: "mere pitaji 65 saal ke hain, unhe sugar hai, pet ke upar jalan aur paseena aa raha hai" }, { note: "Hinglish; native review" });
add("R05", R, "E", { rawText: "my daughter is 5 weeks old with a fever" }, { control: true });
add("R06", R, "E", { rawText: "my son is eleven weeks old, he feels hot and is refusing feeds" }, { note: "11 weeks < 3 months" });
add("R07", R, "E", { rawText: "my baby was born six weeks ago and has a temperature of 101.3 F" });
add("R08", R, "E", { rawText: "my son turned two months last week and the thermometer shows 38.9" });
add("R09", R, "E", { rawText: "the thermometer shows 38.4 for my 7 week old" });
add("R10", R, "NOT_E", { rawText: "my 6 week old, thermometer shows 99.1 F, feeding well" }, { note: "99.1 F is not a fever" });
add("R11", R, "E", { rawText: "I am in my sixties, diabetic, with acidity and sweating since morning" });
add("R12", R, "E", { rawText: "62 female diabetic: epigastric discomfort and nausea with sweating" }, { note: "telegraphic" });
add("R13", R, "E", { rawText: "my 70-year-old dad has chest tightness" }, { control: true });
add("R14", R, "E", { rawText: "she has a fever", patient: { ageMonths: 0 } }, { control: true, note: "ageMonths 0 is a valid newborn, not 'missing'" });

// ---------- T. language, script, ASR noise
const T = "T language/ASR";
add("T01", T, "E", { rawText: "मुझे सांस नहीं आ रही" }, { note: "Hindi: I can't breathe; native review" });
add("T02", T, "E", { rawText: "बच्चे को बुखार है, वो दो महीने का है" }, { note: "Hindi: infant 2 months with fever" });
add("T03", T, "ESC", { rawText: "सीने में बहुत दर्द है और पसीना आ रहा है" }, { note: "Hindi: chest pain + sweating" });
add("T04", T, "E", { rawText: "सांप ने काटा है" }, { note: "Hindi: snake bit" });
add("T05", T, "E", { rawText: "పాము కరిచింది" }, { note: "Telugu: snake bit; native review" });
add("T06", T, "ESC", { rawText: "ఛాతీలో నొప్పి, చెమట పడుతోంది" }, { note: "Telugu: chest pain, sweating" });
add("T07", T, "E", { rawText: "ఫిట్స్ వచ్చాయి" }, { note: "Telugu: fits came" });
add("T08", T, "E", { rawText: "baccha neela pad gaya hai aur saans nahi le raha" });
add("T09", T, "E", { rawText: "ulti mein khoon aa raha hai aur chakkar aa rahe hain" });
add("T10", T, "ESC", { rawText: "chaati lo noppi ga undi and sweating" }, { note: "Tenglish" });
add("T11", T, "E", { rawText: "naa bidda ki jwaram undi, remdu nelala papa" }, { note: "Tenglish: baby, 2 months, fever; native review" });
add("T12", T, "E", { rawText: "HELP!! HE CAN'T BREATHE!!!" });
add("T13", T, "E", { rawText: "i cant breathe" });
add("T14", T, "E", { rawText: "um, uh, my dad, he's, he's not able to, uh, speak" });
add("T15", T, "E", { rawText: "I can not breathe properly" });

// ---------- V. robustness / stale-denial semantics
const V = "V robustness";
add("V01", V, "NO_THROW", { rawText: "🙂🙂🙂" });
add("V02", V, "E", { rawText: "he is gasping", patient: { ageYears: NaN as unknown as number } }, { control: true });
add("V03", V, "E", { rawText: "he is gasping", patient: { ageYears: -5, ageMonths: 99999 } }, { control: true });
add("V04", V, "E", { rawText: "he is gasping", deniedSymptoms: ["gasping"] }, { note: "current mention must override an old denial" });
add("V05", V, "E", { rawText: "my father has face droop", deniedSymptoms: ["chest"] }, { control: true });
add("V06", V, "E", { rawText: "slurred speech and face droop", deniedSymptoms: ["face"] }, { note: "denial of one concept must not kill another" });
add("V07", V, "NO_THROW", { rawText: "ok", patient: { modifiers: null as unknown as string[], pregnancy: null as unknown as undefined } });
add("V08", V, "NO_THROW", { rawText: "x".repeat(300000) });

// ---------- runner
const RANK: Record<string, number> = { NONE: 0, DISCRIMINATE: 1, URGENT_SAME_DAY: 2, EMERGENCY_NOW: 3 };
const okFor = (e: Expect, level: string) => e === "E" ? level === "EMERGENCY_NOW" : e === "ESC" ? RANK[level] >= 1 : e === "NOT_E" ? level !== "EMERGENCY_NOW" : true;
const ev = (i: UniversalScreenInput) => { try { const r = evaluateUniversalRedFlags(i); return { level: r.level as string, rules: r.firedRules.map(f => f.ruleId).join(","), json: JSON.stringify(r) }; } catch (e) { return { level: "THROW", rules: String(e).slice(0, 50), json: "" }; } };

let hard = 0, soft = 0, pass = 0, ctrlFail = 0, expEsc = 0, hit = 0;
const hardBy: Record<string, number> = {};
const rows: string[] = [];
const baselinePass: Case[] = [];

for (const c of cases) {
  const t0 = performance.now(); const a = ev(c.input); const ms = performance.now() - t0; const b = ev(c.input);
  let ok = a.level !== "THROW" && okFor(c.expect, a.level);
  if (c.expect === "NO_THROW") ok = a.level !== "THROW" && ms < 250;
  const nondet = a.json !== b.json;
  if (c.expect === "E" || c.expect === "ESC") { expEsc++; if (ok) hit++; }
  let tag = "PASS      ";
  if (nondet) { hard++; hardBy["determinism"] = (hardBy["determinism"] || 0) + 1; tag = "NONDETERM "; }
  else if (ok) { pass++; if (c.expect !== "NO_THROW") baselinePass.push(c); }
  else if (c.control) { ctrlFail++; tag = "CTRL-FAIL "; }
  else if (c.expect !== "NOT_E") { hard++; hardBy[c.group] = (hardBy[c.group] || 0) + 1; tag = "FAIL-HARD "; }
  else { soft++; tag = "FAIL-SOFT "; }
  rows.push(`${tag}${c.id} ${c.expect.padEnd(8)} got=${a.level.padEnd(15)} ${a.rules.padEnd(14)} ${c.control ? "[ctrl] " : ""}${String(c.input.rawText).slice(0, 55)}${c.note ? "  // " + c.note : ""}`);
}
console.log(rows.join("\n"));

// ---------- metamorphic invariants (meaning-preserving edits must not weaken a passing result)
const tf: [string, (s: string) => string, boolean][] = [
  ["upper", s => s.toUpperCase(), true], ["spaces", s => s.replace(/ /g, "  "), true],
  ["prefix", s => "hello doctor, " + s, true], ["suffix", s => s + " it is a sunny day today.", true],
  ["curly", s => s.replace(/'/g, "’"), false], ["nopunct", s => s.replace(/[,.!?;:]/g, ""), true],
];
let metaBreaks = 0, metaChecks = 0;
const metaRows: string[] = [];
for (const c of baselinePass) {
  for (const [name, f] of tf) {
    const t = f(String(c.input.rawText)); if (t === c.input.rawText) continue;
    metaChecks++;
    const r = ev({ ...c.input, rawText: t });
    if (r.level === "THROW" || !okFor(c.expect, r.level)) { metaBreaks++; metaRows.push(`META-BREAK ${c.id} [${name}] expected ${c.expect}, got ${r.level}: ${t.slice(0, 60)}`); }
  }
}
if (metaRows.length) console.log("\n" + metaRows.join("\n"));
hard += metaBreaks; if (metaBreaks) hardBy["metamorphic"] = metaBreaks;

console.log("\n================ REGRESSION BATTERY v2 SUMMARY ================");
console.log(`cases: ${cases.length}  pass: ${pass}  HARD: ${hard}  SOFT: ${soft}  control-fail: ${ctrlFail}  metamorphic: ${metaBreaks}/${metaChecks} broken`);
console.log(`escalation recall on expected-escalation cases: ${hit}/${expEsc} = ${(100 * hit / expEsc).toFixed(1)}%`);
console.log("HARD by group:", JSON.stringify(hardBy));
if (ctrlFail) console.log("WARNING: control failed; the harness assumption is wrong for that case.");
process.exitCode = hard > 0 ? 1 : 0;
