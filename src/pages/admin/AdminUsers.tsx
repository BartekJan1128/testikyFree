import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Profile } from '../../lib/types'
import { errMsg, fmtDate } from '../../lib/format'
import { Empty, ErrorBox, SearchInput, Spinner } from '../../components/ui'

type TestLite = { id: number; title: string }
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function AdminUsers() {
  const { session } = useAuth()
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [tests, setTests] = useState<TestLite[]>([])
  const [access, setAccess] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('tests').select('id, title').order('created_at', { ascending: false }),
      supabase.from('test_access').select('test_id, user_id'),
    ]).then(([p, t, a]) => {
      const err = p.error || t.error || a.error
      if (err) setError(errMsg(err))
      setUsers((p.data as Profile[]) ?? [])
      setTests((t.data as TestLite[]) ?? [])
      setAccess(new Set((a.data ?? []).map((r: { test_id: number; user_id: string }) => `${r.test_id}:${r.user_id}`)))
    })
  }, [])

  const visible = useMemo(() => {
    const n = norm(query.trim())
    return (users ?? []).filter((u) => !n || norm(`${u.display_name ?? ''} ${u.email}`).includes(n))
  }, [users, query])

  async function toggleAccess(u: Profile, t: TestLite) {
    const key = `${t.id}:${u.id}`
    const has = access.has(key)
    setBusy(key)
    setError(null)
    const { error } = has
      ? await supabase.from('test_access').delete().eq('test_id', t.id).eq('user_id', u.id)
      : await supabase.from('test_access').insert({ test_id: t.id, user_id: u.id })
    setBusy(null)
    if (error) return setError(errMsg(error))
    setAccess((s) => {
      const n = new Set(s)
      if (has) n.delete(key)
      else n.add(key)
      return n
    })
  }

  async function toggleAdmin(u: Profile) {
    const next = !u.is_admin
    if (!confirm(next ? `Udělat z ${u.display_name || u.email} admina? Bude moct upravovat testy a přístupy.` : `Odebrat ${u.display_name || u.email} práva admina?`)) return
    setBusy(`admin:${u.id}`)
    const { error } = await supabase.rpc('set_user_admin', { p_user_id: u.id, p_is_admin: next })
    setBusy(null)
    if (error) return setError(errMsg(error))
    setUsers((list) => list && list.map((x) => (x.id === u.id ? { ...x, is_admin: next } : x)))
  }

  if (!users) return <Spinner />

  return (
    <div className="container">
      <div className="crumbs"><Link to="/admin">Administrace</Link> / Uživatelé</div>
      <div className="page-head">
        <div>
          <h1>Uživatelé a přístupy</h1>
          <p className="sub">{users.length} registrovaných. Kliknutím na test u uživatele přepneš přístup.</p>
        </div>
      </div>
      <div className="row" style={{ marginBottom: 14 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Hledat podle jména nebo e-mailu…" />
      </div>
      <ErrorBox error={error} />
      {visible.length === 0 ? (
        <Empty title="Nikdo nenalezen" />
      ) : (
        <div className="stack">
          {visible.map((u) => (
            <div key={u.id} className="card tight stack" style={{ gap: 10 }}>
              <div className="row">
                <div style={{ minWidth: 0 }}>
                  <b>{u.display_name || '—'}</b> {u.is_admin && <span className="badge accent">admin</span>}
                  <div className="small muted">{u.email} · registrace {fmtDate(u.created_at)}</div>
                </div>
                <span className="spacer" />
                {u.id !== session?.user.id && (
                  <button className="btn sm ghost" disabled={busy !== null} onClick={() => toggleAdmin(u)}>
                    {u.is_admin ? 'Odebrat admina' : 'Udělat adminem'}
                  </button>
                )}
              </div>
              {u.is_admin ? (
                <span className="small muted">Admin má přístup ke všem testům.</span>
              ) : tests.length === 0 ? (
                <span className="small muted">Zatím neexistuje žádný test.</span>
              ) : (
                <div className="row" style={{ gap: 6 }}>
                  {tests.map((t) => {
                    const key = `${t.id}:${u.id}`
                    const on = access.has(key)
                    return (
                      <button key={t.id} className={`chip-toggle${on ? ' on' : ''}`} disabled={busy === key} onClick={() => toggleAccess(u, t)}>
                        {on ? '✓ ' : ''}{t.title}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
