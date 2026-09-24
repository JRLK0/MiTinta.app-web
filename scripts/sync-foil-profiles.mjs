import { mkdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const cardsPage = 'https://duels.ink/cards'
const html = await fetch(cardsPage).then((response) => {
  if (!response.ok) throw new Error(`No se pudo abrir ${cardsPage}: ${response.status}`)
  return response.text()
})
const dataAsset = html.match(/\/assets\/cards-data-[A-Za-z0-9_-]+\.js/)?.[0]
if (!dataAsset) throw new Error('No se encontró el módulo de datos de cartas de Duels.ink')

const sourceUrl = new URL(dataAsset, cardsPage).href
const source = await fetch(sourceUrl).then((response) => {
  if (!response.ok) throw new Error(`No se pudo descargar ${sourceUrl}: ${response.status}`)
  return response.text()
})

const entries = []
const cardPattern = /"id":"([^"]+)"(?:(?!\},\{"id":)[\s\S])*?"foil":(\{[^}]+\})/g
for (const match of source.matchAll(cardPattern)) {
  const foil = JSON.parse(match[2])
  entries.push([match[1], foil.type, Boolean(foil.topLayerMaskUrl), foil.topLayerMaskUrl])
}
if (entries.length < 3000) throw new Error(`Solo se detectaron ${entries.length} perfiles foil; se cancela para no generar un listado incompleto`)

entries.sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))
const lines = entries.map(([id, type, top]) => `  ${JSON.stringify(id)}: [${JSON.stringify(type)}, ${top}],`)
const output = `// Generado por npm run sync:foil-profiles desde ${sourceUrl}\n// No editar a mano.\nexport const foilProfiles = {\n${lines.join('\n')}\n} as const\n`
const outputPath = fileURLToPath(new URL('../frontend/src/foilProfiles.generated.ts', import.meta.url))
await writeFile(outputPath, output, 'utf8')

const androidProfilesPath = fileURLToPath(new URL('../../app/src/main/assets/foil_profiles.json', import.meta.url))
const androidProfiles = Object.fromEntries(entries.map(([id, type, top]) => [id, { type, top }]))
if (await stat(fileURLToPath(new URL('../../app/src/main/assets/', import.meta.url))).then(() => true, () => false)) {
  await writeFile(androidProfilesPath, JSON.stringify(androidProfiles), 'utf8')
}

const masksDirectory = fileURLToPath(new URL('../frontend/public/foil-top-masks/', import.meta.url))
await mkdir(masksDirectory, { recursive: true })
const masks = entries.filter(([, , hasTopMask]) => hasTopMask)
let nextMask = 0
async function processNextMask() {
  while (nextMask < masks.length) {
    const [id, , , relativeUrl] = masks[nextMask++]
    const response = await fetch(new URL(relativeUrl, 'https://cards.duels.ink').href)
    if (!response.ok) throw new Error(`No se pudo descargar la máscara superior de ${id}: ${response.status}`)
    const { data, info } = await sharp(Buffer.from(await response.arrayBuffer())).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let index = 0; index < data.length; index += 4) {
      const red = data[index] / 255 * 2 - 1
      const green = data[index + 1] / 255 * 2 - 1
      const blue = data[index + 2] / 255 * 2 - 1
      data[index] = 255
      data[index + 1] = 255
      data[index + 2] = 255
      data[index + 3] = Math.min(255, Math.max(0, red + green + blue) * 255)
    }
    await sharp(data, { raw: info }).webp({ lossless: true, effort: 4 }).toFile(`${masksDirectory}/${id}.webp`)
  }
}
await Promise.all(Array.from({ length: 10 }, processNextMask))
console.log(`Sincronizados ${entries.length} perfiles web/Android y ${masks.length} máscaras foil superiores`)
