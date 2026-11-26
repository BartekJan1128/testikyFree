import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errMsg, fmtDate } from '../lib/format'
import { Empty, ErrorBox, Score, Spinner } from '../components/ui'

type Row = {
  user_id: string
  display_name: string | null
  best_pct: number
  best_correct: number
  total_count: number
  attempts_count: number
  last_at: string
}

const MEDALS = ['🥇', '🥈', '🥉']

export default function Leaderboard() {
  const { id } = useParams()
  const { session } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testId = Number(id)
    supabase.from('tests').select('title').eq('id', testId).maybeSingle().then(({ data }) => setTitle(data?.title ?? ''))
    supabase.rpc('get_leaderboard', { p_test_id: testId }).then(({ data, error }) => {
      if (error) setError(errMsg(error))
      const list = ((data as Row[]) ?? []).sort(
        (a, b) => Number(b.best_pct) - Number(a.best_pct) || new Date(a.last_at).getTime() - new Date(b.last_at).getTime(),
      )
      setRows(list)
    })
  }, [id])

  if (!rows) return <Spinner />

  return (
    <div className="container narrow">
      <div className="crumbs"><Link to="/">Testy</Link> / Žebříček</div>
      <div className="page-head">
        <div>
          <h1>Žebříček{title ? `: ${title}` : ''}</h1>
          <p className="sub">Počítá se nejlepší pokus každého hráče.</p>
        </div>
        <Link to={`/test/${id}`} className="btn primary">Spustit test</Link>
      </div>
      <ErrorBox error={error} />
      {rows.length === 0 ? (
        <Empty title="Zatím nikdo nesoutěžil">Buď první!</Empty>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th style={{ width: 56 }}>#</th><th>Hráč</th><th>Nejlepší</th><th>Pokusů</th><th>Naposledy</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.user_id} className={r.user_id === session?.user.id ? 'me' : ''}>
                    <td style={{ fontSize: i < 3 ? '1.2rem' : undefined }}>{MEDALS[i] ?? i + 1}</td>
                    <td><b>{r.display_name || 'Anonym'}</b>{r.user_id === session?.user.id && <span className="badge accent" style={{ marginLeft: 8 }}>ty</span>}</td>
                    <td><Score pct={r.best_pct} /> <span className="small muted">({r.best_correct}/{r.total_count})</span></td>
                    <td>{r.attempts_count}</td>
                    <td className="muted">{fmtDate(r.last_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
