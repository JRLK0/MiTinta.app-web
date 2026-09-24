import { describe, expect, it } from 'vitest'
import { isValuableCard, valuableCardSoundFor } from './valuableCardSound'

describe('valuable card sound threshold', () => {
  it('only marks prices strictly above one euro as valuable', () => {
    expect(isValuableCard(null)).toBe(false)
    expect(isValuableCard(1)).toBe(false)
    expect(isValuableCard(1.01)).toBe(true)
    expect(isValuableCard(25)).toBe(true)
  })

  it('uses a jackpot sound only above ten euros', () => {
    expect(valuableCardSoundFor(0.5)).toBe('none')
    expect(valuableCardSoundFor(1)).toBe('none')
    expect(valuableCardSoundFor(1.01)).toBe('cash')
    expect(valuableCardSoundFor(10)).toBe('cash')
    expect(valuableCardSoundFor(10.01)).toBe('jackpot')
  })
})
