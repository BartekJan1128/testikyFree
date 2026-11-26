import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Attempt } from '../lib/types'
import { errMsg, fmtDate, fmtDuration } from '../lib/format'
import { Empty, ErrorBox, Score, Spinner } from '../components/ui'

export default function History() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Attempt[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('attempts')
      .select('*')
      .eq('user_id', session!.user.id)
      .order('finished_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setError(errMsg(error))
        setRows((data as Attempt[]) ?? [])
      })
  }, [session])

  if (!rows) return <Spinner />

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Moje historie</h1>
          <p className="sub">Otevři pokus a projdi si, kde jsi chyboval(a). Otázky lze hledat podle ID.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {rows.length === 0 ? (
        <Empty title="Zatím žádné pokusy"><Link to="/">Spusť svůj první test →</Link></Empty>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Test</th><th>Výsledek</th><th>Správně</th><th>Čas</th><th>Datum</th><th /></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/attempt/${r.id}`)}>
                    <td><b>{r.test_title}</b></td>
                    <td><Score pct={r.score_pct} /></td>
                    <td>{r.correct_count}/{r.total_count}</td>
                    <td className="muted">{fmtDuration(r.started_at, r.finished_at) ?? '–'}</td>
                    <td className="muted">{fmtDate(r.finished_at)}</td>
                    <td style={{ textAlign: 'right' }}><Link to={`/attempt/${r.id}`} className="btn sm" onClick={(e) => e.stopPropagation()}>Detail</Link></td>
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
