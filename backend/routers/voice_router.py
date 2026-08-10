import json
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

from backend.config import settings
from backend.services.triage_engine import analyze_patient_transcript
from backend.services.audio_service import synthesize_speech_text, transcribe_audio_bytes

logger = logging.getLogger("voice_router")
router = APIRouter(prefix="/api/v1", tags=["Voice & Triage"])

class TriageRequest(BaseModel):
    transcript: str
    patient_id: Optional[str] = "P-1002"
    patient_name: Optional[str] = "Anonymous Patient"

class TTSRequest(BaseModel):
    text: str
    language: Optional[str] = "en"

@router.post("/triage")
async def process_triage(request: TriageRequest):
    if not request.transcript or not request.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript text cannot be empty.")
    
    logger.info(f"Processing triage for patient '{request.patient_id}': {request.transcript[:60]}...")
    result = await analyze_patient_transcript(
        transcript=request.transcript,
        openai_api_key=settings.OPENAI_API_KEY
    )
    return {
        "status": "success",
        "patient_id": request.patient_id,
        "patient_name": request.patient_name,
        "triage": result
    }

@router.post("/stt")
async def speech_to_text(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Uploaded audio file is empty.")
        
        transcript = transcribe_audio_bytes(
            audio_bytes=audio_bytes,
            openai_api_key=settings.OPENAI_API_KEY
        )
        return {"status": "success", "transcript": transcript}
    except Exception as e:
        logger.error(f"STT Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/tts")
async def text_to_speech(request: TTSRequest):
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    
    audio_bytes = synthesize_speech_text(text=request.text, lang=request.language)
    return Response(content=audio_bytes, media_type="audio/mpeg")

@router.websocket("/ws/call")
async def voice_websocket_call(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket voice streaming session connected")
    
    try:
        # Send initial handshake message
        await websocket.send_json({
            "type": "handshake",
            "message": "Connected to MediVoice AI Streaming Backend Node",
            "status": "active"
        })
        
        while True:
            data = await websocket.receive_text()
            try:
                payload = json.loads(data)
                user_text = payload.get("text", "")
                
                if user_text:
                    triage_res = await analyze_patient_transcript(
                        transcript=user_text,
                        openai_api_key=settings.OPENAI_API_KEY
                    )
                    
                    response_payload = {
                        "type": "triage_update",
                        "text": f"Thank you. I have analyzed your symptoms and flagged this as {triage_res.get('triage_level', 'routine')}.",
                        "triage": triage_res
                    }
                    await websocket.send_json(response_payload)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON format"})
                
    except WebSocketDisconnect:
        logger.info("WebSocket voice streaming session disconnected")
