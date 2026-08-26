export interface CallScenario {
  id: string;
  title: string;
  patientName: string;
  patientDetails: string;
  badge: string;
  badgeStyle: string;
  duration: string;
  waveformColor: string;
  dialogue: {
    speaker: "Patient" | "MediVoice";
    text: string;
    time: string;
  }[];
  outcomes: string[];
}

export const CALL_SCENARIOS: CallScenario[] = [
  {
    id: "pediatric",
    title: "Same-Day Pediatric Triage",
    patientName: "Sarah Vance (for Leo, 4yo)",
    patientDetails: "Patient MRN #394012 • Pediatric Intake",
    badge: "Priority Care",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/80 font-semibold",
    duration: "01:14",
    waveformColor: "from-teal-500 via-cyan-400 to-blue-500",
    dialogue: [
      {
        speaker: "Patient",
        text: "Hi, my 4-year-old son Leo has a fever of 102.4°F and a persistent cough. He's quite lethargic, but he's drinking water.",
        time: "00:12",
      },
      {
        speaker: "MediVoice",
        text: "I understand your concern, Sarah. Since Leo is responsive and drinking fluids, I can book an urgent same-day appointment with Dr. Vance today at 2:30 PM. Would that work for you?",
        time: "00:28",
      },
      {
        speaker: "Patient",
        text: "Yes, 2:30 PM works great. Thank you so much!",
        time: "00:36",
      },
      {
        speaker: "MediVoice",
        text: "You're all set! I've confirmed the 2:30 PM appointment and sent pediatric fever management guidance to your phone via SMS.",
        time: "00:45",
      },
    ],
    outcomes: [
      "Booked Same-Day Telehealth (2:30 PM)",
      "Pediatric Care Instructions Sent via SMS",
      "SOAP Note Pushed to Epic EHR",
    ],
  },
  {
    id: "cardiac",
    title: "Urgent ER Escalation",
    patientName: "Robert Miller (58yo M)",
    patientDetails: "Patient MRN #884920 • Acute Cardiac Triage",
    badge: "Emergency ER",
    badgeStyle: "bg-rose-50 text-rose-700 border-rose-200/80 font-bold animate-pulse",
    duration: "00:48",
    waveformColor: "from-rose-500 via-red-400 to-amber-400",
    dialogue: [
      {
        speaker: "Patient",
        text: "I'm having a heavy, crushing chest pressure radiating to my left arm... I'm sweating heavily and feeling short of breath...",
        time: "00:08",
      },
      {
        speaker: "MediVoice",
        text: "Robert, based on your symptoms, this requires emergency medical evaluation. I am immediately alerting 911 EMS and patching you to our on-call ER triage nurse.",
        time: "00:22",
      },
    ],
    outcomes: [
      "Immediate 911 Emergency Dispatch Triggered",
      "Direct Warm Transfer to ER Nurse Line",
      "Pre-Arrival Cardiac Alert Sent to ER",
    ],
  },
  {
    id: "refill",
    title: "Automated Rx Refill",
    patientName: "Elena Rostova (34yo F)",
    patientDetails: "Patient MRN #552109 • Post-Op Dental Care",
    badge: "Routine Refill",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200/80 font-semibold",
    duration: "00:52",
    waveformColor: "from-emerald-500 via-teal-400 to-cyan-400",
    dialogue: [
      {
        speaker: "Patient",
        text: "Hi, I had wisdom tooth surgery 3 days ago with Dr. Aris and need a refill on my post-op pain medication.",
        time: "00:10",
      },
      {
        speaker: "MediVoice",
        text: "I've verified your procedure history and allergy profile—no contraindications found. I'm submitting the refill request to CVS Pharmacy for provider sign-off.",
        time: "00:26",
      },
    ],
    outcomes: [
      "Allergy & Contraindication Check Cleared",
      "Refill Order Queued for Provider E-Sign",
      "Automated Follow-Up Call Scheduled",
    ],
  },
];
