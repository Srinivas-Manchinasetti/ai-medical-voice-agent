import json
import logging
from typing import Dict, Any, List
from pydantic import BaseModel, Field

from backend.config import settings

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
            "soap_summary": f"S: Patient presents with acute onset emergency complaint: '{transcript}'. O: High risk indicators flagged. A: Emergency evaluation required. P: Immediately route to 911 / ER triage nurse.",
            "engine": "Heuristic Local Engine (Free)"
        }
    elif is_priority:
        symptoms = ["Pyrexia / Fever", "Acute Cough", "Lethargy"] if "fever" in text_lower else ["Priority Symptoms"]
        return {
            "triage_level": "priority",
            "triage_title": "LEVEL 2: PRIORITY CLINICAL TRIAGE",
            "icd10_codes": ["R50.9", "J06.9"],
            "detected_symptoms": symptoms,
            "recommended_action": "Schedule Same-Day Urgent Telehealth or Clinic Visit",
            "soap_summary": f"S: Patient reports priority symptoms: '{transcript}'. O: Vital signs stable, non-emergency presentation. A: Priority clinical triage. P: Reserved same-day urgent care slot.",
            "engine": "Heuristic Local Engine (Free)"
        }
    else:
        return {
            "triage_level": "routine",
            "triage_title": "LEVEL 3: ROUTINE CLINICAL CARE",
            "icd10_codes": ["Z76.0"],
            "detected_symptoms": ["Routine Refill / Consultation Request"],
            "recommended_action": "Automated Scheduling / Pharmacy Queue Routing",
            "soap_summary": f"S: Patient requesting routine service: '{transcript}'. O: No acute distress. A: Routine administrative / refill request. P: Process request per clinic protocol.",
            "engine": "Heuristic Local Engine (Free)"
        }

async def analyze_with_openai_compatible_api(
    transcript: str,
    api_key: str,
    base_url: str,
    model_name: str,
    engine_name: str
) -> Dict[str, Any]:
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=api_key, base_url=base_url)
    
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
        model=model_name,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Patient Transcript: {transcript}"}
        ],
        response_format={"type": "json_object"}
    )
    
    result_json = json.loads(response.choices[0].message.content)
    result_json["engine"] = engine_name
    return result_json

async def analyze_patient_transcript(transcript: str, openai_api_key: str = "") -> Dict[str, Any]:
    # 1. Try NVIDIA NIM API (Free tier on build.nvidia.com)
    if settings.NVIDIA_API_KEY:
        try:
            logger.info(f"Using NVIDIA NIM API ({settings.NVIDIA_MODEL}) for clinical triage...")
            return await analyze_with_openai_compatible_api(
                transcript=transcript,
                api_key=settings.NVIDIA_API_KEY,
                base_url=settings.NVIDIA_BASE_URL,
                model_name=settings.NVIDIA_MODEL,
                engine_name=f"NVIDIA NIM Cloud ({settings.NVIDIA_MODEL})"
            )
        except Exception as e:
            logger.warning(f"NVIDIA NIM API call failed: {e}")

    # 2. Try Groq API (Free tier on console.groq.com)
    if settings.GROQ_API_KEY:
        try:
            logger.info(f"Using Groq Cloud API ({settings.GROQ_MODEL}) for clinical triage...")
            return await analyze_with_openai_compatible_api(
                transcript=transcript,
                api_key=settings.GROQ_API_KEY,
                base_url=settings.GROQ_BASE_URL,
                model_name=settings.GROQ_MODEL,
                engine_name=f"Groq Cloud ({settings.GROQ_MODEL})"
            )
        except Exception as e:
            logger.warning(f"Groq Cloud API call failed: {e}")

    # 3. Try OpenAI API
    api_key_to_use = settings.OPENAI_API_KEY or openai_api_key
    if api_key_to_use:
        try:
            logger.info("Using OpenAI API for clinical triage...")
            return await analyze_with_openai_compatible_api(
                transcript=transcript,
                api_key=api_key_to_use,
                base_url="https://api.openai.com/v1",
                model_name="gpt-4o-mini",
                engine_name="OpenAI GPT-4o-mini"
            )
        except Exception as e:
            logger.warning(f"OpenAI API call failed: {e}")

    # 4. Fallback: Local Heuristic Triage Engine ($0 cost, 0 latency)
    logger.info("Using Local Heuristic Triage Engine ($0 cost, instant fallback)")
    return heuristic_triage(transcript)
