import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { errMsg, fmtDate } from '../../lib/format'
import { Empty, ErrorBox, Modal, Spinner } from '../../components/ui'

type Row = {
  id: number
  title: string
  description: string
  is_published: boolean
  created_at: string
  questions: { count: number }[]
  test_access: { count: number }[]
}

export default function AdminTests() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('tests')
      .select('id, title, description, is_published, created_at, questions(count), test_access(count)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errMsg(error))
        setRows((data as Row[]) ?? [])
      })
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.from('tests').insert({ title: title.trim(), description: description.trim() }).select('id').single()
    setBusy(false)
    if (error) return setError(errMsg(error))
    navigate(`/admin/tests/${data.id}?tab=import`)
  }

  if (!rows) return <Spinner />

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Administrace</h1>
          <p className="sub">Vytvářej testy, importuj otázky a přiděluj přístupy.</p>
        </div>
        <div className="row">
          <Link to="/admin/users" className="btn">Uživatelé a přístupy</Link>
          <button className="btn primary" onClick={() => setCreating(true)}>+ Nový test</button>
        </div>
      </div>
      <ErrorBox error={error} />

      {rows.length === 0 ? (
        <Empty title="Zatím žádný test">
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>Vytvořit první test</button>
        </Empty>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Test</th><th>Otázek</th><th>Přístup má</th><th>Stav</th><th>Vytvořen</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/tests/${t.id}`)}>
                    <td>
                      <b>{t.title}</b>
                      {t.description && <div className="small muted" style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>}
                    </td>
                    <td>{t.questions[0]?.count ?? 0}</td>
                    <td>{t.test_access[0]?.count ?? 0} uživ.</td>
                    <td>{t.is_published ? <span className="badge good">Aktivní</span> : <span className="badge">Skrytý</span>}</td>
                    <td className="muted">{fmtDate(t.created_at)}</td>
                    <td style={{ textAlign: 'right' }}><Link className="btn sm" to={`/admin/tests/${t.id}`} onClick={(e) => e.stopPropagation()}>Spravovat</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <Modal onClose={() => setCreating(false)}>
          <form className="stack" style={{ gap: 14 }} onSubmit={create}>
            <h2>Nový test</h2>
            <label className="field">
              Název
              <input className="input" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="např. Biologie – buňka" />
            </label>
            <label className="field">
              Popis <span className="muted small">(nepovinné)</span>
              <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="row">
              <span className="spacer" />
              <button type="button" className="btn" onClick={() => setCreating(false)}>Zrušit</button>
              <button className="btn primary" disabled={busy || !title.trim()}>{busy ? 'Vytvářím…' : 'Vytvořit a importovat otázky'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
