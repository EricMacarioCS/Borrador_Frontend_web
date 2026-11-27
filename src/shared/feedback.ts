import { createStore, useStore } from 'zustand'

/* Avisos breves y confirmaciones accesibles (sustituyen a window.confirm). `FeedbackHost` los dibuja. */

export interface Toast { id: number; text: string; tone: 'success' | 'error' | 'info' }

export interface ConfirmRequest {
  title: string
  text: string
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
}

interface FeedbackState {
  toasts: Toast[]
  confirm: ConfirmRequest | null
}

const feedbackStore = createStore<FeedbackState>(() => ({ toasts: [], confirm: null }))
let nextToast = 1
let resolveConfirm: ((value: boolean) => void) | null = null

export function useFeedback<T>(selector: (state: FeedbackState) => T): T {
  return useStore(feedbackStore, selector)
}

export function toast(text: string, tone: Toast['tone'] = 'success') {
  const item = { id: nextToast++, text, tone }
  feedbackStore.setState(state => ({ toasts: [...state.toasts, item] }))
  setTimeout(() => dismissToast(item.id), tone === 'error' ? 7000 : 4000)
}

export function dismissToast(id: number) {
  feedbackStore.setState(state => ({ toasts: state.toasts.filter(item => item.id !== id) }))
}

export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  resolveConfirm?.(false)
  return new Promise(resolve => {
    resolveConfirm = resolve
    feedbackStore.setState({ confirm: request })
  })
}

export function answerConfirm(value: boolean) {
  resolveConfirm?.(value)
  resolveConfirm = null
  feedbackStore.setState({ confirm: null })
}
