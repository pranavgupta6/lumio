# CLAUDE.md — Lumio

This file is read by Claude Code before every prompt. Follow every
instruction in this file without exception, for every single prompt,
no matter how small the task.

---

## RULE 1 — Always check official documentation before implementing

Before writing any code that uses an external library or SDK, you MUST
read the official documentation for that specific feature first. Do not
rely on training knowledge — especially for the RunAnywhere SDK which is
in early beta and changes frequently.

### Documentation links to check:

**RunAnywhere Web SDK — check this before ANY SDK usage**
- Introduction: https://docs.runanywhere.ai/web/introduction
- Quick start: https://docs.runanywhere.ai/web/quick-start
- Installation: https://docs.runanywhere.ai/web/installation
- Configuration: https://docs.runanywhere.ai/web/configuration
- Best practices: https://docs.runanywhere.ai/web/best-practices
- Error handling: https://docs.runanywhere.ai/web/error-handling
- VLM (Vision): https://docs.runanywhere.ai/web/vlm
- TTS synthesize: https://docs.runanywhere.ai/web/tts/synthesize
- TTS voices: https://docs.runanywhere.ai/web/tts/voices
- TTS output/playback: https://docs.runanywhere.ai/web/tts/stream
- VAD: https://docs.runanywhere.ai/web/vad
- STT: https://docs.runanywhere.ai/web/stt/transcribe
- Voice pipeline: https://docs.runanywhere.ai/web/voice-agent

**Zustand**
- https://zustand.docs.pmnd.rs
- Use getState() to access store outside React components
- Never use Redux-style patterns

**React 18**
- https://react.dev
- Functional components and hooks only

**Vite**
- https://vitejs.dev/guide
- Do not touch vite.config.ts unless explicitly told to

### Critical RunAnywhere SDK rules — memorise these:

1. VLMWorkerBridge.process() does NOT support systemPrompt in options.
   Bake all instructions directly into the prompt string.

2. Always wait for the loadedmetadata event on the video element before
   calling camera.captureFrame(). Calling it before the event fires
   causes "source width is 0" crash.

3. When loading multiple models simultaneously, always pass
   coexist: true to ModelManager.loadModel(). Without this, each new
   model load unloads the previous one.

4. Always use COEP: credentialless, never require-corp.

5. Use useAppStore.getState() and useModelStore.getState() inside
   non-React code like tts.ts and utility functions that run on timers.

6. VLM WASM memory crashes ("memory access out of bounds") are
   recoverable. Always wrap VLMWorkerBridge.process() in try/catch.
   On this specific error, log a warning and skip the frame — do not
   stop the loop.

7. The red console output from VLMWorkerBridge is normal llama.cpp
   internal logging routed through stderr. It is not an error. Do not
   attempt to suppress it or treat it as an application failure.

8. Audio in browsers requires a user gesture before it will play.
   Never call speakText() from a useEffect that runs on mount without
   a prior user interaction. All audio must be triggered after the
   user has clicked or tapped something.

9. Do not await speakText() inside model loading callbacks or event
   handlers. Fire it without awaiting so it does not block the loading
   pipeline.

10. The TTS model is a tar.gz archive bundle. Its model definition
    must always include artifactType: 'archive' as const. Without this
    the SDK does not know how to extract it after downloading.

11. The correct HuggingFace URL for the TTS model is:
    https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz
    Do not use any other URL for TTS.

12. The correct HuggingFace repo for the VLM model is:
    runanywhere/LFM2-VL-450M-GGUF
    Files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf']

---

## RULE 2 — Run TypeScript and build checks after every prompt

After completing every single prompt — no exceptions — run these two
commands in order and fix ALL errors before marking the prompt done:

```bash
npx tsc --noEmit
npm run build
```

If either command produces errors:
1. Read the full error message carefully
2. Check the relevant documentation from Rule 1
3. Fix the error
4. Re-run both commands
5. Only mark the prompt complete when both pass with zero errors

The only permitted use of @ts-ignore is for the vlm-worker
?worker&url import — this is explicitly documented by RunAnywhere.

Report the output of both commands at the end of every response.

---

## RULE 3 — Project details

### Project name
Lumio

### What the app does
Lumio is a real-time visual narrator for visually impaired users.
The user opens the app in their browser, grants camera access, and the
app continuously captures camera frames, runs a vision AI model entirely
on-device to understand the scene, and speaks the description aloud
using on-device TTS. No cloud. No API keys. No backend. Everything runs
locally in the browser via WebAssembly. Works in airplane mode after the
first model download.

### The audio is the primary UI
The primary users of this app cannot see the screen. Every state change,
every model loading milestone, every narration, every error must be
communicated through spoken audio. Visual indicators are secondary.

### Current phase — core narration loop only
The app currently implements only the core narration loop:
1. Camera captures a frame every 2 seconds
2. VLM describes the frame in one sentence
3. TTS speaks the description aloud
4. Repeat indefinitely until stop is pressed

Features planned for future phases but NOT implemented yet:
- Scene context and memory (requires LLM)
- Voice Q&A — user asks spoken questions (requires VAD + STT + LLM)
- Hazard detection alerts

Do not implement any future phase features unless explicitly instructed.
Do not add VAD, STT, or LLM to the active loading sequence until
explicitly instructed to do so.

### Tech stack
- React 18 + TypeScript + Vite
- Zustand for state management (2 stores only)
- Plain CSS — no Tailwind, no UI libraries
- RunAnywhere Web SDK v0.1.0-beta.9
  - @runanywhere/web
  - @runanywhere/web-llamacpp
  - @runanywhere/web-onnx
- Vercel for deployment

### Active AI models — load these on startup

**VLM — LFM2-VL 450M**
- id: lfm2-vl-450m-q4_0
- repo: runanywhere/LFM2-VL-450M-GGUF
- files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf']
- framework: LLMFramework.LlamaCpp
- modality: ModelCategory.Multimodal
- memoryRequirement: 500_000_000
- Size: ~500MB

**TTS — Piper Lessac Medium**
- id: vits-piper-en_US-lessac-medium
- url: https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz
- framework: LLMFramework.ONNX
- modality: ModelCategory.SpeechSynthesis
- artifactType: 'archive' as const
- memoryRequirement: 65_000_000
- Size: ~65MB

### Reserved models — for future phases, DO NOT load yet

These models are defined here for reference only. Do not register,
download, or load any of them until explicitly instructed. They will
be activated in future phases of development.

**LLM — LFM2 350M** (future: scene context and narration enrichment)
- id: lfm2-350m-q4_k_m
- repo: LiquidAI/LFM2-350M-GGUF
- files: ['LFM2-350M-Q4_K_M.gguf']
- framework: LLMFramework.LlamaCpp
- modality: ModelCategory.Language
- memoryRequirement: 250_000_000

**STT — Whisper Tiny EN** (future: voice Q&A transcription)
- id: sherpa-onnx-whisper-tiny.en
- url: https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz
- framework: LLMFramework.ONNX
- modality: ModelCategory.SpeechRecognition
- artifactType: 'archive' as const
- memoryRequirement: 105_000_000

**VAD — Silero VAD v5** (future: voice Q&A speech detection)
- id: silero-vad-v5
- url: https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx
- files: ['silero_vad.onnx']
- framework: LLMFramework.ONNX
- modality: ModelCategory.Audio
- memoryRequirement: 5_000_000

### Zustand stores

**useAppStore** — runtime state
```typescript
type AppMode = 'idle' | 'narrating' | 'stopped'

interface AppState {
  mode: AppMode
  isNarrating: boolean
  currentDescription: string
  isSpeaking: boolean
  setMode: (mode: AppMode) => void
  startNarrating: () => void
  stopNarrating: () => void
  setDescription: (text: string) => void
  setIsSpeaking: (val: boolean) => void
}
```

**useModelStore** — model download and load status
```typescript
type ModelStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'error'

interface ModelState {
  vlm: ModelStatus
  tts: ModelStatus
  downloadProgress: Record<string, number>
  setStatus: (model: 'vlm' | 'tts', status: ModelStatus) => void
  setProgress: (modelId: string, progress: number) => void
  allReady: () => boolean  // true only when both vlm and tts are 'ready'
}
```

### File structure
```
src/
├── main.tsx                     ← STARTER — do not touch
├── runanywhere.ts               ← STARTER — do not touch
├── App.tsx                      ← Single screen, no tabs
├── workers/
│   └── vlm-worker.ts            ← STARTER — do not touch
├── store/
│   ├── useAppStore.ts
│   └── useModelStore.ts
├── hooks/
│   ├── useModelLoader.ts        ← STARTER — do not touch
│   └── useNarrationLoop.ts
├── lib/
│   └── tts.ts
├── components/
│   ├── ModelLoader.tsx
│   └── Lumio.tsx
└── styles/
    └── index.css
```

### Files from starter that must NEVER be modified
- vite.config.ts
- vercel.json
- tsconfig.json
- src/main.tsx
- src/runanywhere.ts
- src/workers/vlm-worker.ts
- src/hooks/useModelLoader.ts

### src/lib/tts.ts — exact specification

Exports one function: speakText(text: string, priority?: boolean): void

- Uses AudioPlayback from @runanywhere/web-onnx for playback
- Uses the TTS synthesis API from RunAnywhere SDK
- Check https://docs.runanywhere.ai/web/tts/synthesize before writing
- Accesses store state via useAppStore.getState() — not inside React
- If priority is true, stop any currently playing audio before speaking
- All errors must be caught and logged as warnings — never throw
- speakText is fire-and-forget — callers never await it
- Never called before a user gesture has occurred

### src/hooks/useNarrationLoop.ts — exact specification

This hook does exactly this and nothing more:

1. Reads isNarrating from useAppStore
2. When isNarrating becomes true:
   - Create VideoCapture with facingMode: 'environment'
   - Call camera.start()
   - Wait for loadedmetadata event before doing anything else
   - Call speakText('Camera active') without awaiting
   - Call the cycle function once immediately
   - Start setInterval at 2000ms calling the cycle function
3. The cycle function:
   - If isProcessing ref is true, log "Narration tick — skipping,
     VLM busy" and return immediately
   - Log "Narration tick — isProcessing: false, running cycle"
   - Set isProcessing to true
   - Call camera.captureFrame(224)
   - If frame is null or width is 0, reset isProcessing and return
   - Check VLMWorkerBridge.shared.isInitialized and isModelLoaded
     — if either is false, log a warning, reset isProcessing, return
   - Call VLMWorkerBridge.shared.process() with:
     - prompt: "Describe what you see in one sentence."
     - maxTokens: 30
     - temperature: 0.1
   - On success: call speakText(result.text) without awaiting,
     call setDescription(result.text) on the store
   - On "memory access out of bounds" error: log warning, skip
   - On any other error: log warning, skip
   - finally: ALWAYS reset isProcessing to false — no exceptions
4. When isNarrating becomes false:
   - clearInterval immediately
   - Call VLMWorkerBridge.shared.cancel()
   - Call camera.stop()
   - Reset isProcessing to false
5. useEffect cleanup function clears interval and stops camera

### components/ModelLoader.tsx — exact specification

- Shown while vlm or tts status is not yet 'ready'
- Has a single "Tap to begin" button that must be clicked before
  any downloads start — this satisfies the browser audio autoplay
  policy by ensuring user interaction happens first
- After button is clicked, begin downloading and loading VLM and
  TTS only — do not touch VAD, STT, or LLM
- Shows simple visual progress for VLM and TTS only
- Throttle progress store updates to once per 200ms per model
  to prevent progress bar flickering — use a ref to track last
  update time per modelId, always let 1.0 (100%) through immediately
- Spoken announcements for each model: fire without awaiting, use
  a sequential announcement queue so they never overlap — each
  announcement plays fully before the next one starts
- When both models are ready speak "Lumio is ready. Tap start
  to begin." then transition to main screen

### components/Lumio.tsx — exact specification

- Single screen, no tabs, no navigation
- One large start/stop button — minimum 80px touch target
- Displays currentDescription as text (secondary to audio)
- Start button: calls startNarrating() from useAppStore
- Stop button: calls stopNarrating(), then
  VLMWorkerBridge.shared.cancel(), then stops current audio,
  then speakText('Lumio stopped')
- Calls useNarrationLoop() hook
- Stop must be total and immediate — nothing plays after the
  stop confirmation finishes

### CSS rules — non-negotiable
- html, body: height 100%, overflow-y auto, overflow-x hidden
- #root: min-height 100%, overflow-y auto
- Never use overflow: hidden on full page containers
- Never use height: 100vh on full page containers — use min-height
- Page must always be scrollable vertically

### Browser requirements
- Chrome 96+ or Edge 96+ only
- Safari is NOT supported — OPFS issues and no WebGPU
- Show this requirement clearly in the UI

### Deployment
- Platform: Vercel free tier
- Build command: npm run build
- Output directory: dist
- No environment variables needed — zero backend, zero API keys
- vercel.json already configured with COOP/COEP headers

---

## RULE 4 — Non-negotiable rules for every prompt

1. Read the actual code before writing any fix. Never assume.

2. Never modify the 7 starter files listed above.

3. The isProcessing flag must ALWAYS reset to false in a finally
   block — never only in the success path.

4. Never call captureFrame() before loadedmetadata fires.

5. Never load models without coexist: true.

6. Never attempt to play audio before a user gesture has occurred.

7. Never suppress or intercept WASM console output.

8. VLMWorkerBridge.process() options only accept maxTokens and
   temperature. Never pass systemPrompt — it is silently ignored.

9. On stop, cancel in this exact order:
   a. clearInterval
   b. VLMWorkerBridge.shared.cancel()
   c. Stop current TTS audio
   d. Speak "Lumio stopped"

10. Progress updates throttled to max once per 200ms per model.

11. Model announcements must queue — never overlap.

12. App is ready only when BOTH vlm AND tts are 'ready'.

13. Do not load VAD, STT, or LLM until explicitly instructed.
    They are reserved for future phases. Their model definitions
    are documented in the Reserved models section above for when
    they are needed.

14. The narration loop must run forever until stopped. Any error
    inside a cycle must be caught, the isProcessing flag reset
    in a finally block, and the loop must continue to the next
    cycle without stopping.