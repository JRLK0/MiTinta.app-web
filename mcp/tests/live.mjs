// Explicit opt-in only. Accounts must have been provisioned as synthetic QA users.
import assert from 'node:assert/strict'
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
if (!process.env.MITINTA_QA_ACCOUNTS) throw new Error('Explicit MITINTA_QA_ACCOUNTS is required')
const accounts = JSON.parse(await readFile(process.env.MITINTA_QA_ACCOUNTS, 'utf8'))
assert.equal(accounts.length, 2)
for (const account of accounts) assert.match(account.email, /^mcp-qa-[a-f0-9]+-[ab]@example\.com$/)
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE)
const base = 'https://lorcana-mcp.mitinta.app', web = 'https://mitinta.app', callback = base + '/qa-callback'
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const headers = { 'Content-Type': 'application/json' }
const config = await (await fetch(web + '/backend.json')).json()
const fixtures = JSON.parse(await readFile('../.private/fixture-cards.json', 'utf8'))
const results = [], clients = []
const pass = text => { results.push(text); console.log('PASS', text) }
const contexts = []
async function authorize(account, write) {
  const cachePath = '../.private/live-grants.json'
  const cachedGrants = JSON.parse(await readFile(cachePath, 'utf8').catch(() => '{}'))
  const cacheKey = `${account.id}:${write}`
  const cached = cachedGrants[cacheKey]
  if (cached) {
    const check = await fetch(base + '/mcp', { headers: { Authorization: 'Bearer ' + cached.token.access_token } })
    if ([200, 405, 406].includes(check.status)) {
      const client = new Client({ name: 'MiTinta public QA', version: '1.0.0' })
      await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + cached.token.access_token } } }))
      clients.push(client)
      return { ...cached, client }
    }
  }
  const registration = await fetch(base + '/oauth/register', { method: 'POST', headers, body: JSON.stringify({ client_name: write ? 'PRUEBA MCP escritura' : 'PRUEBA MCP lectura', redirect_uris: [callback], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }) })
  assert.equal(registration.status, 201)
  const registered = await registration.json(), verifier = randomBytes(32).toString('base64url')
  const params = new URLSearchParams({ response_type: 'code', client_id: registered.client_id, redirect_uri: callback, scope: 'collection:read decks:read decks:write offline_access', code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', resource: base + '/mcp', state: randomUUID() })
  const context = await browser.newContext(), page = await context.newPage()
  contexts.push(context)
  let callbackURL
  await page.route(callback + '**', async route => { callbackURL = new URL(route.request().url()); await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Autorización de prueba recibida.</p>' }) })
  await page.goto(base + '/authorize?' + params, { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Correo electrónico').fill(account.email)
  await page.getByLabel('Contraseña').fill(account.password)
  if (write) await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Entrar y autorizar' }).click()
  try { await page.waitForURL(callback + '**', { timeout: 30000 }) }
  catch {
    const heading = await page.locator('h1').innerText().catch(() => '')
    const alert = await page.locator('[role=alert]').innerText().catch(() => '')
    throw new Error(`OAuth browser callback not reached: ${heading}; ${alert}`)
  }
  callbackURL ??= new URL(page.url())
  assert.equal(callbackURL.searchParams.get('state'), params.get('state'))
  assert.equal(callbackURL.searchParams.get('iss'), base)
  const exchange = await fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: registered.client_id, redirect_uri: callback, code: callbackURL.searchParams.get('code'), code_verifier: verifier, resource: base + '/mcp' }) })
  assert.equal(exchange.status, 200, 'Authorization exchange must succeed')
  const token = await exchange.json()
  cachedGrants[cacheKey] = { token, client_id: registered.client_id }
  await writeFile(cachePath, JSON.stringify(cachedGrants), { mode: 0o600 })
  const client = new Client({ name: 'MiTinta public QA', version: '1.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + token.access_token } } }))
  clients.push(client)
  return { client, token, client_id: registered.client_id }
}
async function call(client, name, args = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await client.callTool({ name, arguments: args })
      if (!result.isError) return result.structuredContent.data
      const issue = JSON.parse(result.content[0].text)
      if (['backend_unavailable', 'backend_error', 'operation_failed'].includes(issue.error) && attempt < 2) continue
      return { failed: true, ...issue }
    } catch (error) {
      if (error.code === 503 && attempt < 2) continue
      throw error
    }
  }
}
const stageRoot = process.env.MITINTA_STAGE_ASSETS
async function appPage(account, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 950 } }), page = await context.newPage()
  contexts.push(context)
  if (stageRoot) await page.route(web + '/**', async route => {
    let pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith('/')) pathname += 'index.html'
    const file = path.resolve(stageRoot, '.' + pathname)
    if (!file.startsWith(path.resolve(stageRoot) + path.sep)) return route.abort()
    try { await access(file); await route.fulfill({ path: file }) } catch { await route.continue() }
  })
  const login = await fetch(config.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { ...headers, apikey: config.publishableKey }, body: JSON.stringify({ email: account.email, password: account.password }) })
  assert.equal(login.status, 200)
  const session = await login.json()
  await page.addInitScript(({ key, session, config }) => {
    localStorage.setItem(key, JSON.stringify(session))
    localStorage.setItem('mitinta-backend-identity', JSON.stringify({ url: config.url, publishableKey: config.publishableKey, version: config.version }))
  }, { key: `mitinta-auth:${config.version}`, session, config })
  await page.goto(web + '/collection/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: account.email, exact: true }).waitFor({ timeout: 20000 })
  return { page, session }
}
try {
  const writer = await authorize(accounts[0], true); pass('Public browser OAuth with cookie, consent, PKCE, issuer and MCP client')
  assert.equal((await writer.client.listTools()).tools.length, 10); pass('Ten tools discovered on public endpoint')
  const reader = await authorize(accounts[0], false)
  const denied = await fetch(base + '/mcp', { method: 'POST', headers: { ...headers, Authorization: 'Bearer ' + reader.token.access_token, accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_deck', arguments: { request_id: randomUUID(), name: 'PRUEBA DENEGADA', format: 'core' } } }) })
  assert.equal(denied.status, 403); assert.match(denied.headers.get('www-authenticate'), /insufficient_scope/); pass('Public read consent blocks writing and returns a step-up challenge')
  const second = await authorize(accounts[1], true)
  const foreign = await call(second.client, 'create_deck', { request_id: randomUUID(), name: 'PRUEBA MCP otra cuenta', format: 'core', is_public: true, entries: [] })
  assert.ok(foreign.deck?.id)
  assert.equal((await call(writer.client, 'get_deck', { deck_id: foreign.deck.id })).error, 'deck_not_found'); pass('Public foreign deck still inaccessible through own-account MCP')
  const summary = await call(writer.client, 'get_collection_summary'); assert.equal(summary.copies, 2)
  const create = { request_id: randomUUID(), name: 'PRUEBA MCP navegador', format: 'core', entries: [{ card_id: fixtures[0].id, quantity: 3 }] }
  const created = await call(writer.client, 'create_deck', create); assert.ok(created.deck?.id)
  assert.equal((await call(writer.client, 'create_deck', create)).deck.id, created.deck.id); pass('Public create and retry without duplicate')
  const missing = await call(writer.client, 'get_missing_cards', { deck_ids: [created.deck.id] }); assert.equal(missing.decks[0].missing_copies, 1); pass('Public missing-card calculation uses real synthetic collection')
  const ui = await appPage(accounts[0])
  await ui.page.getByRole('button', { name: 'Mazos', exact: true }).first().click()
  await ui.page.getByRole('button', { name: 'Abrir y editar PRUEBA MCP navegador', exact: true }).click()
  assert.equal(await ui.page.getByLabel('Nombre del mazo').inputValue(), create.name)
  await ui.page.getByLabel('Nombre del mazo').fill('PRUEBA MCP editada en web')
  await ui.page.getByRole('button', { name: 'Guardar', exact: true }).click()
  await ui.page.getByText('Mazo guardado.', { exact: true }).or(ui.page.getByText(/Borrador guardado/)).waitFor({ timeout: 20000 })
  const edited = await call(writer.client, 'get_deck', { deck_id: created.deck.id }); assert.equal(edited.deck.name, 'PRUEBA MCP editada en web'); pass('MCP deck opens in web; atomic web save is visible through MCP')
  const stale = await call(writer.client, 'update_deck', { request_id: randomUUID(), deck_id: created.deck.id, expected_revision: created.revision, name: 'PRUEBA stale' }); assert.equal(stale.error, 'deck_conflict'); pass('Public web versus MCP stale edit rejected')
  const changed = await call(writer.client, 'update_deck', { request_id: randomUUID(), deck_id: created.deck.id, expected_revision: edited.revision, entries: [{ card_id: fixtures[0].id, quantity: 0 }, { card_id: fixtures[1].id, quantity: 2 }] })
  assert.ok(changed.deck?.id); assert.equal(changed.entries[0].card_id, fixtures[1].id); pass('Public MCP patch changes absolute quantities and removes entries')
  const deletion = { request_id: randomUUID(), deck_id: created.deck.id, expected_revision: changed.revision }
  assert.equal((await call(writer.client, 'delete_deck', deletion)).deleted, true)
  assert.equal((await call(writer.client, 'delete_deck', deletion)).deleted, true); pass('Public delete and replay')
  await ui.page.reload({ waitUntil: 'networkidle' })
  await ui.page.getByRole('button', { name: accounts[0].email, exact: true }).click()
  await ui.page.getByRole('menuitem', { name: 'Conexiones de IA', exact: true }).click()
  await ui.page.getByText('PRUEBA MCP escritura', { exact: true }).first().waitFor()
  await mkdir('../.private/screenshots', { recursive: true })
  await ui.page.screenshot({ path: '../.private/screenshots/connections-desktop.png' })
  await ui.page.setViewportSize({ width: 390, height: 844 })
  await ui.page.screenshot({ path: '../.private/screenshots/connections-mobile.png' })
  const metrics = await ui.page.locator('dialog.ai-connections').evaluate(node => ({ width: node.getBoundingClientRect().width, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }))
  assert.ok(metrics.width <= 390); assert.equal(metrics.scrollWidth, metrics.clientWidth); pass('Connection management renders without horizontal overflow on desktop and mobile')
  await ui.page.getByRole('button', { name: 'Desconectar PRUEBA MCP escritura', exact: true }).first().click()
  await ui.page.getByText(/Se ha desconectado PRUEBA MCP escritura/).waitFor()
  assert.equal((await fetch(base + '/mcp', { headers: { Authorization: 'Bearer ' + writer.token.access_token } })).status, 401)
  const refresh = await fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: writer.client_id, refresh_token: writer.token.refresh_token, resource: base + '/mcp' }) })
  assert.equal(refresh.status, 400); pass('Web revocation immediately rejects public access and refresh')
  assert.equal((await call(reader.client, 'get_collection_summary')).copies, 2); pass('Revoking one connection preserves another and the browser session')
  const renewal = await fetch(base + '/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: reader.client_id, refresh_token: reader.token.refresh_token, resource: base + '/mcp' }) })
  assert.equal(renewal.status, 200)
  const renewed = await renewal.json(), renewedClient = new Client({ name: 'MiTinta renewed QA', version: '1.0.0' })
  await renewedClient.connect(new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: { headers: { Authorization: 'Bearer ' + renewed.access_token } } }))
  clients.push(renewedClient)
  assert.equal((await call(renewedClient, 'get_collection_summary')).copies, 2); pass('Public OAuth refresh preserves the authorized account and read permissions')
  const freshForeign = await call(second.client, 'get_deck', { deck_id: foreign.deck.id })
  assert.equal((await call(second.client, 'delete_deck', { request_id: randomUUID(), deck_id: foreign.deck.id, expected_revision: freshForeign.revision })).deleted, true)
  await writeFile('../.private/live-results.json', JSON.stringify({ date: new Date().toISOString(), stagedWeb: Boolean(stageRoot), passed: results }, null, 2), { mode: 0o600 })
  console.log(`${results.length} public end-to-end checks passed.`)
} finally {
  await Promise.all(clients.map(client => client.close().catch(() => {})))
  await browser.close()
}
