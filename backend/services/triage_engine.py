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

import re

NEGATION_PATTERNS = [
    re.compile(r"(?:no|denies|without|never|rules?\s+out|negative\s+for|not|free\s+of)(?:\s+[a-z0-9_-]+){0,3}\s+(?:or|and|/)\s*$", re.IGNORECASE),
    re.compile(r"(?:no|denies|without|never|rules?\s+out|negative\s+for|not|free\s+of)(?:\s+[a-z0-9_-]+){0,3}\s*$", re.IGNORECASE)
]

def is_negated(text: str, keyword: str) -> bool:
    idx = text.lower().find(keyword.lower())
    if idx == -1:
        return False
    window_start = max(0, idx - 70)
    window = text[window_start:idx].strip()
    return any(p.search(window) is not None for p in NEGATION_PATTERNS)

def has_affirmative(text: str, keywords: List[str]) -> bool:
    text_lower = text.lower()
    for kw in keywords:
        if kw.lower() in text_lower and not is_negated(text, kw):
            return True
    return False

def heuristic_triage(transcript: str) -> Dict[str, Any]:
    text = transcript.strip()
    text_lower = text.lower()
    
    # 1. Cardiovascular / ACS Red Flags (ESI 1 / 2)
    has_chest_pain = has_affirmative(text, [
        "chest pain", "crushing pressure", "heavy chest", "tightness in chest",
        "elephant on chest", "squeezing chest", "substernal"
    ])
    has_cardiac_radiation = has_affirmative(text, [
        "left arm", "jaw pain", "neck pain", "between shoulder blades", "cold sweats", "diaphoresis"
    ])
    
    # 2. Neurological / BE-FAST Acute Stroke Red Flags (ESI 2)
    has_stroke_symptoms = has_affirmative(text, [
        "facial droop", "facial drooping", "face drooping", "arm weakness",
        "slurred speech", "cannot speak", "sudden numbness", "loss of speech", "sudden confusion"
    ])
    
    # 3. Airway / Severe Respiratory Collapse / Anaphylaxis (ESI 1 / 2)
    has_airway_collapse = has_affirmative(text, [
        "cannot breathe", "stridor", "blue lips", "gasping for air",
        "throat swelling", "tongue swelling", "anaphylaxis", "severe allergic reaction", "unconscious"
    ])
    
    # 4. Priority / Urgent Symptoms (ESI 3 / 4)
    has_priority = has_affirmative(text, [
        "fever", "high temp", "cough", "lethargic", "vomiting", "severe pain",
        "earache", "abdominal pain", "burn", "infection", "shortness of breath", "difficulty breathing"
    ])
    
    if has_chest_pain or has_stroke_symptoms or has_airway_collapse:
        detected_symptoms = []
        icd10 = []
        specialty = "Emergency Medicine"
        
        if has_chest_pain:
            detected_symptoms.extend(["Substernal Chest Pressure", "Cardiac Discomfort"])
            if has_cardiac_radiation:
                detected_symptoms.append("Radiation / Diaphoresis")
            icd10.extend(["I20.9", "I21.9", "R07.9"])
            specialty = "Interventional Cardiology"
        if has_stroke_symptoms:
            detected_symptoms.extend(["Acute Neurological Deficit", "Facial Droop / Dysarthria"])
            icd10.extend(["I63.9", "R47.01"])
            specialty = "Neurology & Stroke Care"
        if has_airway_collapse:
            detected_symptoms.extend(["Severe Respiratory Distress / Airway Compromise"])
            icd10.extend(["R06.03", "T78.2XXA"])
            specialty = "Emergency Resuscitation"
            
        return {
            "triage_level": "emergency",
            "triage_title": "ESI LEVEL 2: EMERGENT CLINICAL ESCALATION",
            "icd10_codes": list(dict.fromkeys(icd10)),
            "detected_symptoms": detected_symptoms,
            "recommended_action": f"Immediate 911 / EMS dispatch to certified ER. Alert On-Call {specialty}.",
            "soap_summary": f"S: Patient presents with acute red flag complaint: '{transcript}'. O: Negation-verified affirmative critical signs: {', '.join(detected_symptoms)}. A: Emergent high-risk clinical presentation. P: Trigger pre-arrival protocol, direct transfer to acute emergency care.",
            "engine": "Canonical Clinical Safety Arbiter (Negation-Aware Local Engine)"
        }
    elif has_priority:
        symptoms = [kw.title() for kw in ["fever", "cough", "vomiting", "abdominal pain", "burn", "infection", "shortness of breath"] if kw in text_lower and not is_negated(text, kw)]
        if not symptoms:
            symptoms = ["Priority Clinical Symptoms"]
            
        return {
            "triage_level": "priority",
            "triage_title": "ESI LEVEL 3: URGENT MEDICAL EVALUATION",
            "icd10_codes": ["R50.9", "J06.9", "R10.9"],
            "detected_symptoms": symptoms,
            "recommended_action": "Schedule same-day urgent care or clinic appointment within 2-4 hours.",
            "soap_summary": f"S: Patient reports priority symptoms: '{transcript}'. O: Non-critical stable indicators verified; no life-threatening red flags affirmative. A: ESI 3 Urgent presentation. P: Reserve same-day clinical slot.",
            "engine": "Canonical Clinical Safety Arbiter (Negation-Aware Local Engine)"
        }
    else:
        # Non-urgent / routine or explicitly negated symptoms
        negated_reassurances = [kw for kw in ["chest pain", "shortness of breath", "fever"] if kw in text_lower and is_negated(text, kw)]
        reassurance_note = f" (Verified negative for: {', '.join(negated_reassurances)})" if negated_reassurances else ""
        
        return {
            "triage_level": "routine",
            "triage_title": "ESI LEVEL 4/5: ROUTINE OUTPATIENT CARE",
            "icd10_codes": ["Z76.0", "J00"],
            "detected_symptoms": ["Mild / Routine Complaint" + reassurance_note],
            "recommended_action": "Schedule routine outpatient physician visit or provide supportive home care guidelines.",
            "soap_summary": f"S: Patient reports mild or routine presentation: '{transcript}'. O: No active emergency or priority indicators detected{reassurance_note}. A: Non-urgent clinical status. P: Routine care instructions and follow-up.",
            "engine": "Canonical Clinical Safety Arbiter (Negation-Aware Local Engine)"
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
