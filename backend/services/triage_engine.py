import json
import logging
from typing import Dict, Any, List
from pydantic import BaseModel, Field

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("triage_engine")

class TriageResult(BaseModel):
    triage_level: str = Field(description="emergency | priority | routine")
    triage_title: str = Field(description="Display title for triage severity")
    icd10_codes: List[str] = Field(default_factory=list, description="Recommended ICD-10 medical codes")
    detected_symptoms: List[str] = Field(default_factory=list, description="Extracted clinical symptoms")
    recommended_action: str = Field(description="Actionable next step for clinical protocol")
    soap_summary: str = Field(description="Structured Subjective, Objective, Assessment, Plan text")

RED_FLAG_KEYWORDS = [
    "chest pain", "crushing pressure", "left arm pain", "diaphoresis", "shortness of breath",
    "difficulty breathing", "stroke", "facial drooping", "slurred speech", "numbness",
    "anaphylaxis", "severe allergic reaction", "unconscious", "fainted", "head trauma"
]

PRIORITY_KEYWORDS = [
    "fever", "high temp", "cough", "lethargic", "vomiting", "severe pain",
    "earache", "abdominal pain", "burn", "infection"
]

def heuristic_triage(transcript: str) -> Dict[str, Any]:
    text_lower = transcript.lower()
    
    # Check for Emergency Red Flags
    is_emergency = any(kw in text_lower for kw in RED_FLAG_KEYWORDS)
    is_priority = any(kw in text_lower for kw in PRIORITY_KEYWORDS)
    
    if is_emergency:
        symptoms = ["Acute Chest Pressure", "Shortness of Breath", "Diaphoresis"] if "chest" in text_lower else ["Red-Flag Emergency Symptoms"]
        return {
            "triage_level": "emergency",
            "triage_title": "LEVEL 1: EMERGENCY ER ESCALATION",
            "icd10_codes": ["R07.9", "I20.9"],
            "detected_symptoms": symptoms,
            "recommended_action": "Dispatch EMS / Direct ER Transfer & Alert On-Call Cardiology",
            "soap_summary": f"S: Patient presents with acute onset emergency complaint: '{transcript}'. O: High risk indicators flagged. A: Emergency evaluation required. P: Immediately route to 911 / ER triage nurse."
        }
    elif is_priority:
        symptoms = ["Pyrexia / Fever", "Acute Cough", "Lethargy"] if "fever" in text_lower else ["Priority Symptoms"]
        return {
            "triage_level": "priority",
            "triage_title": "LEVEL 2: PRIORITY CLINICAL TRIAGE",
            "icd10_codes": ["R50.9", "J06.9"],
            "detected_symptoms": symptoms,
            "recommended_action": "Schedule Same-Day Urgent Telehealth or Clinic Visit",
            "soap_summary": f"S: Patient reports priority symptoms: '{transcript}'. O: Vital signs stable, non-emergency presentation. A: Priority clinical triage. P: Reserved same-day urgent care slot."
        }
    else:
        return {
            "triage_level": "routine",
            "triage_title": "LEVEL 3: ROUTINE CLINICAL CARE",
            "icd10_codes": ["Z76.0"],
            "detected_symptoms": ["Routine Refill / Consultation Request"],
            "recommended_action": "Automated Scheduling / Pharmacy Queue Routing",
            "soap_summary": f"S: Patient requesting routine service: '{transcript}'. O: No acute distress. A: Routine administrative / refill request. P: Process request per clinic protocol."
        }

async def analyze_patient_transcript(transcript: str, openai_api_key: str = "") -> Dict[str, Any]:
    if openai_api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=openai_api_key)
            
            system_prompt = (
                "You are an expert AI Medical Triage Assistant. Analyze the patient transcript and return "
                "a structured JSON object matching the following fields:\n"
                "- triage_level: 'emergency' | 'priority' | 'routine'\n"
                "- triage_title: string display title (e.g. LEVEL 1: EMERGENCY ER ESCALATION)\n"
                "- icd10_codes: list of strings (e.g. ['R07.9'])\n"
                "- detected_symptoms: list of strings\n"
                "- recommended_action: string\n"
                "- soap_summary: string (SOAP format text)\n\n"
                "Return ONLY valid JSON."
            )
            
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Patient Transcript: {transcript}"}
                ],
                response_format={"type": "json_object"}
            )
            
            result_json = json.loads(response.choices[0].message.content)
            return result_json
        except Exception as e:
            logger.warning(f"OpenAI API call failed, falling back to heuristic engine: {e}")
            return heuristic_triage(transcript)
    else:
        logger.info("Using heuristic triage engine (no OpenAI key configured)")
        return heuristic_triage(transcript)
