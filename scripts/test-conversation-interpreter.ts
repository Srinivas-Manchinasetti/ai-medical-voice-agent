import { ConversationInterpreter } from "../lib/triage/conversation-interpreter";
import { DEFAULT_LOCALE_CONFIG, getEmergencyDispatchInstructions, LocaleConfig } from "../lib/config/locale";
import { PendingQuestion } from "../lib/agents/schemas";

async function runInterpreterTests() {
  console.log("==============================================================================");
  console.log("        CONVERSATION INTERPRETER & LOCALE CONFIG BENCHMARK HARNESS           ");
  console.log("==============================================================================");

  const interpreter = new ConversationInterpreter();
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (!condition) {
      console.error(`❌ FAILED: ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
    console.log(`✅ PASSED: ${desc}`);
    passed++;
  }

  // 1. Small Talk & Greetings
  console.log("\n--- 1. Greeting & Small Talk Detection ---");
  const t1 = interpreter.interpret("Hello doctor, can you hear me?");
  assert(t1.intent === "small_talk", "Detects greeting and microphone check as small talk");

  const t2 = interpreter.interpret("Hi there!");
  assert(t2.intent === "small_talk", "Detects informal greeting");

  // 2. Closing / Gratitude
  console.log("\n--- 2. Closing / Gratitude ---");
  const t3 = interpreter.interpret("Thank you so much doctor, bye!");
  assert(t3.intent === "closing", "Detects closing and gratitude");

  // 3. Emergency Panic Inquiry
  console.log("\n--- 3. Emergency Panic Inquiries ---");
  const t4 = interpreter.interpret("I think there is no one around for help... what do i do?", null, {}, true);
  assert(t4.intent === "emergency_inquiry", "Detects emergency inquiry when patient is alone");
  assert(t4.isEmergencyInquiry === true, "Flags isEmergencyInquiry flag");

  const t5 = interpreter.interpret("Who can I call? Should I call an ambulance?", null, {}, true);
  assert(t5.intent === "emergency_inquiry", "Detects ambulance/call inquiry");

  // 4. Confirmation / Anti-Loop Detection
  console.log("\n--- 4. Confirmation & Anti-Loop Detection ---");
  const pendingRad: PendingQuestion = {
    id: "q-rad-1",
    targetSlot: "radiation",
    askedBy: "marcus",
    doctorName: "Dr. Marcus Vance",
    patientFacingSpeaker: "sarah",
    question: "Does the discomfort travel anywhere?",
    purpose: "Evaluate ACS radiation",
    required: true,
    priority: "high",
    status: "pending",
    createdAt: new Date().toISOString(),
    caseVersion: 1
  };

  const t6 = interpreter.interpret("I said head?", pendingRad, { radiation: "head" });
  assert(t6.intent === "confirmation_or_correction", "Detects patient repetition 'I said head?'");
  assert(t6.isConfirmationOrRepetition === true, "Flags isConfirmationOrRepetition flag");

  const t7 = interpreter.interpret("Like I said, to my head", pendingRad, { radiation: "head" });
  assert(t7.intent === "confirmation_or_correction", "Detects 'Like I said, to my head'");

  // 5. Slot Resolution for Pending Questions
  console.log("\n--- 5. Slot Resolution for Pending Questions ---");
  const t8 = interpreter.interpret("Well to my head actually.", pendingRad, {});
  assert(t8.intent === "answer_pending_question", "Identifies answer to pending question");
  assert(t8.resolvedSlot === "radiation", "Resolves slot as radiation");
  assert(t8.resolvedValue === "head", "Resolves value as head");

  const pendingExertional: PendingQuestion = {
    id: "q-ex-1",
    targetSlot: "exertional",
    askedBy: "marcus",
    doctorName: "Dr. Marcus Vance",
    patientFacingSpeaker: "sarah",
    question: "Does it happen when climbing stairs?",
    purpose: "Assess exertional angina",
    required: true,
    priority: "high",
    status: "pending",
    createdAt: new Date().toISOString(),
    caseVersion: 1
  };

  const t9 = interpreter.interpret("It starts when climbing stairs.", pendingExertional, {});
  assert(t9.resolvedSlot === "exertional", "Resolves exertional slot");
  assert(Boolean(t9.resolvedValue?.includes("positive")), "Resolves positive exertional relation");

  const pendingOnset: PendingQuestion = {
    id: "q-on-1",
    targetSlot: "onset",
    askedBy: "sarah",
    doctorName: "Dr. Sarah Chen",
    patientFacingSpeaker: "sarah",
    question: "When did this begin?",
    purpose: "Assess onset",
    required: true,
    priority: "high",
    status: "pending",
    createdAt: new Date().toISOString(),
    caseVersion: 1
  };

  const t10 = interpreter.interpret("About 20 minutes ago and it got worse suddenly", pendingOnset, {});
  assert(t10.resolvedSlot === "onset", "Resolves onset slot");
  assert(Boolean(t10.resolvedValue?.includes("acute worsening")), "Captures sudden acute worsening in onset");

  // 6. Configurable Emergency Dispatch Instructions
  console.log("\n--- 6. Configurable Emergency Dispatch Guidance ---");
  const defaultInstructions = getEmergencyDispatchInstructions(DEFAULT_LOCALE_CONFIG);
  assert(defaultInstructions.includes("911"), "Default locale emits 911");
  assert(defaultInstructions.includes("speakerphone"), "Advises speakerphone");
  assert(defaultInstructions.includes("unlock your front door"), "Advises unlocking door for EMS entry");
  assert(defaultInstructions.includes("Do not hang up"), "Advises not hanging up");

  const euConfig: LocaleConfig = {
    locale: "en-GB",
    country: "United Kingdom",
    emergencyNumber: "999",
    alternateEmergencyNumbers: ["112"],
    medicalDispatchName: "NHS Emergency Ambulance",
  };
  const ukInstructions = getEmergencyDispatchInstructions(euConfig);
  assert(ukInstructions.includes("999"), "UK locale emits 999");

  const indiaConfig: LocaleConfig = {
    locale: "en-IN",
    country: "India",
    emergencyNumber: "108",
    alternateEmergencyNumbers: ["112"],
    medicalDispatchName: "Emergency Response Service",
  };
  const inInstructions = getEmergencyDispatchInstructions(indiaConfig);
  assert(inInstructions.includes("108"), "India locale emits 108");

  console.log("\n==============================================================================");
  console.log(`✅ ALL ${passed}/${total} CONVERSATION INTERPRETER & LOCALE INVARIANTS PASSED!`);
  console.log("==============================================================================");
}

runInterpreterTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
