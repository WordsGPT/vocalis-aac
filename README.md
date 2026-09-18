# 🎙️ Vocalis AAC - Real-Time Voice Communication Assistant

**Vocalis AAC** is an assistive speech application designed specifically for mute and non-verbal individuals to engage in natural, real-time spoken conversations.

---

## ⚡ How It Works

```mermaid
graph TD
    A["Partner Speaks"] -->|"Microphone (Web Speech / Whisper GPU)"| B["Speech-to-Text (STT)"]
    B -->|"Live Transcript"| C["Smart Response Engine"]
    C -->|"Ollama Gemma 3 / Gemini / Heuristics"| D["3 Contextual Response Cards"]
    D -->|"Mute User selects Option 1, 2, or 3"| E["Text-to-Speech (TTS)"]
    E -->|"Edge-TTS Neural / Browser Synthesis"| F["Spoken Aloud Aloud to Partner"]
```

1. **Ambient Listening (Speech-to-Text)**:
   - The conversational partner speaks naturally.
   - Captured in real-time via Web Speech API with interim typing results or local GPU Whisper (`/api/transcribe`).
   - Live visual audio meter indicates incoming speech.

2. **3 Contextual Smart Suggestions**:
   - The app instantly generates 3 natural, first-person replies matching different conversational intents:
     - **Option 1**: Affirmative / Enthusiastic / Agree
     - **Option 2**: Inquiry / Alternative / Thoughtful
     - **Option 3**: Polite Decline / Boundary / Pass
   - Powered locally by **Ollama (`gemma3:4b`)**, with instant heuristic fallback (0ms) and optional **Google Gemini** cloud support.

3. **Single-Tap or Hotkey Selection & TTS**:
   - The user selects an option by tapping the card or pressing keyboard keys **`1`**, **`2`**, or **`3`**.
   - The app immediately speaks the chosen phrase out loud using **Neural Edge-TTS** (human studio voices) or **Browser Web SpeechSynthesis**.
   - Active "Speaking..." badge shows the user and listener that speech is underway.

4. **AAC Essentials**:
   - **Quick Emergency & Status Pills**: *"Please give me a moment, I am using a speech device"*, *"Yes"*, *"No"*, *"Thank you"*, *"Could you please repeat that?"*.
   - **Type-to-Speak**: Freeform text input with instant speech synthesis.
   - **Interactive Dialogue History**: Replay past statements anytime if someone didn't catch what you said.

---

## 🚀 Quick Start

To launch both the backend and frontend with a single command:

```bash
./run.sh
```

- **Frontend Application**: [http://localhost:5173](http://localhost:5173) (or [http://localhost:8000](http://localhost:8000))
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 🛠️ Architecture & Technologies

- **Frontend**:
  - React 19 + Vite 8
  - Tailwind CSS
  - Lucide Icons
  - Web Speech API (`SpeechRecognition` & `SpeechSynthesis`)
  - Web Audio API (real-time frequency visualizer)
- **Backend**:
  - FastAPI + Uvicorn
  - PyTorch CUDA GPU acceleration
  - OpenAI Whisper (local automatic speech recognition)
  - Edge-TTS (studio-quality neural voice synthesis)
  - Ollama client (local Gemma 3 4B)
  - Google Gemini API client (optional cloud boost)

---

## ⚙️ Configuration & Customization

Open the **Settings** modal in the top right to customize:
- **Voice Provider**: Switch between Browser System Voices and Neural Edge-TTS voices (Guy, Jenny, Aria, Christopher, Ryan, Sonia, etc.).
- **Voice Rate & Pitch**: Fine-tune speed and pitch with a live "Test Voice" preview.
- **AI Tone**: Natural, Casual & Friendly, Professional, Concise (1-3 words), or Warm & Empathetic.
- **AI Engine**: Auto, Local Ollama Gemma 3, Cloud Gemini, or Instant Heuristic.
- **STT Engine**: Auto (Web Speech with Whisper fallback) or Dedicated Whisper GPU.
