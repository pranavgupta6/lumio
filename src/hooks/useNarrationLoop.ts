import { useEffect, useRef } from 'react'
import { VideoCapture } from '@runanywhere/web'
import { VLMWorkerBridge } from '@runanywhere/web-llamacpp'
import { useAppStore } from '../store/useAppStore'
import { speakText } from '../lib/tts'

export function useNarrationLoop(videoRef: React.RefObject<HTMLVideoElement | null>) {
  // REFS - core state references
  const cameraRef = useRef<VideoCapture | null>(null)
  const intervalRef = useRef<number | null>(null)
  const isProcessingRef = useRef<boolean>(false)

  // Get isNarrating from store
  const { isNarrating } = useAppStore()

  // The runCycle function - executes the core VLM processing loop
  const runCycle = async () => {
    // Step 1 - Check processing lock
    if (isProcessingRef.current) {
      console.log('Narration tick — skipping, VLM busy')
      return
    }

    // Step 2 - Log cycle start
    console.log('Narration tick — running cycle')

    // Step 3 - Set processing lock
    isProcessingRef.current = true

    try {
      // Step 5 - Check camera is available
      if (!cameraRef.current) {
        return
      }

      // Step 6 - Capture frame
      const frame = cameraRef.current.captureFrame(224)
      if (!frame || frame.width === 0) {
        console.warn('Failed to capture frame or frame width is 0')
        return
      }

      // PART A.1 - Log frame details
      console.log('Frame captured:', {
        width: frame.width,
        height: frame.height,
        rgbPixelsLength: frame.rgbPixels.length
      })

      // Step 7 - Check VLM readiness
      if (!VLMWorkerBridge.shared.isInitialized || !VLMWorkerBridge.shared.isModelLoaded) {
        console.warn('VLMWorkerBridge not ready, skipping cycle')
        return
      }

      // Step 8 - Log VLM call
      console.log('Calling VLMWorkerBridge.process...', `${frame.width}x${frame.height}`)

      // PART A.2 & A.3 - Log prompt and options
      const prompt = 'Describe what you see in one sentence.'
      const options = { maxTokens: 30, temperature: 0.1 }
      console.log('VLM prompt:', prompt)
      console.log('VLM options:', options)

      // Step 9 - Process frame with VLM
      const result = await VLMWorkerBridge.shared.process(
        frame.rgbPixels,
        frame.width,
        frame.height,
        prompt,
        options
      )

      // PART A.4 - Log complete result
      console.log('VLM complete result:', result)

      // Step 10 - Log result
      console.log('VLM result:', result.text)

      // PART A.5 - Process result if valid
      if (result.text && result.text.trim()) {
        useAppStore.getState().setDescription(result.text)
        speakText(result.text)
      } else {
        console.log('VLM returned empty result — skipping')
      }

    } catch (error) {
      // Step 12 - Error handling
      const errorMessage = error instanceof Error ? error.message : String(error)

      if (errorMessage.includes('memory access out of bounds') || errorMessage.includes('RuntimeError')) {
        console.warn('VLM WASM memory error — skipping frame')
      } else {
        console.warn('VLM cycle error:', error)
      }
    } finally {
      // Step 13 - Always reset processing lock
      isProcessingRef.current = false
    }
  }

  // Main effect - responds to isNarrating changes
  useEffect(() => {
    const handleNarrationChange = async () => {
      if (isNarrating) {
        // WHEN NARRATING BECOMES TRUE

        // Step 1 - Create VideoCapture with rear camera
        const camera = new VideoCapture({ facingMode: 'environment' })
        cameraRef.current = camera

        try {
          // Step 2 - Start camera stream
          await camera.start()

          // Step 3 - Wait for camera video element to be ready
          await new Promise<void>((resolve, reject) => {
            const video = camera.videoElement  // use local camera variable
            if (video.videoWidth > 0 && video.videoHeight > 0) {
              resolve()
            } else {
              video.addEventListener('loadedmetadata', () => resolve(), { once: true })
            }
          })

          // Step 4 - Transfer stream to React video element
          const stream = camera.videoElement.srcObject as MediaStream
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream
            videoRef.current.play().catch(() => {
              console.warn('Failed to play video stream')
            })
          }

          // Step 5 - Announce camera activation
          speakText('Camera active')

          // Step 6 - Run initial cycle immediately
          runCycle()

          // Step 7 - Start interval for continuous cycles
          intervalRef.current = window.setInterval(runCycle, 2000)

        } catch (error) {
          console.error('Failed to start camera:', error)
          isProcessingRef.current = false
          // Clean up on camera start failure
          if (cameraRef.current) {
            cameraRef.current.stop()
            cameraRef.current = null
          }
        }

      } else {
        // WHEN NARRATING BECOMES FALSE

        // Step 1 - Clear interval immediately
        if (intervalRef.current !== null) {
          window.clearInterval(intervalRef.current)
          intervalRef.current = null
        }

        // Step 2 - Cancel any in-progress VLM processing
        VLMWorkerBridge.shared.cancel()

        // Step 3 - Clear React video element stream
        if (videoRef.current) {
          videoRef.current.srcObject = null
        }

        // Step 4 - Stop and cleanup camera
        if (cameraRef.current) {
          cameraRef.current.stop()
          cameraRef.current = null
        }

        // Step 5 - Reset processing flag
        isProcessingRef.current = false

        // Step 6 - Announce stop with priority
        speakText('Lumio stopped', true)
      }
    }

    handleNarrationChange()
  }, [isNarrating])

  // CLEANUP - effect cleanup function
  useEffect(() => {
    return () => {
      // Clear interval if set
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      // Cancel VLM processing
      VLMWorkerBridge.shared.cancel()

      // Clear React video element stream
      if (videoRef.current) {
        videoRef.current.srcObject = null
      }

      // Stop camera if running
      if (cameraRef.current) {
        cameraRef.current.stop()
        cameraRef.current = null
      }

      // Reset processing flag
      isProcessingRef.current = false
    }
  }, [])

  // No longer need to return cameraRef
}