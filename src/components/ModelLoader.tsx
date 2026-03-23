import { useState, useRef, useEffect } from 'react'
import { ModelManager, EventBus, AudioPlayback } from '@runanywhere/web'
import { TTS } from '@runanywhere/web-onnx'
import { useModelStore } from '../store'
import { unlockAudio, speakText } from '../lib'

interface ModelLoaderProps {
  onReady: () => void
}

// Announcement queue for sequential audio announcements
const announcementQueue: string[] = []
let isAnnouncementPlaying = false

// Process the announcement queue sequentially
async function processAnnouncementQueue(): Promise<void> {
  if (isAnnouncementPlaying || announcementQueue.length === 0) {
    return
  }

  isAnnouncementPlaying = true
  const announcement = announcementQueue.shift()!

  try {
    // Use raw TTS API to await full playback completion
    const synthesisResult = await TTS.synthesize(announcement)
    if (synthesisResult?.audioData) {
      const player = new AudioPlayback()
      await player.play(synthesisResult.audioData, synthesisResult.sampleRate)
    }
  } catch (error) {
    console.warn('Announcement error:', error)
  } finally {
    isAnnouncementPlaying = false

    // Process next announcement if any (use setTimeout to avoid stack overflow on rapid queuing)
    if (announcementQueue.length > 0) {
      setTimeout(() => processAnnouncementQueue(), 0)
    }
  }
}

// Add announcement to queue and start processing
function queueAnnouncement(text: string): void {
  announcementQueue.push(text)
  processAnnouncementQueue()
}

export function ModelLoader({ onReady }: ModelLoaderProps) {
  const [hasStarted, setHasStarted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastUpdateTimeRef = useRef<Record<string, number>>({})

  // Local phase state for fine-grained progress control
  const [ttsPhase, setTtsPhase] = useState<'waiting' | 'downloading' | 'installing' | 'ready'>('waiting')
  const [vlmPhase, setVlmPhase] = useState<'waiting' | 'downloading' | 'installing' | 'ready'>('waiting')

  // Elapsed time timers
  const [ttsElapsed, setTtsElapsed] = useState(0)
  const [vlmElapsed, setVlmElapsed] = useState(0)
  const ttsTimerRef = useRef<number | null>(null)
  const vlmTimerRef = useRef<number | null>(null)

  const { vlm, tts, downloadProgress, setStatus, setProgress, allReady } = useModelStore()

  // Start timer for a model
  const startTimer = (model: 'tts' | 'vlm') => {
    if (model === 'tts') {
      if (ttsTimerRef.current) window.clearInterval(ttsTimerRef.current)
      setTtsElapsed(0)
      ttsTimerRef.current = window.setInterval(() => {
        setTtsElapsed(prev => prev + 1)
      }, 1000)
    } else {
      if (vlmTimerRef.current) window.clearInterval(vlmTimerRef.current)
      setVlmElapsed(0)
      vlmTimerRef.current = window.setInterval(() => {
        setVlmElapsed(prev => prev + 1)
      }, 1000)
    }
  }

  // Stop timer for a model
  const stopTimer = (model: 'tts' | 'vlm') => {
    if (model === 'tts' && ttsTimerRef.current) {
      window.clearInterval(ttsTimerRef.current)
      ttsTimerRef.current = null
    } else if (model === 'vlm' && vlmTimerRef.current) {
      window.clearInterval(vlmTimerRef.current)
      vlmTimerRef.current = null
    }
  }

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (ttsTimerRef.current) window.clearInterval(ttsTimerRef.current)
      if (vlmTimerRef.current) window.clearInterval(vlmTimerRef.current)
    }
  }, [])

  // Handle button click - this is the user gesture
  const handleBeginClick = async () => {
    // STEP B.1: Unlock audio immediately on click
    unlockAudio()

    // STEP B.2: Set state to indicate downloads have started
    setHasStarted(true)

    // STEP B.3: Begin download and load sequence
    try {
      await downloadAndLoadModels()
    } catch (err) {
      console.error('Model loading failed:', err)
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // STEP C: Download and load sequence
  const downloadAndLoadModels = async () => {
    try {
      // 1. Download TTS model first (so speech announcements work)
      setTtsPhase('downloading')
      startTimer('tts')
      setStatus('tts', 'downloading')
      console.log('Checking OPFS cache for vits-piper-en_US-lessac-medium — SDK will skip download if already cached')
      await ModelManager.downloadModel('vits-piper-en_US-lessac-medium')

      // 2. Load TTS model with coexist: true
      setTtsPhase('installing')
      setStatus('tts', 'loading')
      await ModelManager.loadModel('vits-piper-en_US-lessac-medium', { coexist: true })
      console.log('vits-piper-en_US-lessac-medium loaded into memory successfully')

      // 3. Update store and phase - TTS ready first
      setTtsPhase('ready')
      stopTimer('tts')
      setStatus('tts', 'ready')

      // 4. Download VLM model
      setVlmPhase('downloading')
      startTimer('vlm')
      setStatus('vlm', 'downloading')
      console.log('Checking OPFS cache for lfm2-vl-450m-q4_0 — SDK will skip download if already cached')
      await ModelManager.downloadModel('lfm2-vl-450m-q4_0')

      // 5. Load VLM model with coexist: true
      setVlmPhase('installing')
      setStatus('vlm', 'loading')
      await ModelManager.loadModel('lfm2-vl-450m-q4_0', { coexist: true })
      console.log('lfm2-vl-450m-q4_0 loaded into memory successfully')

      // 6. Update store and phase - VLM ready
      setVlmPhase('ready')
      stopTimer('vlm')
      setStatus('vlm', 'ready')

      // 7. Queue announcements and trigger completion
      queueAnnouncement('Vision model ready')
      queueAnnouncement('Speech model ready')
      queueAnnouncement('Lumio is ready. Tap start to begin.')

      // 8. Both models are now ready - trigger transition
      setTimeout(() => {
        console.log('Calling onReady from download sequence — transitioning to main screen')
        onReady()
      }, 500)

    } catch (err) {
      // Stop timers on error
      stopTimer('tts')
      stopTimer('vlm')

      // Update relevant model status to error
      if (vlm !== 'ready') {
        setStatus('vlm', 'error')
      }
      if (tts !== 'ready') {
        setStatus('tts', 'error')
      }
      throw err
    }
  }

  // Calculate progress bar width based on phase
  const getProgressWidth = (model: 'tts' | 'vlm', phase: string) => {
    const rawProgress = downloadProgress[model === 'tts' ? 'vits-piper-en_US-lessac-medium' : 'lfm2-vl-450m-q4_0'] || 0

    switch (phase) {
      case 'waiting':
        return 0
      case 'downloading':
        // Scale 0-1 to 0-85%
        return rawProgress * 85
      case 'installing':
        // Fixed at 85% - CSS animation handles the pulse
        return 85
      case 'ready':
        return 100
      default:
        return 0
    }
  }

  // Get progress bar CSS class
  const getProgressClass = (phase: string) => {
    let baseClass = 'model-loader-progress-bar'
    if (phase === 'installing') baseClass += ' installing'
    if (phase === 'ready') baseClass += ' ready'
    return baseClass
  }

  // Get status text with timer
  const getStatusText = (model: 'tts' | 'vlm', phase: string) => {
    const elapsed = model === 'tts' ? ttsElapsed : vlmElapsed
    const timerText = (phase === 'downloading' || phase === 'installing') ? ` ${elapsed}s` : ''
    const rawProgress = downloadProgress[model === 'tts' ? 'vits-piper-en_US-lessac-medium' : 'lfm2-vl-450m-q4_0'] || 0

    switch (phase) {
      case 'waiting':
        return 'Waiting'
      case 'downloading':
        return `Downloading ${Math.round(rawProgress * 100)}%${timerText}`
      case 'installing':
        return `Installing...${timerText}`
      case 'ready':
        return 'Ready'
      default:
        return 'Waiting'
    }
  }

  // STEP D: Subscribe to download progress events
  useEffect(() => {
    if (!hasStarted) return

    const unsubscribe = EventBus.shared.on('model.downloadProgress', (evt) => {
      const { modelId, progress } = evt

      // STEP D: Throttle progress updates (200ms per model, always allow 1.0)
      const now = Date.now()
      const lastUpdate = lastUpdateTimeRef.current[modelId] || 0

      if (progress === 1.0 || now - lastUpdate >= 200) {
        lastUpdateTimeRef.current[modelId] = now
        setProgress(modelId, progress || 0)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [hasStarted, setProgress])

  // STEP F: When both models are ready
  useEffect(() => {
    console.log('Model status check - VLM:', vlm, 'TTS:', tts, 'allReady:', allReady())
    if (allReady()) {
      // Add final announcement to queue
      queueAnnouncement('Lumio is ready. Tap start to begin.')

      // Transition to main screen after delay
      setTimeout(() => {
        console.log('Calling onReady — transitioning to main screen')
        onReady()
      }, 500)
    }
  }, [vlm, tts, allReady, onReady])

  // STEP A: First render state
  if (!hasStarted) {
    return (
      <div className="model-loader-container">
        <div className="model-loader-content">
          <h1 className="model-loader-title">Lumio</h1>
          <p className="model-loader-description">
            AI-powered visual narrator. Everything runs privately on your device.
          </p>
          <button
            className="model-loader-begin-button"
            onClick={handleBeginClick}
          >
            Tap to begin
          </button>
          <p className="model-loader-download-note">
            Models download once — about 565MB total. Works offline after that.
          </p>
          <p className="model-loader-browser-note">
            Requires Chrome or Edge 96+
          </p>
        </div>
      </div>
    )
  }

  // STEP G: Loading screen
  return (
    <div className="model-loader-container">
      <div className="model-loader-content">
        <h1 className="model-loader-title">Lumio</h1>

        {error && (
          <div className="model-loader-error">
            Error: {error}
          </div>
        )}

        <div className="model-loader-models">
          {/* TTS Model - shows first to match download order */}
          <div className="model-loader-model">
            <div className="model-loader-model-header">
              <span className="model-loader-model-name">Speech Model</span>
              <span className={`model-loader-status ${ttsPhase === 'ready' ? 'model-loader-status-ready' : ''}`}>
                {getStatusText('tts', ttsPhase)}
              </span>
            </div>
            <div className="model-loader-progress-container">
              <div
                className={getProgressClass(ttsPhase)}
                style={{
                  width: `${getProgressWidth('tts', ttsPhase)}%`
                }}
              />
            </div>
          </div>

          {/* VLM Model - shows second to match download order */}
          <div className="model-loader-model">
            <div className="model-loader-model-header">
              <span className="model-loader-model-name">Vision Model</span>
              <span className={`model-loader-status ${vlmPhase === 'ready' ? 'model-loader-status-ready' : ''}`}>
                {getStatusText('vlm', vlmPhase)}
              </span>
            </div>
            <div className="model-loader-progress-container">
              <div
                className={getProgressClass(vlmPhase)}
                style={{
                  width: `${getProgressWidth('vlm', vlmPhase)}%`
                }}
              />
            </div>
          </div>
        </div>

        {(ttsPhase === 'downloading' || ttsPhase === 'installing' || vlmPhase === 'downloading' || vlmPhase === 'installing') && (
          <div className="model-loader-spinner">Loading...</div>
        )}
      </div>
    </div>
  )
}