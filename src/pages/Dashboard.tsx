import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { MyTest } from '../lib/types'
import { errMsg, fmtDate } from '../lib/format'
import { Empty, ErrorBox, Score, Spinner } from '../components/ui'

export default function Dashboard() {
  const { profile } = useAuth()
  const [tests, setTests] = useState<MyTest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('list_my_tests').then(({ data, error }) => {
      if (error) setError(errMsg(error))
      setTests((data as MyTest[]) ?? [])
    })
  }, [])

  if (!tests) return <Spinner />

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Ahoj{profile?.display_name ? `, ${profile.display_name}` : ''} 👋</h1>
          <p className="sub">Vyber si test. Výsledek a správné odpovědi uvidíš po odevzdání.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {tests.length === 0 ? (
        <Empty title="Zatím tu nemáš žádný test">
          {profile?.is_admin ? (
            <>Vytvoř první test v <Link to="/admin">administraci</Link>.</>
          ) : (
            <>Přístup k testům přiděluje admin. Napiš mu, ať ti nějaký zpřístupní.</>
          )}
        </Empty>
      ) : (
        <div className="grid">
          {tests.map((t) => (
            <div key={t.id} className="card test-card">
              <h2>{t.title}</h2>
              <p className="desc">{t.description || <span className="muted">Bez popisu</span>}</p>
              <div className="stats">
                <span><b>{t.question_count}</b> otázek</span>
                <span>Nejlepší: <Score pct={t.best_pct} /></span>
                <span><b>{t.attempts_count}</b>× vyplněno</span>
              </div>
              {t.last_at && <span className="small muted">Naposledy {fmtDate(t.last_at)}</span>}
              <div className="row">
                {t.question_count > 0 ? (
                  <Link to={`/test/${t.id}`} className="btn primary">Spustit test</Link>
                ) : (
                  <button className="btn" disabled>Zatím bez otázek</button>
                )}
                <Link to={`/leaderboard/${t.id}`} className="btn ghost">Žebříček</Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
