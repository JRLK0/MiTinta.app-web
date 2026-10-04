type InkTarget = { x: number; y: number; color: string; image: HTMLImageElement; fresh: boolean }
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t) }

// Living pigment under the seals. The independent currents never reset together;
// soft ribbons exchange colours, while their cores stay readable and still.
export function animateDeckInkAmbient(canvas: HTMLCanvasElement, host: HTMLElement, palette: Record<string, string>) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  let targets: { x: number; y: number; color: string }[] = []
  let width = 0, height = 0, frame = 0, last = 0, time = 0, visible = false, disposed = false
  const resize = () => {
    const bounds = canvas.getBoundingClientRect()
    width = bounds.width; height = bounds.height
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    targets = [...host.querySelectorAll<HTMLElement>('.deck-ink-seal')].map(seal => {
      const box = seal.getBoundingClientRect()
      return { x: box.left + box.width / 2 - bounds.left, y: box.top + box.height / 2 - bounds.top, color: palette[seal.dataset.ink!] }
    })
  }
  const draw = (now: number) => {
    if (now - last < 33) { frame = requestAnimationFrame(draw); return }
    time += Math.min((now - last) / 1000, .07); last = now
    ctx.clearRect(0, 0, width, height)
    for (const [index, a] of targets.entries()) {
      const b = targets[(index + 1) % targets.length]
      const t = time + index * 2.73
      const direction = index % 2 ? -1 : 1
      // A single ink circulates around itself; any additional ink joins the exchange.
      const single = targets.length === 1
      const start = { x: a.x + (single ? -26 : 0), y: a.y }
      const end = { x: b.x + (single ? 26 : 0), y: b.y }
      const drift = Math.sin(t * .47) * 9 + Math.sin(t * .79 + 1.4) * 5
      const c1 = { x: start.x + Math.cos(t * .31) * 18, y: start.y + direction * (30 + drift) }
      const c2 = { x: end.x + Math.sin(t * .39 + .8) * 16, y: end.y - direction * (26 - drift) }
      const color = ctx.createLinearGradient(start.x - 1, start.y, end.x + 1, end.y)
      color.addColorStop(0, a.color); color.addColorStop(1, b.color)
      ctx.strokeStyle = color; ctx.lineCap = 'round'
      // Layered pigment creates a soft edge without a per-frame blur filter.
      for (const [stroke, opacity] of [[24, .025], [16, .045], [8, .085], [2, .18]]) {
        ctx.globalAlpha = opacity
        ctx.lineWidth = stroke; ctx.beginPath(); ctx.moveTo(start.x, start.y)
        ctx.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, end.x, end.y); ctx.stroke()
      }
      // Small washes travel along the current in opposite directions.
      for (let wash = 0; wash < 3; wash++) {
        const phase = (t * .13 + wash / 3) % 2
        const u = phase < 1 ? phase : 2 - phase, v = 1 - u
        const x = v ** 3 * start.x + 3 * v * v * u * c1.x + 3 * v * u * u * c2.x + u ** 3 * end.x
        const y = v ** 3 * start.y + 3 * v * v * u * c1.y + 3 * v * u * u * c2.y + u ** 3 * end.y
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 16)
        glow.addColorStop(0, phase < 1 ? a.color : b.color); glow.addColorStop(1, 'transparent')
        ctx.globalAlpha = .28 * Math.sin(Math.PI * u)
        ctx.fillStyle = glow; ctx.fillRect(x - 16, y - 16, 32, 32)
      }
      const x = a.x + Math.cos(t * .27) * 23, y = a.y + Math.sin(t * .41) * 21
      const haze = ctx.createRadialGradient(x, y, 2, x, y, 38)
      haze.addColorStop(0, a.color); haze.addColorStop(1, 'transparent')
      ctx.globalAlpha = .13; ctx.fillStyle = haze; ctx.fillRect(x - 38, y - 38, 76, 76)
    }
    ctx.globalAlpha = 1
    frame = requestAnimationFrame(draw)
  }
  const update = () => {
    cancelAnimationFrame(frame)
    const active = !disposed && visible && !document.hidden && !motion.matches && targets.length > 0
    canvas.dataset.flowState = active ? 'active' : motion.matches ? 'reduced' : 'paused'
    if (active) { last = performance.now(); frame = requestAnimationFrame(draw) }
    else ctx.clearRect(0, 0, width, height)
  }
  const observer = new IntersectionObserver(entries => { visible = entries.some(entry => entry.isIntersecting); update() })
  const dimensions = new ResizeObserver(() => { resize(); update() })
  observer.observe(host); dimensions.observe(host)
  motion.addEventListener('change', update); document.addEventListener('visibilitychange', update)
  resize()
  return () => {
    disposed = true; cancelAnimationFrame(frame); observer.disconnect(); dimensions.disconnect()
    motion.removeEventListener('change', update); document.removeEventListener('visibilitychange', update)
    ctx.clearRect(0, 0, width, height)
  }
}

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
