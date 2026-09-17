import { useSettingsStore } from '@/store/settingsStore'

export type SoundEvent = 'clean' | 'warning' | 'notification' | 'update' | 'activation'

let _ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!_ctx || _ctx.state === 'closed') _ctx = new AudioContext()
  return _ctx
}

function tone(
  freq:    number,
  dur:     number,
  type:    OscillatorType = 'sine',
  vol      = 0.07,
  fadeIn   = 0.01,
  fadeOut  = 0.06,
  delayMs  = 0,
): void {
  const at = getCtx()
  const startAt = at.currentTime + delayMs / 1000

  const osc  = at.createOscillator()
  const gain = at.createGain()

  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0,   startAt)
  gain.gain.linearRampToValueAtTime(vol,   startAt + fadeIn)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + dur - fadeOut)

  osc.connect(gain)
  gain.connect(at.destination)
  osc.start(startAt)
  osc.stop(startAt + dur)
}

export function playSound(event: SoundEvent): void {
  if (!useSettingsStore.getState().soundEnabled) return
  try {
    switch (event) {
      case 'clean':
        tone(523, 0.12, 'sine', 0.07, 0.01, 0.05)
        tone(659, 0.12, 'sine', 0.07, 0.01, 0.05, 80)
        tone(784, 0.22, 'sine', 0.07, 0.01, 0.08, 160)
        break
      case 'warning':
        tone(380, 0.15, 'triangle', 0.09)
        tone(320, 0.25, 'triangle', 0.07, 0.01, 0.08, 140)
        break
      case 'notification':
        tone(880,  0.08, 'sine', 0.05)
        tone(1100, 0.14, 'sine', 0.05, 0.01, 0.06, 70)
        break
      case 'update':
        tone(660, 0.13, 'sine', 0.07)
        tone(550, 0.22, 'sine', 0.06, 0.01, 0.08, 110)
        break
      case 'activation':
        tone(523,  0.10, 'sine', 0.06)
        tone(659,  0.10, 'sine', 0.06, 0.01, 0.05, 80)
        tone(784,  0.10, 'sine', 0.06, 0.01, 0.05, 160)
        tone(1047, 0.28, 'sine', 0.07, 0.01, 0.10, 240)
        break
    }
  } catch { /* AudioContext unavailable before user gesture */ }
}
