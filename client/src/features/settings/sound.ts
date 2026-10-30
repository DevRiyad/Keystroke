let ctx: AudioContext | null = null

/** Tiny synthesized key click (no audio files). Failures are ignored: sound is optional. */
export function playClick(ok: boolean): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    if (!ctx) ctx = new AC()
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const t = ctx.currentTime
    osc.type = 'square'
    osc.frequency.value = ok ? 900 : 220
    gain.gain.setValueAtTime(0.03, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.05)
  } catch {
    /* ignore */
  }
}
