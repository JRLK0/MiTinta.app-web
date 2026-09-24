import { describe, expect, it } from 'vitest'
import { deviceTiltFromOrientation } from './cardMotion'

describe('deviceTiltFromOrientation', () => {
  it('calibrates the resting phone position as the centre', () => {
    expect(deviceTiltFromOrientation(48, -3, 48, -3)).toEqual({ horizontal: 0, vertical: 0 })
  })

  it('maps portrait movement to the card axes and limits extreme angles', () => {
    expect(deviceTiltFromOrientation(58, 5, 48, -3)).toEqual({ horizontal: 9.6, vertical: 9 })
    expect(deviceTiltFromOrientation(100, 50, 48, -3)).toEqual({ horizontal: 16, vertical: 16 })
  })

  it('rotates the axes when the phone is in landscape', () => {
    expect(deviceTiltFromOrientation(58, 5, 48, -3, 90)).toEqual({ horizontal: 9, vertical: -9.6 })
    expect(deviceTiltFromOrientation(58, 5, 48, -3, 270)).toEqual({ horizontal: -9, vertical: 9.6 })
  })

  it('uses the shortest delta when an angle wraps around', () => {
    expect(deviceTiltFromOrientation(-179, 0, 179, 0)).toEqual({ horizontal: 0, vertical: 1.8 })
  })
})
