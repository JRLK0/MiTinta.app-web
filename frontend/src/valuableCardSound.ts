import cashRegisterUrl from './assets/cash-register.mp3'
import slotJackpotUrl from './assets/slot-jackpot.mp3'

export const VALUABLE_CARD_THRESHOLD_EUR = 1
export const JACKPOT_CARD_THRESHOLD_EUR = 10

export type ValuableCardSound = 'none' | 'cash' | 'jackpot'

export function isValuableCard(priceEur: number | null | undefined) {
  return priceEur != null && priceEur > VALUABLE_CARD_THRESHOLD_EUR
}

export function valuableCardSoundFor(priceEur: number | null | undefined): ValuableCardSound {
  if (priceEur != null && priceEur > JACKPOT_CARD_THRESHOLD_EUR) return 'jackpot'
  return isValuableCard(priceEur) ? 'cash' : 'none'
}

const audioBySound: Partial<Record<Exclude<ValuableCardSound, 'none'>, HTMLAudioElement>> = {}

function getAudio(sound: Exclude<ValuableCardSound, 'none'>) {
  if (audioBySound[sound]) return audioBySound[sound]
  const audio = new Audio(sound === 'jackpot' ? slotJackpotUrl : cashRegisterUrl)
  audio.preload = 'auto'
  audioBySound[sound] = audio
  return audio
}

export async function prepareValuableCardSound() {
  const audio = getAudio('cash')
  const previousVolume = audio.volume
  audio.volume = 0
  try {
    await audio.play()
    audio.pause()
    audio.currentTime = 0
  } finally {
    audio.volume = previousVolume
  }
  getAudio('jackpot').load()
}

export async function playValuableCardSound(sound: Exclude<ValuableCardSound, 'none'> = 'cash') {
  const audio = getAudio(sound)
  audio.currentTime = 0
  try {
    await audio.play()
    return true
  } catch {
    return false
  }
}
