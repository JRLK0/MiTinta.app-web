import { copyFile, mkdir } from 'node:fs/promises'

await mkdir('collection', { recursive: true })
await copyFile('legacy/collection.html', 'collection/index.html')
await copyFile('legacy/redirect.js', 'collection/redirect.js')
