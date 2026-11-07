import assert from 'node:assert/strict'
import { spawnSync, execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
const database = process.env.MITINTA_QA_DATABASE
if (!database || !/^mitinta_mcp_qa_\d+$/.test(database)) throw new Error('Use an isolated MITINTA_QA_DATABASE=mitinta_mcp_qa_<date>')
const prefix = ['exec', '131', '--', 'docker', 'exec', '-i', 'supabase-db', 'psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1']
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const json = value => `${quote(JSON.stringify(value))}::jsonb`
const userA = randomUUID(), userB = randomUUID()
const run = (sql, owner) => {
  const source = owner ? `set role authenticated; set request.jwt.claim.sub=${quote(owner)}; ${sql}` : sql
  const result = spawnSync('pct', prefix, { input: source, encoding: 'utf8' })
  if (result.status) throw new Error(result.stderr)
  return result.stdout.trim()
}
const read = (sql, owner = userA) => JSON.parse(run(sql, owner))
const saveSQL = (requestId, id, rev, metadata, entries, replace = false) => `select public.save_deck_atomic(${quote(requestId)},${id ? quote(id) : 'null'},${rev ? quote(rev) : 'null'},${json(metadata)},${json(entries)},${replace});`
const row = (id, qty = 1) => ({ card_id: id, quantity: qty, card_name: id, card_version: '', set_code: '9', collector_number: '1' })
const failed = (sql, pattern, owner = userA) => assert.throws(() => run(sql, owner), pattern)
let count = 0
const pass = label => { count++; console.log('PASS', label) }
run(`grant usage on schema public to authenticated; grant select,insert,update,delete on public.profiles,public.collection_entries,public.decks,public.deck_entries to authenticated; insert into auth.users(id,email,raw_user_meta_data) values(${quote(userA)},'synthetic-a@example.com','{}'),(${quote(userB)},'synthetic-b@example.com','{}');`)
const createId = randomUUID(), createSQL = saveSQL(createId, null, null, { name: 'PRUEBA MCP', format: 'core' }, [row('card-a', 2)], true)
const created = read(createSQL); assert.equal(created.entries.length, 1); assert.equal(created.deck.user_id, userA); pass('Atomic create with RLS identity')
assert.equal(read(`select public.get_own_deck_snapshots(array[${quote(created.deck.id)}]::uuid[]);`)[0].deck.id, created.deck.id)
failed(`select public.get_own_deck_snapshots(array[${quote(created.deck.id)}]::uuid[]);`, /Deck not found/, userB)
failed(`select public.get_own_deck_snapshots(array[${quote(created.deck.id)},${quote(created.deck.id)}]::uuid[]);`, /Invalid deck IDs/); pass('Batch deck reads enforce ownership and unique IDs')
assert.equal(read(createSQL).deck.id, created.deck.id); pass('Create operation replay has one deck')
failed(saveSQL(createId, null, null, { name: 'Different', format: 'core' }, [], true), /Operation ID already used/); pass('Idempotency key input mismatch rejected')
const before = Number(run('select count(*) from public.decks;', userA))
failed(saveSQL(randomUUID(), null, null, { name: 'Must roll back', format: 'core' }, [row('card-x', 100)], true), /Invalid or duplicate/)
assert.equal(Number(run('select count(*) from public.decks;', userA)), before); pass('Invalid entries roll back metadata and deck creation')
failed(`select public.get_own_deck_snapshot(${quote(created.deck.id)});`, /Deck not found/, userB)
failed(saveSQL(randomUUID(), created.deck.id, created.revision, { name: 'Intrusion' }, []), /Deck not found/, userB)
failed(`select public.delete_deck_atomic(${quote(randomUUID())},${quote(created.deck.id)},${quote(created.revision)});`, /Deck not found/, userB); pass('Foreign reads, writes and deletes denied')
const updateId = randomUUID(), updateSQL = saveSQL(updateId, created.deck.id, created.revision, { description: 'Edited' }, [row('card-a', 0), row('card-b', 3)])
const edited = read(updateSQL); assert.equal(edited.entries.length, 1); assert.equal(edited.entries[0].card_id, 'card-b'); assert.notEqual(edited.revision, created.revision); pass('Atomic metadata and entry patch with zero removal')
assert.equal(read(updateSQL).revision, edited.revision); pass('Update operation replay')
failed(saveSQL(randomUUID(), created.deck.id, created.revision, { name: 'Stale' }, []), /Deck changed/); pass('Stale revision rejected without lost updates')
failed(saveSQL(randomUUID(), created.deck.id, edited.revision, { name: 'Must roll back' }, [row('duplicate'), row('duplicate')], true), /Invalid or duplicate/)
assert.equal(read(`select public.get_own_deck_snapshot(${quote(created.deck.id)});`).deck.name, 'PRUEBA MCP'); pass('Replacement failure rolls back all changes')
const race = async name => {
  const sql = `set role authenticated; set request.jwt.claim.sub=${quote(userA)}; ${saveSQL(randomUUID(), created.deck.id, edited.revision, { name }, [])}`
  return promisify(execFile)('pct', [...prefix.filter(value => value !== '-i'), '-c', sql])
}
const raced = await Promise.allSettled([race('Race A'), race('Race B')]); assert.equal(raced.filter(row => row.status === 'fulfilled').length, 1); assert.ok(raced.some(row => row.status === 'rejected' && row.reason.stderr.includes('Deck changed'))); pass('Concurrent writers: one success, one revision conflict')
const latest = read(`select public.get_own_deck_snapshot(${quote(created.deck.id)});`), deleteId = randomUUID()
const deletion = `select public.delete_deck_atomic(${quote(deleteId)},${quote(created.deck.id)},${quote(latest.revision)});`
assert.equal(read(deletion).deleted, true); assert.equal(read(deletion).deleted, true); assert.equal(read(updateSQL).revision, edited.revision); pass('Delete and prior update replay after deletion')
const quotaRows = Array.from({ length: 100 }, (_, i) => `(${quote(userA)},${quote('PRUEBA QUOTA ' + i)},'core')`).join(',')
run(`insert into public.decks(user_id,name,format) values ${quotaRows};`, userA)
failed(saveSQL(randomUUID(), null, null, { name: 'Over quota', format: 'core' }, [], true), /at most 100 decks/); pass('Existing production deck quota remains enforced')
failed(`insert into public.deck_operations(user_id,request_id,request_hash,request_data,response) values(${quote(userB)},${quote(randomUUID())},'synthetic','{}',jsonb_build_object('large',repeat('x',524289)));`, /deck_operation_size/, userB); pass('Direct receipt inserts have a size limit')
run(`insert into public.deck_operations(user_id,request_id,request_hash,request_data,response) select ${quote(userB)},gen_random_uuid(),'synthetic','{}','{}' from generate_series(1,1000);`, userB)
failed(`insert into public.deck_operations(user_id,request_id,request_hash,request_data,response) values(${quote(userB)},${quote(randomUUID())},'synthetic','{}','{}');`, /storage limit reached/, userB); pass('Direct receipt inserts cannot bypass the per-account quota')
console.log(`${count} PostgreSQL checks passed in isolated database.`)
