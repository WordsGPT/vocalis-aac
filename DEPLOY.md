# Deploy Vocalis to Vercel

The Vercel project root is this repository root. `vercel.json` builds the React app in `frontend/` and routes `/api/*` to the small FastAPI function in `api/index.py`. The older `backend/app.py` and Qwen runtime are for the previous local setup and are not used by this deployment.

## Configure

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey). Ensure the project has access to `gemini-3.8-flash` and `gemini-3.8-flash-tts`, including the Voices API.
2. Import this repository into Vercel. Set the **Root Directory** to the repository root.
3. Add these **server-side** environment variables for every environment you will use (Production and Preview): `GROQ_API_KEY`, `GEMINI_API_KEY`, `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_SECRET`. Generate the secret with `openssl rand -hex 32`. Choose a long unique password. Do not prefix any of these names with `VITE_`.
4. Deploy. The AAC board opens publicly. Sign in inside voice settings to create or use a personal cloned voice. Changing `AUTH_SECRET` logs out existing voice sessions. Sessions last seven days.

Both API keys stay in the Python function; the browser never receives them. Groq suggestions and transcription are publicly callable. Gemini text suggestions and the prebuilt Gemini voices are also public when selected. Creating a personal cloned voice, and synthesizing with a `voice_...` ID, require the signed, HttpOnly session cookie.

## Voice replication

The speaker must be an adult and record a 10–30 second reference sample plus a separate recording of Google's exact Spanish consent statement shown in the app. The browser converts both clips to 24 kHz mono WAV before upload. Gemini stores the replicated voice in your Google project and returns a `voice_...` ID. Vocalis saves that ID in this browser's settings; copy it into settings on another device to use the same voice. The server does not persist audio or voice IDs.

Google currently limits Vercel function request and response bodies to 4.5 MB. Vocalis limits uploads and generated speech to stay under that ceiling. Longer speech may need to be split into phrases.

## Local development

Install the root Python dependencies with `pip install -r requirements.txt`, put real values in a local `.env` (or export them in your shell), then run `uvicorn api.index:app --reload --port 8000 --env-file .env` from the root. In a second terminal, run `cd frontend && npm ci && npm run dev`. Vite proxies `/api` to port 8000.
