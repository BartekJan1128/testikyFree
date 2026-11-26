import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Attempt } from '../../lib/types'
import { errMsg, fmtDate, fmtDuration } from '../../lib/format'
import { Empty, ErrorBox, Score, Spinner } from '../../components/ui'

export default function ResultsPanel({ testId }: { testId: number }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Attempt[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('attempts')
      .select('*, profiles(display_name, email)')
      .eq('test_id', testId)
      .order('finished_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errMsg(error))
        setRows((data as Attempt[]) ?? [])
      })
  }, [testId])

  async function del(a: Attempt) {
    if (!confirm(`Smazat pokus uživatele ${a.profiles?.display_name} (${Math.round(a.score_pct)} %)?`)) return
    const { error } = await supabase.from('attempts').delete().eq('id', a.id)
    if (error) return setError(errMsg(error))
    setRows((r) => r && r.filter((x) => x.id !== a.id))
  }

  if (!rows) return <Spinner />
  if (rows.length === 0) return <Empty title="Test zatím nikdo nevyplnil" />

  const avg = rows.reduce((s, r) => s + Number(r.score_pct), 0) / rows.length

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="stats">
        <span><b>{rows.length}</b> pokusů</span>
        <span><b>{new Set(rows.map((r) => r.user_id)).size}</b> uživatelů</span>
        <span>Průměr: <Score pct={avg} /></span>
        <Link to={`/leaderboard/${testId}`}>Žebříček →</Link>
      </div>
      <ErrorBox error={error} />
      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr><th>Uživatel</th><th>Výsledek</th><th>Správně</th><th>Čas</th><th>Datum</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/attempt/${r.id}`)}>
                  <td><b>{r.profiles?.display_name}</b><div className="small muted">{r.profiles?.email}</div></td>
                  <td><Score pct={r.score_pct} /></td>
                  <td>{r.correct_count}/{r.total_count}</td>
                  <td className="muted">{fmtDuration(r.started_at, r.finished_at) ?? '–'}</td>
                  <td className="muted">{fmtDate(r.finished_at)}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                    <Link to={`/attempt/${r.id}`} className="btn sm">Detail</Link>{' '}
                    <button className="btn sm danger" onClick={() => del(r)}>Smazat</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
