import { useState, useEffect } from 'react'
import { ModelLoader } from './components/ModelLoader'
import { Lumio } from './components/Lumio'
import { initSDK } from './runanywhere'

function App() {
  const [isReady, setIsReady] = useState(false)
  const [sdkInitialized, setSdkInitialized] = useState(false)

  // Initialize RunAnywhere SDK on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        await initSDK()
        setSdkInitialized(true)
      } catch (error) {
        console.error('SDK initialization failed:', error)
      }
    }

    initialize()
  }, [])

  // Handle when models are ready
  const handleReady = () => {
    console.log('onReady received — setting isReady to true')
    setIsReady(true)
  }

  // Show loading if SDK not initialized yet
  if (!sdkInitialized) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#1a1a1a',
        color: 'white'
      }}>
        Initializing SDK...
      </div>
    )
  }

  // Show ModelLoader if not ready yet
  if (!isReady) {
    return <ModelLoader onReady={handleReady} />
  }

  // Show Lumio main screen when ready
  return <Lumio />
}

export default App