# 🩺 AI Medical Voice Agent

> **Intelligent Patient Care & Clinical Voice Triage Platform**  
> Deliver instant, empathetic medical voice assistance 24/7. Automate appointment scheduling, symptom evaluation, emergency ER escalation, and EHR SOAP documentation with zero call wait times.

---

## 🌟 Key Capabilities & Features

- **🎙️ Interactive Voice Call Simulator**: Live conversational speech interface simulating real-time patient interactions (Urgent Chest Pain, Pediatric Fever, Post-Op Rx Refill).
- **📋 Real-Time Symptom & Entity Mining**: Automatically isolates chief complaints, duration, severity, and tags standard ICD-10 medical codes during natural patient speech.
- **📄 Automated SOAP Note Generation**: Eliminates manual charting by capturing structured Subjective, Objective, Assessment, and Plan (SOAP) records ready for provider signature.
- **🌐 Multilingual Voice Support**: Real-time natural speech translation across 30+ languages (English, Spanish, Mandarin, Hindi, Telugu, French).
- **🚨 Emergency Escalation Routing**: Instantly flags red-flag cardiac and neurological emergency symptoms to patch calls directly to 911 or on-call triage nurses.
- **🛡️ Enterprise Security & Privacy**: Designed for HIPAA compliance guidelines with TLS 1.3 voice stream encryption, AES-256 storage, and zero-retention voice pipelines.

---

## 🛠️ Technology Stack

### Frontend & Web Application
- **Framework**: [Next.js 16 (App Router)](https://nextjs.org/)
- **UI Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/), [Tabler Icons](https://tabler-icons.io/)

### Backend Microservice & Audio Processing (Specs)
- **API Framework**: [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/)
- **AI Speech & NLP**: OpenAI Whisper, gTTS, Pyttsx3, LangChain
- **Audio DSP**: PyAudio, SoundFile, SciPy, NumPy

---

## 📁 Directory Structure

```text
ai-medical-voice-agent/
├── app/
│   ├── _components/
│   │   ├── Navbar.tsx                   # Floating glassmorphic header
│   │   ├── VoiceCallSimulator.tsx       # Live interactive voice call simulator
│   │   ├── FeatureBentoGrid.tsx         # Clinical capabilities bento grid
│   │   ├── WorkflowSection.tsx          # 5-step conversation to care workflow
│   │   ├── UseCasesSection.tsx          # Solution cards (Intake, Rx, Urgent)
│   │   ├── CareTeamSection.tsx          # Operational impact & safety boundaries
│   │   ├── MultilingualSection.tsx      # Spoken language translation showcase
│   │   ├── SecuritySection.tsx          # HIPAA & encryption safeguards
│   │   └── Footer.tsx                   # Deep slate footer with status badge
│   ├── globals.css                      # Global styles, fonts, and design tokens
│   ├── layout.tsx                       # Root layout with hydration suppression
│   └── page.tsx                         # Main landing page composition
├── public/                              # Static brand assets & icons
├── package.json                         # Node.js dependencies & scripts
├── requirements.txt                     # Python backend requirements
├── tsconfig.json                        # TypeScript configuration
└── README.md                            # Documentation
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your machine:
- **Node.js** >= 18.17.0
- **npm** >= 9.0.0
- *(Optional)* **Python** >= 3.10 (for backend voice processing scripts)

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/Srinivas-Manchinasetti/ai-medical-voice-agent.git
   cd ai-medical-voice-agent
   ```

2. **Install Node Dependencies**
   ```bash
   npm install
   ```

3. **Start the Development Server**
   ```bash
   npm run dev
   ```

4. **Open in Browser**  
   Navigate to [http://localhost:3000](http://localhost:3000) to view the running application.

---

## 🐍 Python Backend Setup (Optional)

If running the Python audio processing microservice backend:

```bash
# Create virtual environment
python -m venv venv

# Activate environment (Windows)
.\venv\Scripts\activate

# Install Python requirements
pip install -r requirements.txt
```

---

## 🔒 Security & Medical Disclaimer

> **Notice**: MediVoice AI is designed as a clinical decision support and triage intake assistant. It is intended to streamline intake workflows for healthcare providers. In the event of a life-threatening medical emergency, patients should always contact 911 immediately.

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.
