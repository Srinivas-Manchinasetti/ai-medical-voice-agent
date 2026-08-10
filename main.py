"""
Root entrypoint wrapper for AI Medical Voice Agent Python FastAPI Microservice Backend.
Run using:
    python main.py
or
    uvicorn main:app --reload
"""

import sys
import os

# Add root directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.main import app

if __name__ == "__main__":
    import uvicorn
    from backend.config import settings
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
