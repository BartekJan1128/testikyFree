import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { errMsg, fmtDate } from '../../lib/format'
import { ErrorBox, SearchInput, Spinner } from '../../components/ui'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function AccessPanel({ testId, onCountChange }: { testId: number; onCountChange: (n: number) => void }) {
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('test_access').select('user_id').eq('test_id', testId),
    ]).then(([p, a]) => {
      if (p.error || a.error) setError(errMsg(p.error || a.error))
      setUsers((p.data as Profile[]) ?? [])
      setGranted(new Set((a.data ?? []).map((r: { user_id: string }) => r.user_id)))
    })
  }, [testId])

  useEffect(() => onCountChange(granted.size), [granted, onCountChange])

  const visible = useMemo(() => {
    const n = norm(query.trim())
    return (users ?? []).filter((u) => !n || norm(`${u.display_name ?? ''} ${u.email}`).includes(n))
  }, [users, query])

  async function toggle(u: Profile) {
    setBusy(u.id)
    setError(null)
    const has = granted.has(u.id)
    const { error } = has
      ? await supabase.from('test_access').delete().eq('test_id', testId).eq('user_id', u.id)
      : await supabase.from('test_access').insert({ test_id: testId, user_id: u.id })
    setBusy(null)
    if (error) return setError(errMsg(error))
    setGranted((g) => {
      const n = new Set(g)
      if (has) n.delete(u.id)
      else n.add(u.id)
      return n
    })
  }

  async function bulk(grant: boolean) {
    const targets = visible.filter((u) => !u.is_admin && granted.has(u.id) !== grant)
    if (!targets.length) return
    setBusy('bulk')
    setError(null)
    const { error } = grant
      ? await supabase.from('test_access').insert(targets.map((u) => ({ test_id: testId, user_id: u.id })))
      : await supabase.from('test_access').delete().eq('test_id', testId).in('user_id', targets.map((u) => u.id))
    setBusy(null)
    if (error) return setError(errMsg(error))
    setGranted((g) => {
      const n = new Set(g)
      targets.forEach((u) => (grant ? n.add(u.id) : n.delete(u.id)))
      return n
    })
  }

  if (!users) return <Spinner />

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <SearchInput value={query} onChange={setQuery} placeholder="Hledat uživatele podle jména nebo e-mailu…" />
        <button className="btn" disabled={busy !== null} onClick={() => bulk(true)}>Povolit {query ? 'vyfiltrovaným' : 'všem'}</button>
        <button className="btn" disabled={busy !== null} onClick={() => bulk(false)}>Odebrat {query ? 'vyfiltrovaným' : 'všem'}</button>
      </div>
      <p className="small muted">Bez přístupu uživatel test nevidí ani ho nemůže spustit. Admini mají přístup ke všem testům automaticky.</p>
      <ErrorBox error={error} />
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Uživatel</th><th>E-mail</th><th>Registrace</th><th style={{ textAlign: 'right' }}>Přístup</th></tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const on = u.is_admin || granted.has(u.id)
                return (
                  <tr key={u.id}>
                    <td><b>{u.display_name || '—'}</b> {u.is_admin && <span className="badge accent">admin</span>}</td>
                    <td className="muted">{u.email}</td>
                    <td className="muted">{fmtDate(u.created_at)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {u.is_admin ? (
                        <span className="small muted">vždy</span>
                      ) : (
                        <button className={`chip-toggle${on ? ' on' : ''}`} disabled={busy !== null} onClick={() => toggle(u)}>
                          {busy === u.id ? '…' : on ? '✓ Má přístup' : 'Povolit'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 24 }}>Nikdo nenalezen.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
