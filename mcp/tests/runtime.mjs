import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const BASE = 'https://lorcana-mcp.mitinta.app', WEB = 'https://mitinta.app'
const userA = randomUUID(), userB = randomUUID(), deckA = randomUUID(), deckB = randomUUID()
const password = randomBytes(20).toString('base64url')
const sessions = new Map(), decks = new Map(), operations = new Map()
let tokenSequence = 0, refreshCalls = 0, backendVersion = 'test-v1', shortSession = false
const card = (id, name, version = 'Example') => ({ id, name, version, set_code: '9', set_name: 'Set', collector_number: id, image_url: null, ink: 'Amethyst', rarity: 'common', card_type: 'Character', cost: 1, rules_text: '', language: 'en', normal_price_eur: 1, foil_price_eur: 2 })
const cards = [card('card-a', 'Mickey Mouse'), card('card-b', 'Donald Duck'), { ...card('card-a-reprint', 'Mickey Mouse'), set_code: '10' }]
const entry = (card, quantity) => ({ ...card, card_id: card.id, card_name: card.name, card_version: card.version, quantity })
const collection = Array.from({ length: 1001 }, (_, index) => ({ card_id: `filler-${index}`, card_name: `Filler ${index}`, card_version: '', quantity: 1, language: 'en', finish: 'NORMAL', set_code: '9', collector_number: String(index) }))
collection.push({ card_id: 'card-a', card_name: 'Mickey Mouse', card_version: 'Example', quantity: 1, language: 'en', finish: 'NORMAL', set_code: '9', collector_number: '1' }, { card_id: 'card-a-reprint', card_name: 'Mickey Mouse', card_version: 'Example', quantity: 1, language: 'es', finish: 'FOIL', set_code: '10', collector_number: '1' })
const makeSnapshot = (id, userId, entries) => ({ deck: { id, user_id: userId, name: 'PRUEBA MCP', description: '', is_public: true, format: 'core', updated_at: new Date().toISOString() }, entries, revision: 'a'.repeat(64) })
decks.set(deckA, makeSnapshot(deckA, userA, [entry(cards[0], 3)]))
decks.set(deckB, makeSnapshot(deckB, userB, [entry(cards[1], 2)]))
function session(userId) {
  const access_token = `synthetic-access-${++tokenSequence}`, refresh_token = `synthetic-refresh-${tokenSequence}`
  sessions.set(access_token, userId); sessions.set(refresh_token, userId)
  return { access_token, refresh_token, user: { id: userId }, expires_in: shortSession ? 10 : 3600 }
}
const resp = (value, status = 200) => Response.json(value, { status })
const canonical = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object' ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
const outbound = async request => {
  const url = new URL(request.url)
  if (process.env.DEBUG_MOCK) console.log('MOCK', request.method, url.hostname, url.pathname)
  if (request.url === `${WEB}/backend.json`) return resp({ url: 'https://api.mitinta.app', publishableKey: 'sb_publishable_synthetic', version: backendVersion, maintenance: false })
  if (request.url === `${WEB}/collection/catalog.json`) return resp({ updated_at: '2026-11-07', cards })
  if (url.pathname === '/auth/v1/token') {
    const data = await request.json()
    if (url.searchParams.get('grant_type') === 'refresh_token') {
      refreshCalls++
      const id = sessions.get(data.refresh_token)
      if (!id) return resp({}, 401)
      shortSession = false
      return resp(session(id))
    }
    return data.password === password ? resp(session(data.email === 'b@example.com' ? userB : userA)) : resp({}, 400)
  }
  const owner = sessions.get(request.headers.get('authorization')?.slice(7))
  if (url.pathname === '/auth/v1/user') return owner ? resp({ id: owner }) : resp({}, 401)
  if (url.pathname === '/auth/v1/logout') return resp({})
  if (!owner) return resp({}, 401)
  if (url.pathname === '/rest/v1/collection_entries') return resp((owner === userA ? collection : []).slice(Number(url.searchParams.get('offset')), Number(url.searchParams.get('offset')) + Number(url.searchParams.get('limit'))))
  if (url.pathname === '/rest/v1/decks') return resp([...decks.values()].filter(row => row.deck.user_id === owner).map(row => row.deck))
  if (url.pathname === '/rest/v1/deck_operations') {
    const op = operations.get(`${owner}:${url.searchParams.get('request_id')?.slice(3)}`)
    return resp(op ? [op] : [])
  }
  const data = await request.json()
  if (url.pathname.endsWith('/get_own_deck_snapshots')) {
    const rows = data.target_deck_ids.map(id => decks.get(id))
    return rows.some(row => row?.deck.user_id !== owner) ? resp({ code: 'P0002' }, 404) : resp(rows)
  }
  if (url.pathname.endsWith('/get_own_deck_snapshot')) {
    const row = decks.get(data.target_deck_id)
    return row?.deck.user_id === owner ? resp(row) : resp({ code: 'P0002' }, 404)
  }
  const key = `${owner}:${data.request_id}`
  if (url.pathname.endsWith('/save_deck_atomic')) {
    const input = { kind: 'save', deck_id: data.target_deck_id, expected_revision: data.expected_revision, metadata: data.metadata, entries: data.entries.map(({ card_id, quantity }) => ({ card_id, quantity })).sort((a, b) => a.card_id.localeCompare(b.card_id)), replace_entries: data.replace_entries }
    const op = operations.get(key)
    if (op) return canonical(input) === canonical(op.request_data) ? resp(op.response) : resp({ code: '22023' }, 400)
    const previous = data.target_deck_id ? decks.get(data.target_deck_id) : null
    if (data.target_deck_id && previous?.deck.user_id !== owner) return resp({ code: 'P0002' }, 404)
    if (previous && previous.revision !== data.expected_revision) return resp({ code: '40001' }, 409)
    const id = data.target_deck_id ?? randomUUID()
    const snapshot = makeSnapshot(id, owner, data.replace_entries ? [] : [...previous.entries])
    snapshot.deck = { ...snapshot.deck, ...previous?.deck, ...data.metadata }
    for (const row of data.entries) snapshot.entries = [...snapshot.entries.filter(entry => entry.card_id !== row.card_id), ...(row.quantity > 0 ? [row] : [])]
    snapshot.revision = createHash('sha256').update(JSON.stringify(snapshot.entries) + JSON.stringify(snapshot.deck)).digest('hex')
    decks.set(id, snapshot); operations.set(key, { request_data: input, response: snapshot })
    return resp(snapshot)
  }
  if (url.pathname.endsWith('/delete_deck_atomic')) {
    if (operations.has(key)) return resp(operations.get(key).response)
    const row = decks.get(data.target_deck_id)
    if (row?.deck.user_id !== owner) return resp({ code: 'P0002' }, 404)
    if (row.revision !== data.expected_revision) return resp({ code: '40001' }, 409)
    decks.delete(data.target_deck_id)
    const response = { id: data.target_deck_id, deleted: true }
    operations.set(key, { response }); return resp(response)
  }
  throw new Error(`Unexpected synthetic endpoint: ${url.pathname}`)
}
const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, scriptPath: 'dist/worker.js', compatibilityDate: '2026-11-07', compatibilityFlags: ['nodejs_compat', 'global_fetch_strictly_public'], d1Databases: ['DB'], kvNamespaces: ['OAUTH_KV'], bindings: { BASE_URL: BASE, WEB_ORIGIN: WEB, SESSION_KEY: randomBytes(32).toString('base64') }, outboundService: outbound }))
const send = (path, init = {}) => mf.dispatchFetch(BASE + path, { ...init, redirect: 'manual' })
const jsonHeaders = { 'Content-Type': 'application/json' }
let count = 0
const passed = name => { count++; console.log('PASS', name) }
async function startAuthorization(write = false, email = 'a@example.com') {
  const registration = await send('/oauth/register', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ client_name: 'PRUEBA MCP <synthetic>', redirect_uris: ['https://example.com/callback'], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }) })
  assert.equal(registration.status, 201)
  const registered = await registration.json()
  const verifier = randomBytes(32).toString('base64url'), challenge = createHash('sha256').update(verifier).digest('base64url')
  const params = new URLSearchParams({ response_type: 'code', client_id: registered.client_id, redirect_uri: 'https://example.com/callback', scope: 'collection:read decks:read decks:write offline_access', code_challenge: challenge, code_challenge_method: 'S256', state: 'synthetic', resource: BASE + '/mcp' })
  const path = '/authorize?' + params
  const page = await send(path), html = await page.text()
  assert.equal(page.status, 200)
  assert.ok(html.includes('&#60;synthetic&#62;')); assert.ok(!html.includes('checked'))
  const handle = html.match(/name="handle" value="([^"]+)"/)?.[1]
  assert.ok(handle)
  const cookie = page.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  const form = new URLSearchParams({ email, password, handle, decision: 'approve', ...(write ? { decks_write: 'yes' } : {}) })
  return { path, form, cookie, verifier, registered }
}
async function authorize(write = false, email = 'a@example.com') {
  const info = await startAuthorization(write, email)
  const approval = await send(info.path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE, Cookie: info.cookie }, body: info.form.toString() })
  assert.equal(approval.status, 302, await approval.clone().text())
  const code = new URL(approval.headers.get('location')).searchParams.get('code')
  const exchange = await send('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: info.registered.client_id, redirect_uri: 'https://example.com/callback', code, code_verifier: info.verifier, resource: BASE + '/mcp' }) })
  assert.equal(exchange.status, 200, await exchange.clone().text())
  return { ...await exchange.json(), client_id: info.registered.client_id }
}
const clientFetch = async (input, init) => {
  const request = input instanceof Request ? input : new Request(input, init)
  const url = new URL(request.url)
  return send(url.pathname + url.search, { method: request.method, headers: request.headers, body: request.method === 'POST' ? await request.text() : undefined })
}
async function client(token) {
  const value = new Client({ name: 'MiTinta synthetic QA', version: '1.0.0' })
  await value.connect(new StreamableHTTPClientTransport(new URL(BASE + '/mcp'), { requestInit: { headers: { Authorization: `Bearer ${token}` } }, fetch: clientFetch }))
  return value
}
const call = async (client, name, args = {}) => {
  const result = await client.callTool({ name, arguments: args })
  return result.isError ? { error: true, ...JSON.parse(result.content[0].text) } : result.structuredContent.data
}
try {
  const db = await mf.getD1Database('DB')
  for (const sql of (await readFile('schema.sql', 'utf8')).split(';').map(value => value.trim()).filter(Boolean)) await db.prepare(sql).run()
  assert.equal((await send('/mcp')).status, 401)
  const resource = await (await send('/.well-known/oauth-protected-resource/mcp')).json()
  assert.equal(resource.resource, BASE + '/mcp'); passed('OAuth discovery and unauthenticated rejection')
  const cancelled = await startAuthorization()
  const denied = await send(cancelled.path, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE, Cookie: cancelled.cookie }, body: new URLSearchParams({ handle: cancelled.form.get('handle'), decision: 'deny' }) })
  assert.equal(denied.status, 302); assert.equal(new URL(denied.headers.get('location')).searchParams.get('error'), 'access_denied'); passed('Consent denial')
  const readToken = await authorize(), reader = await client(readToken.access_token)
  const tools = (await reader.listTools()).tools
  assert.equal(tools.length, 10); assert.ok(tools.find(tool => tool.name === 'delete_deck').annotations.destructiveHint); passed('Official MCP client discovers ten annotated tools')
  const writeDenied = await send('/mcp', { method: 'POST', headers: { ...jsonHeaders, authorization: 'Bearer ' + readToken.access_token, accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_deck', arguments: { request_id: randomUUID(), name: 'Denied', format: 'core' } } }) })
  assert.equal(writeDenied.status, 403); assert.match(writeDenied.headers.get('www-authenticate'), /insufficient_scope.*decks:write/); passed('Read consent blocks writes and advertises OAuth step-up')
  assert.equal((await call(reader, 'list_collection', { limit: 100, offset: 1000 })).items.length, 3)
  const summary = await call(reader, 'get_collection_summary'); assert.equal(summary.copies, 1003); assert.equal(summary.by_finish.FOIL, 1); passed('Complete collection pagination and finish/language totals')
  const missing = await call(reader, 'get_missing_cards', { deck_ids: [deckA] }); assert.equal(missing.decks[0].missing_copies, 1); passed('Equivalent reprints, languages and finishes count together')
  assert.equal((await call(reader, 'get_deck', { deck_id: deckB })).error, 'deck_not_found'); passed('Foreign public deck is rejected')
  assert.equal((await call(reader, 'get_missing_cards', { deck_ids: [deckA, deckA] })).error, 'duplicate_deck'); passed('Duplicate deck IDs cannot inflate missing totals')
  const writerToken = await authorize(true), writer = await client(writerToken.access_token)
  const create = { request_id: randomUUID(), name: 'PRUEBA MCP', format: 'core', entries: [{ card_id: 'card-a', quantity: 3 }] }
  const created = await call(writer, 'create_deck', create); assert.ok(created.deck.id); assert.equal(created.deck.is_public, false)
  assert.equal((await call(writer, 'create_deck', create)).deck.id, created.deck.id); passed('Create private draft and replay without duplicate')
  assert.equal((await call(writer, 'create_deck', { ...create, name: 'Different' })).error, 'request_id_reused'); passed('Operation ID cannot be reused for different input')
  const independent = await call(writer, 'get_missing_cards', { deck_ids: [deckA, created.deck.id] })
  assert.deepEqual(independent.decks.map(row => row.missing_copies), [1, 1])
  const simultaneous = await call(writer, 'get_missing_cards', { deck_ids: [deckA, created.deck.id], mode: 'simultaneous' })
  assert.equal(simultaneous.missing_copies, 4); passed('Independent versus simultaneous assembly')
  assert.equal((await call(writer, 'update_deck', { request_id: randomUUID(), deck_id: created.deck.id, expected_revision: 'f'.repeat(64), name: 'Stale' })).error, 'deck_conflict'); passed('Stale revisions are rejected')
  const update = { request_id: randomUUID(), deck_id: created.deck.id, expected_revision: created.revision, entries: [{ card_id: 'card-a', quantity: 0 }, { card_id: 'card-b', quantity: 2 }] }
  const edited = await call(writer, 'update_deck', update); assert.equal(edited.entries.length, 1); assert.equal(edited.entries[0].card_id, 'card-b'); passed('Absolute card quantities and zero removal')
  const deletion = { request_id: randomUUID(), deck_id: created.deck.id, expected_revision: edited.revision }
  assert.equal((await call(writer, 'delete_deck', deletion)).deleted, true)
  assert.equal((await call(writer, 'delete_deck', deletion)).deleted, true)
  assert.equal((await call(writer, 'update_deck', update)).revision, edited.revision); passed('Delete and update retries remain idempotent after later deletion')
  assert.equal((await call(writer, 'create_deck', { request_id: randomUUID(), name: 'Invalid', format: 'core', entries: [{ card_id: 'invented', quantity: 1 }] })).error, 'card_not_found'); passed('Invented card identifiers rejected')
  const bToken = await authorize(true, 'b@example.com'), bClient = await client(bToken.access_token)
  assert.equal((await call(bClient, 'get_collection_summary')).copies, 0)
  assert.deepEqual((await call(bClient, 'list_decks')).items.map(row => row.id), [deckB]); passed('Second account sees only its own data')
  const replay = await startAuthorization()
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Origin: BASE, Cookie: replay.cookie }
  const attempts = await Promise.all([send(replay.path, { method: 'POST', headers, body: replay.form }), send(replay.path, { method: 'POST', headers, body: replay.form })])
  assert.deepEqual(attempts.map(value => value.status).sort(), [302, 400]); passed('Concurrent consent consumes the browser transaction once')
  const browser = session(userA), manageHeaders = { Authorization: 'Bearer ' + browser.access_token, Origin: WEB }
  const listing = await send('/api/connections', { headers: manageHeaders }), listingText = await listing.text()
  assert.equal(listing.headers.get('access-control-allow-origin'), WEB)
  assert.ok(!listingText.includes('encrypted_session')); assert.ok(!listingText.includes('synthetic-access')); passed('Connection management exposes no credentials')
  const rows = JSON.parse(listingText).connections
  for (const row of rows) assert.equal((await send('/api/connections/' + row.id, { method: 'DELETE', headers: manageHeaders })).status, 200)
  assert.equal((await send('/mcp', { headers: { Authorization: 'Bearer ' + writerToken.access_token } })).status, 401)
  const afterRevoke = await send('/oauth/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: writerToken.client_id, refresh_token: writerToken.refresh_token, resource: BASE + '/mcp' }) })
  assert.equal(afterRevoke.status, 400); passed('Revocation blocks existing access and refresh tokens')
  shortSession = true
  const renewed = await authorize(true), renewedClient = await client(renewed.access_token)
  assert.ok(refreshCalls >= 1); passed('Independent upstream session renews during token exchange')
  backendVersion = 'test-v2'
  assert.equal((await send('/mcp', { headers: { Authorization: 'Bearer ' + renewed.access_token } })).status, 401); passed('Backend version change requires fresh authorization')
  assert.equal((await send('/api/connections', { headers: { ...manageHeaders, Origin: 'https://evil.example' } })).status, 403)
  assert.equal((await send('/authorize', { method: 'POST', headers: { Origin: 'https://evil.example' }, body: 'x' })).status, 403); passed('Cross-origin management and consent rejected')
  assert.equal((await send('/mcp', { method: 'POST', body: 'x'.repeat(131073) })).status, 413); passed('Oversized requests bounded before parsing')
  await Promise.all([reader.close(), writer.close(), bClient.close(), renewedClient.close()])
  console.log(`${count} runtime checks passed.`)
} finally { await mf.dispose() }
