export type DeviceTilt = {
  horizontal: number
  vertical: number
}

const MAX_TILT = 16

function clampTilt(value: number) {
  return Math.max(-MAX_TILT, Math.min(MAX_TILT, value))
}

function shortestAngleDelta(value: number, baseline: number) {
  return ((value - baseline + 540) % 360) - 180
}

/**
 * Converts DeviceOrientation angles into the same axes used by pointer tilt.
 * The baseline is the phone position when the viewer starts listening, so the
 * card does not jump as soon as it opens.
 */
export function deviceTiltFromOrientation(
  beta: number,
  gamma: number,
  baselineBeta: number,
  baselineGamma: number,
  screenAngle = 0,
): DeviceTilt {
  const pitch = shortestAngleDelta(beta, baselineBeta) * .9
  const roll = shortestAngleDelta(gamma, baselineGamma) * 1.2
  const normalizedScreenAngle = ((screenAngle % 360) + 360) % 360

  if (normalizedScreenAngle === 90) {
    return { horizontal: clampTilt(pitch), vertical: clampTilt(-roll) }
  }
  if (normalizedScreenAngle === 270) {
    return { horizontal: clampTilt(-pitch), vertical: clampTilt(roll) }
  }
  if (normalizedScreenAngle === 180) {
    return { horizontal: clampTilt(-roll), vertical: clampTilt(-pitch) }
  }
  return { horizontal: clampTilt(roll), vertical: clampTilt(pitch) }
}
