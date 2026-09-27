# Deploy Vocalis to Vercel

The Vercel project root is this repository root. `vercel.json` builds the React app in `frontend/` and copies it into Vercel's `public/` directory. `/api/*` routes to the small FastAPI function in `api/index.py`. The older `backend/app.py` and Qwen runtime are for the previous local setup and are not used by this deployment.

## Configure

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/apikey). Ensure the project has access to `gemini-3.8-flash` and `gemini-3.8-flash-tts`, including the Voices API.
2. Import this repository into Vercel. Set the **Root Directory** to the repository root.
3. Add these **server-side** environment variables for every environment you will use (Production and Preview): `GROQ_API_KEY`, `GEMINI_API_KEY`, `AUTH_USERNAME`, `AUTH_PASSWORD`, and `AUTH_SECRET`. Generate the secret with `openssl rand -hex 32`. Choose a long unique password. Do not prefix any of these names with `VITE_`.
4. Deploy. The AAC board opens publicly with Groq suggestions and transcription. Sign in inside settings to use Gemini suggestions, speech, and voice cloning. Changing `AUTH_PASSWORD` or `AUTH_SECRET` logs out existing sessions. Sessions last seven days.

## Limit login attempts

In the Vercel project dashboard, open **Firewall → Configure → New Rule**. Add conditions for **Path = `/api/login`** and **Method = `POST`**. Set the action to **Rate Limit**, choose **Fixed Window**, **5 requests per 60 seconds**, keyed by **IP**, with the default **429** response. Save the rule, then **Review Changes → Publish**. This rule is available on all Vercel plans and applies across serverless instances. Until it is published, the app does not impose a login attempt limit. Vercel tracks rate limit counters per region, so this is a throttle rather than an absolute global lockout.

Use a fresh, unique random `AUTH_PASSWORD`. If you replace it, redeploy so the new value is loaded; previous sessions will then be invalidated. Keep `AUTH_SECRET` random and private.

Both API keys stay in the Python function; the browser never receives them. Gemini suggestions, speech, and voice cloning require the signed, HttpOnly session cookie. Groq suggestions and transcription are intentionally available to unsigned visitors and can use API credits. Unsigned visitors use browser speech synthesis.

## Optional public Pocket TTS voice

Vocalis also supports an unsigned Pocket TTS voice clone. Pocket TTS runs in a separate CPU worker to keep PyTorch and the model out of the main Vercel API function. It does not use Gemini credits. Public speech requests still consume your worker's compute. If your Vercel plan permits another [rate limit rule](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting), consider one on `/api/pocket/tts` if traffic grows; Hobby allows one rate limit rule per project.

1. Accept the access conditions for [Kyutai's Pocket TTS model](https://huggingface.co/kyutai/pocket-tts) in a Hugging Face account and create a read-only `HF_TOKEN` for that account.
2. Deploy `pocket_service/Dockerfile` to a CPU container host (use `pocket_service` as the Docker build context). Mount persistent storage at `/data/huggingface` if possible so restarts do not re-download the model. Set `HF_TOKEN` and a random `POCKET_TTS_SECRET` generated with `openssl rand -hex 32` there. The worker's `/health` endpoint should return `{"status":"healthy"}`. Its `/synthesize` endpoint requires the secret as a Bearer token.
3. In Vercel, set `POCKET_TTS_URL` to the worker's HTTPS base URL and `POCKET_TTS_SECRET` to the same secret. Redeploy Vocalis. The Pocket TTS selector then becomes available to unsigned visitors.

Visitors record or upload a 5–30 second sample with permission from the speaker. Vocalis keeps the sample in that browser's IndexedDB and sends it with each speech request. The worker holds the sample only for the request and does not persist a voice profile. Deleting the sample in settings removes it from that browser. The Gemini option and its login gate remain separate.

Server transcription uses Groq's hosted `whisper-large-v3-turbo` through `GROQ_API_KEY`; Vercel does not run a local Whisper model or GPU. If that key is missing, server transcription reports a configuration error.

## Voice replication

The speaker must be an adult and record a 10–30 second reference sample plus a separate recording of Google's exact Spanish consent statement shown in the app. The browser converts both clips to 24 kHz mono WAV before upload. Gemini stores the replicated voice in your Google project and returns a `voice_...` ID. Vocalis saves that ID in this browser's settings; copy it into settings on another device to use the same voice. The server does not persist audio or voice IDs.

Google currently limits Vercel function request and response bodies to 4.5 MB. Vocalis limits uploads and generated speech to stay under that ceiling. Longer speech may need to be split into phrases.

## Local development

Install the root Python dependencies with `pip install -r requirements.txt`, put real values in a local `.env` (or export them in your shell), then run `uvicorn api.index:app --reload --port 8000 --env-file .env` from the root. In a second terminal, run `cd frontend && npm ci && npm run dev`. Vite proxies `/api` to port 8000.
