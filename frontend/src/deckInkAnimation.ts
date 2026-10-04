type InkTarget = { x: number; y: number; color: string; image: HTMLImageElement; fresh: boolean }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }

// Finite sequence: ink currents, official glyph assembly, fusion, impact seal.
export function animateDeckInk(canvas: HTMLCanvasElement, targets: InkTarget[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const width = canvas.clientWidth, height = canvas.clientHeight
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = width * dpr; canvas.height = height * dpr
  ctx.scale(dpr, dpr)
  const sample = document.createElement('canvas')
  sample.width = sample.height = 40
  const sampling = sample.getContext('2d', { willReadFrequently: true })
  let seed = 71
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const particles = targets.flatMap(target => {
    if (!target.fresh || !sampling || !target.image.complete || !target.image.naturalWidth) return []
    sampling.clearRect(0, 0, 40, 40)
    sampling.drawImage(target.image, 0, 0, 40, 40)
    const pixels = sampling.getImageData(0, 0, 40, 40).data
    const points = []
    for (let y = 0; y < 40; y += 2) for (let x = 0; x < 40; x += 2) {
      const index = (y * 40 + x) * 4
      if (pixels[index + 3] < 80) continue
      points.push({ target, x: x - 20, y: y - 20, angle: random() * Math.PI * 2,
        radius: 38 + random() * 38, delay: random() * .14,
        color: `rgb(${pixels[index]},${pixels[index + 1]},${pixels[index + 2]})` })
    }
    return points
  })
  const start = performance.now()
  let frame = 0
  const draw = (now: number) => {
    const t = (now - start) / 1850
    ctx.clearRect(0, 0, width, height)
    if (t >= 1) return
    for (const [index, target] of targets.entries()) {
      const energy = Math.sin(Math.PI * clamp(t / .88))
      ctx.globalAlpha = energy * .32
      const glow = ctx.createRadialGradient(target.x, target.y, 4, target.x, target.y, 65)
      glow.addColorStop(0, target.color); glow.addColorStop(1, 'transparent')
      ctx.fillStyle = glow; ctx.fillRect(target.x - 65, target.y - 65, 130, 130)
      // Filaments weave both inks together, then contract around their glyphs.
      for (let strand = 0; strand < 9; strand++) {
        ctx.beginPath()
        const collapse = 1 - smooth((t - .28) / .47)
        for (let point = 0; point <= 38; point++) {
          const u = point / 38
          const phase = u * 5.1 + t * 7 + strand * .17 + index * Math.PI
          const radius = (18 + u * 60) * collapse + 25 * (1 - collapse)
          const x = target.x + Math.cos(phase) * radius
          const y = target.y + Math.sin(phase) * radius * .56 + Math.sin(u * Math.PI) * (index ? -8 : 8)
          if (!point) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.globalAlpha = energy * (strand === 4 ? .72 : .18)
        ctx.strokeStyle = target.color; ctx.lineWidth = strand === 4 ? 1.8 : .65
        ctx.stroke()
      }
      const trace = smooth(t / .5)
      for (let ring = 0; ring < 3; ring++) {
        const release = smooth((t - .57) / .4)
        ctx.globalAlpha = (1 - release) * .78 * smooth(t / .15)
        ctx.strokeStyle = target.color; ctx.lineWidth = ring ? .7 : 1.3
        ctx.beginPath()
        const rotation = index * Math.PI + t * 1.4 + ring * .5
        ctx.arc(target.x, target.y, 27 + ring * 7 + release * 28, rotation, rotation + Math.PI * 1.65 * trace)
        ctx.stroke()
      }
      const impact = clamp((t - .56) / .27)
      if (impact > 0 && impact < 1) {
        ctx.globalAlpha = Math.sin(impact * Math.PI) * .8
        ctx.strokeStyle = target.color; ctx.lineWidth = 2 * (1 - impact) + .4
        ctx.beginPath(); ctx.ellipse(target.x, target.y, 25 + impact * 43, 25 + impact * 27, 0, 0, Math.PI * 2); ctx.stroke()
      }
    }
    for (const p of particles) {
      const build = smooth((t - .12 - p.delay) / .43)
      const angle = p.angle + (1 - build) * 3.2
      const px = p.target.x + Math.cos(angle) * p.radius * (1 - build) + p.x * build
      const py = p.target.y + Math.sin(angle) * p.radius * .7 * (1 - build) + p.y * build
      ctx.globalAlpha = smooth(t / .12) * (1 - smooth((t - .62) / .16))
      ctx.fillStyle = build > .86 ? p.color : p.target.color
      const size = 1.2 + build * .9
      ctx.fillRect(px, py, size, size)
    }
    ctx.globalAlpha = 1
    frame = requestAnimationFrame(draw)
  }
  frame = requestAnimationFrame(draw)
  return () => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height) }
}
