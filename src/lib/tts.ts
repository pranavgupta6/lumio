import { TTS } from '@runanywhere/web-onnx'
import { AudioPlayback } from '@runanywhere/web'
import { useAppStore } from '../store/useAppStore'

// User gesture tracking - required for browser audio autoplay policy
let hasUserGesture = false
let currentPlayer: AudioPlayback | null = null

/**
 * Unlocks audio playback by marking that a user gesture has occurred.
 * Must be called from a user interaction event (click, tap, etc).
 */
export function unlockAudio(): void {
  hasUserGesture = true
}

/**
 * Synthesizes and speaks the given text using the loaded TTS model.
 * Fire-and-forget function - callers should never await it.
 *
 * @param text - The text to speak
 * @param priority - If true, stops any currently playing audio before speaking
 */
export function speakText(text: string, priority?: boolean): void {
  // Fire-and-forget async implementation
  ;(async () => {
    try {
      // REQUIREMENT 1: User gesture gate
      if (!hasUserGesture) {
        console.warn('speakText called before user gesture — skipping')
        return
      }

      // REQUIREMENT 2: Priority flag handling
      if (priority && currentPlayer) {
        currentPlayer.stop()
        currentPlayer = null
      }

      // If not priority and something is playing, don't interrupt
      if (!priority && currentPlayer) {
        return
      }

      // REQUIREMENT 4: Update isSpeaking state before synthesis
      useAppStore.getState().setIsSpeaking(true)

      // REQUIREMENT 3: Synthesis using RunAnywhere SDK
      const synthesisResult = await TTS.synthesize(text)

      if (!synthesisResult || !synthesisResult.audioData) {
        throw new Error('TTS synthesis failed or returned no audio data')
      }

      // Create and play audio
      currentPlayer = new AudioPlayback()
      await currentPlayer.play(synthesisResult.audioData, synthesisResult.sampleRate)

      // Clear current player when playback completes
      currentPlayer = null

    } catch (error) {
      // REQUIREMENT 5: Error handling - log but never throw
      console.warn('TTS error:', error)
    } finally {
      // REQUIREMENT 4: Always update isSpeaking state when done or error
      useAppStore.getState().setIsSpeaking(false)
    }
  })()
}