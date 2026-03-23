import { useRef } from 'react'
import { useAppStore } from '../store/useAppStore'
import { useNarrationLoop } from '../hooks/useNarrationLoop'

export function Lumio() {
  // React video element ref
  const videoRef = useRef<HTMLVideoElement>(null)

  // Hook activation - pass videoRef to manage the stream
  useNarrationLoop(videoRef)

  // Get state from store
  const { currentDescription, mode, isSpeaking } = useAppStore()

  // Determine if narrating
  const isNarrating = mode === 'narrating'

  // Button click handlers
  const handleStartClick = () => {
    useAppStore.getState().startNarrating()
  }

  const handleStopClick = () => {
    useAppStore.getState().stopNarrating()
  }

  // Determine button text and style
  const buttonText = isNarrating ? 'Stop' : 'Start Narrating'
  const buttonClass = isNarrating ? 'lumio-button lumio-button-stop' : 'lumio-button lumio-button-start'

  // Status text based on mode
  const getStatusText = () => {
    switch (mode) {
      case 'idle':
        return 'Ready — tap to begin'
      case 'narrating':
        return 'Listening to your surroundings...'
      case 'stopped':
        return 'Tap to start again'
      default:
        return 'Ready — tap to begin'
    }
  }

  // Description text without hardcoded fallbacks
  const descriptionText = currentDescription || 'Scene descriptions will appear here'

  return (
    <div className="lumio-container">
      <div className="lumio-content">
        {/* TOP SECTION - App Identity */}
        <div className="lumio-header">
          <h1 className="lumio-title">Lumio</h1>
          <p className="lumio-subtitle">Visual narrator</p>
        </div>

        {/* MIDDLE SECTION - Camera Feed and Status */}
        <div className="lumio-main">
          {/* Camera Box */}
          <div className="lumio-camera-box">
            <div className="lumio-camera-container">
              {/* React-managed video element - always present */}
              <video
                ref={videoRef}
                className="lumio-video"
                autoPlay
                muted
                playsInline
                style={{
                  opacity: isNarrating ? 1 : 0,
                  visibility: isNarrating ? 'visible' : 'hidden'
                }}
              />

              {/* Placeholder text - shown when not narrating */}
              <div
                className="lumio-camera-placeholder"
                style={{
                  opacity: isNarrating ? 0 : 1,
                  visibility: isNarrating ? 'hidden' : 'visible'
                }}
              >
                Camera will activate when you press start
              </div>

              {/* Camera active indicator - shown when narrating */}
              {isNarrating && (
                <div className="lumio-camera-active">
                  <div className="lumio-camera-indicator">
                    <div className="lumio-status-dot lumio-status-dot-active"></div>
                    <span>Camera active</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Description Display */}
          <div className="lumio-description-container">
            <div className="lumio-description-box">
              <div className="lumio-description-text" key={currentDescription}>
                {descriptionText}
              </div>
              {isSpeaking && (
                <div className="lumio-speaking-indicator">
                  <div className="lumio-audio-wave">
                    <div className="lumio-wave-bar"></div>
                    <div className="lumio-wave-bar"></div>
                    <div className="lumio-wave-bar"></div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION - Controls */}
        <div className="lumio-controls">
          <button
            className={buttonClass}
            onClick={isNarrating ? handleStopClick : handleStartClick}
          >
            {buttonText}
          </button>
          <div className="lumio-status-text">
            {getStatusText()}
          </div>
        </div>
      </div>
    </div>
  )
}