import { useEffect, useRef, useState } from 'react'
import { Bot, Copy, ExternalLink, Unplug, X } from 'lucide-react'
import { supabase } from './supabase'
import './aiConnections.css'

const MCP_ORIGIN = 'https://lorcana-mcp.mitinta.app'
const MCP_URL = `${MCP_ORIGIN}/mcp`
type Connection = { id: string; client_name: string; scopes: string[]; created_at: number; expires_at: number; revoked_at: number | null }
async function api(path = '', method = 'GET') {
  const { data } = await supabase.auth.getSession()
  if (!data.session) throw new Error('Vuelve a iniciar sesión para consultar tus conexiones.')
  const response = await fetch(`${MCP_ORIGIN}/api/connections${path}`, { method,
    headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(response.status === 401 ? 'La sesión ha caducado. Vuelve a entrar.' : 'No se pudo completar la consulta. Vuelve a intentarlo.')
  return response.json() as Promise<{ connections?: Connection[] }>
}
export function AIConnections({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revoking, setRevoking] = useState<string | null>(null)
  async function load() {
    setError(''); setLoading(true)
    try { setConnections((await api()).connections ?? []) }
    catch (issue) { setError(issue instanceof Error ? issue.message : 'No se pudieron consultar tus conexiones.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    dialog.current?.showModal()
    void load()
    return () => { dialog.current?.close() }
  }, [])
  async function revoke(row: Connection) {
    setRevoking(row.id); setError(''); setNotice('')
    try {
      await api(`/${row.id}`, 'DELETE')
      setConnections(current => current.map(item => item.id === row.id ? { ...item, revoked_at: Math.floor(Date.now() / 1000) } : item))
      setNotice(`Se ha desconectado ${row.client_name}. Para volver a usarla tendrás que autorizarla de nuevo.`)
    } catch (issue) { setError(issue instanceof Error ? issue.message : 'No se pudo revocar la conexión.') }
    finally { setRevoking(null) }
  }
  return <dialog className="ai-connections" ref={dialog} onCancel={onClose} aria-labelledby="ai-title">
    <div className="ai-heading"><Bot aria-hidden="true" /><h2 id="ai-title">Conexiones de IA</h2><button type="button" className="icon-command" onClick={onClose} aria-label="Cerrar conexiones de IA"><X /></button></div>
    <p>Conecta tu IA para consultar tus cartas, saber qué te falta y gestionar tus mazos.</p>
    <label className="ai-url-label" htmlFor="ai-url">Dirección del servidor MCP</label>
    <div className="ai-url"><input id="ai-url" value={MCP_URL} readOnly onFocus={event => event.currentTarget.select()} /><button type="button" className="icon-command" aria-label="Copiar dirección MCP" onClick={() => void navigator.clipboard.writeText(MCP_URL).then(() => setNotice('Dirección copiada.')).catch(() => setNotice('Selecciona la dirección para copiarla.'))}><Copy /></button></div>
    <ol><li>Añade esta dirección como servidor MCP remoto en tu cliente de IA.</li><li>Inicia sesión con tu cuenta de MiTinta en la autorización.</li><li>Elige si permites crear, editar y eliminar mazos.</li></ol>
    <p className="ai-readonly">Tu colección siempre es de solo lectura. Puedes retirar el acceso a una IA en cualquier momento.</p>
    <a className="ai-help" href={MCP_ORIGIN} target="_blank" rel="noreferrer">Ver información de conexión <ExternalLink aria-hidden="true" /></a>
    <h3>Aplicaciones conectadas</h3>
    {notice && <p role="status" className="notice">{notice}</p>}
    {error && <div role="alert" className="notice error"><p>{error}</p><button type="button" onClick={() => void load()}>Volver a intentar</button></div>}
    {loading ? <p role="status">Consultando conexiones…</p> : !error && connections.length === 0 ? <p className="ai-empty">Todavía no has conectado ninguna IA.</p> : <ul className="ai-list">{connections.map(row => {
      const active = !row.revoked_at && row.expires_at > Date.now() / 1000
      return <li key={row.id}><div><strong>{row.client_name}</strong><span>{row.scopes.includes('decks:write') ? 'Consultar colección y gestionar mazos' : 'Solo consulta'}</span><small>{row.revoked_at ? 'Acceso revocado' : !active ? 'Conexión caducada' : `Autorizada el ${new Date(row.created_at * 1000).toLocaleDateString('es-ES')}`}</small></div>{active && <button type="button" disabled={revoking !== null} onClick={() => void revoke(row)} aria-label={`Desconectar ${row.client_name}`}><Unplug aria-hidden="true" />{revoking === row.id ? 'Desconectando…' : 'Desconectar'}</button>}</li>
    })}</ul>}
  </dialog>
}
