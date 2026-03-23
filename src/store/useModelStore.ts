import { create } from 'zustand'

export type ModelStatus = 'idle' | 'downloading' | 'loading' | 'ready' | 'error'

interface ModelState {
  vlm: ModelStatus
  tts: ModelStatus
  downloadProgress: Record<string, number>
  setStatus: (model: 'vlm' | 'tts', status: ModelStatus) => void
  setProgress: (modelId: string, progress: number) => void
  allReady: () => boolean
}

export const useModelStore = create<ModelState>((set, get) => ({
  vlm: 'idle',
  tts: 'idle',
  downloadProgress: {},
  setStatus: (model, status) => set((state) => ({ ...state, [model]: status })),
  setProgress: (modelId, progress) => set((state) => ({
    downloadProgress: { ...state.downloadProgress, [modelId]: progress }
  })),
  allReady: () => {
    const { vlm, tts } = get()
    return vlm === 'ready' && tts === 'ready'
  },
}))