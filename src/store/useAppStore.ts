import { create } from 'zustand'

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

export const useAppStore = create<AppState>((set) => ({
  mode: 'idle',
  isNarrating: false,
  currentDescription: '',
  isSpeaking: false,
  setMode: (mode) => set({ mode }),
  startNarrating: () => set({ isNarrating: true, mode: 'narrating' }),
  stopNarrating: () => set({ isNarrating: false, mode: 'stopped' }),
  setDescription: (text) => set({ currentDescription: text }),
  setIsSpeaking: (val) => set({ isSpeaking: val }),
}))