import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { Attempt, AttemptAnswer } from '../lib/types'
import { errMsg, fmtDate, fmtDuration, scoreTone } from '../lib/format'
import { isIdQuery, makeQuestionMatcher } from '../lib/search'
import { Empty, ErrorBox, SearchInput, Spinner } from '../components/ui'

type Filter = 'all' | 'wrong' | 'right'

export default function AttemptReview() {
  const { id } = useParams()
  const { session, profile } = useAuth()
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [items, setItems] = useState<AttemptAnswer[]>([])
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    ;(async () => {
      const [a, b] = await Promise.all([
        supabase.from('attempts').select('*, profiles(display_name, email)').eq('id', Number(id)).maybeSingle(),
        supabase.from('attempt_answers').select('*').eq('attempt_id', Number(id)).order('position'),
      ])
      if (a.error || b.error) return setError(errMsg(a.error || b.error))
      if (!a.data) return setError('Pokus nenalezen, nebo k němu nemáš přístup.')
      setAttempt(a.data as Attempt)
      setItems((b.data as AttemptAnswer[]) ?? [])
    })()
  }, [id])

  const matcher = useMemo(() => makeQuestionMatcher(query), [query])
  const visible = items.filter(
    (it) =>
      (filter === 'all' || (filter === 'wrong' ? !it.is_correct : it.is_correct)) &&
      matcher(it.question_id, it.question_text, ...it.answers.map((a) => a.text)),
  )

  if (error) return <div className="container narrow"><ErrorBox error={error} /></div>
  if (!attempt) return <Spinner />

  const pct = Number(attempt.score_pct)
  const tone = scoreTone(pct)
  const isOwn = attempt.user_id === session?.user.id
  const wrong = items.filter((i) => !i.is_correct).length
  const duration = fmtDuration(attempt.started_at, attempt.finished_at)

  return (
    <div className="container narrow">
      <div className="crumbs">
        {isOwn ? <Link to="/history">Historie</Link> : <Link to={`/admin/tests/${attempt.test_id}`}>Administrace testu</Link>} / Výsledek
      </div>

      <div className="card result-hero" style={{ marginBottom: 20 }}>
        <div className={`ring ${tone}`} style={{ ['--p' as string]: pct }}>
          <div>{Math.round(pct)} %</div>
        </div>
        <div className="stack" style={{ gap: 6, flex: 1, minWidth: 200 }}>
          <h1>{attempt.test_title}</h1>
          <p className="muted">
            Správně <b style={{ color: 'var(--text)' }}>{attempt.correct_count}</b> z {attempt.total_count}
            {duration && <> · čas {duration}</>} · {fmtDate(attempt.finished_at)}
          </p>
          {!isOwn && <p className="small">Uživatel: <b>{attempt.profiles?.display_name}</b> <span className="muted">({attempt.profiles?.email})</span></p>}
          <div className="row" style={{ marginTop: 6 }}>
            {attempt.test_id && isOwn && <Link className="btn primary sm" to={`/test/${attempt.test_id}`}>Zkusit znovu</Link>}
            {attempt.test_id && <Link className="btn sm" to={`/leaderboard/${attempt.test_id}`}>Žebříček</Link>}
            {profile?.is_admin && attempt.test_id && <Link className="btn ghost sm" to={`/admin/tests/${attempt.test_id}`}>Upravit test</Link>}
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <SearchInput value={query} onChange={setQuery} placeholder="Hledat podle ID (#123, 12 15) nebo textu…" />
        <div className="seg">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Vše ({items.length})</button>
          <button className={filter === 'wrong' ? 'active' : ''} onClick={() => setFilter('wrong')}>Chybné ({wrong})</button>
          <button className={filter === 'right' ? 'active' : ''} onClick={() => setFilter('right')}>Správné ({items.length - wrong})</button>
        </div>
      </div>

      <div className="q-grid" style={{ marginBottom: 18 }}>
        {items.map((it) => (
          <button
            key={it.id}
            className={`q-dot ${it.is_correct ? 'good' : 'bad'}`}
            title={`#${it.question_id}`}
            onClick={() => document.getElementById(`r-${it.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          >
            {it.position}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <Empty title={isIdQuery(query) ? 'Otázka s tímto ID v testu není' : 'Nic nenalezeno'}>Zkus upravit hledání nebo filtr.</Empty>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {visible.map((it) => (
            <ReviewItem key={it.id} item={it} />
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewItem({ item }: { item: AttemptAnswer }) {
  const sel = new Set(item.selected_answer_ids.map(Number))
  return (
    <div id={`r-${item.id}`} className={`card review-item ${item.is_correct ? 'ok' : 'ko'}`}>
      <div className="row small" style={{ marginBottom: 8 }}>
        <span className="muted">Otázka {item.position}</span>
        <span className="qid">#{item.question_id}</span>
        <span className="spacer" />
        {item.is_correct ? <span className="badge good">✓ Správně</span> : <span className="badge bad">✗ Špatně</span>}
        {sel.size === 0 && <span className="badge mid">Nezodpovězeno</span>}
      </div>
      <p className="q-text" style={{ fontSize: '1.05rem' }}>{item.question_text}</p>
      <div className="r-answers">
        {item.answers.map((a) => {
          const picked = sel.has(a.id)
          const cls = picked && a.is_correct ? 'hit' : picked ? 'wrong' : a.is_correct ? 'missed' : ''
          const icon = picked && a.is_correct ? '✓' : picked ? '✗' : a.is_correct ? '✓' : ''
          const tag = picked && a.is_correct ? 'tvoje · správně' : picked ? 'tvoje odpověď' : a.is_correct ? 'správná odpověď' : ''
          return (
            <div key={a.id} className={`r-ans ${cls}`}>
              <span className="icon">{icon}</span>
              <span style={{ whiteSpace: 'pre-wrap' }}>{a.text}</span>
              {tag && <span className="tag">{tag}</span>}
            </div>
          )
        })}
      </div>
      {item.explanation && <div className="explain">💡 {item.explanation}</div>}
    </div>
  )
}
