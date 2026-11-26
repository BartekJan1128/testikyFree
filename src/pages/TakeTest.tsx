import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { errMsg, shuffle } from '../lib/format'
import { ErrorBox, Modal, Spinner } from '../components/ui'

type TakeAnswer = { id: number; text: string }
type TakeQuestion = { id: number; text: string; multiple: boolean; answers: TakeAnswer[] }
type TakeTestData = {
  id: number
  title: string
  description: string
  shuffle_questions: boolean
  shuffle_answers: boolean
  questions: TakeQuestion[]
}
type Progress = { order: number[]; answerOrder: Record<number, number[]>; selected: Record<number, number[]>; startedAt: string; idx: number }

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function loadProgress(key: string): Progress | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Progress) : null
  } catch {
    return null
  }
}
function saveProgress(key: string, p: Progress | null) {
  try {
    if (p) localStorage.setItem(key, JSON.stringify(p))
    else localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export default function TakeTest() {
  const { id } = useParams()
  const testId = Number(id)
  const { session } = useAuth()
  const navigate = useNavigate()
  const storageKey = `testiky:progress:${session?.user.id}:${testId}`

  const [test, setTest] = useState<TakeTestData | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.rpc('get_test_for_taking', { p_test_id: testId }).then(({ data, error }) => {
      if (error) {
        setError(errMsg(error))
        return
      }
      const t = data as TakeTestData
      setTest(t)
      const ids = new Set(t.questions.map((q) => q.id))
      const saved = loadProgress(storageKey)
      // pokračuj v rozpracovaném testu, pokud se mezitím nezměnily otázky
      if (saved && saved.order.length === ids.size && saved.order.every((x) => ids.has(x))) {
        setProgress(saved)
        return
      }
      const order = (t.shuffle_questions ? shuffle(t.questions) : t.questions).map((q) => q.id)
      const answerOrder: Record<number, number[]> = {}
      t.questions.forEach((q) => {
        answerOrder[q.id] = (t.shuffle_answers ? shuffle(q.answers) : q.answers).map((a) => a.id)
      })
      setProgress({ order, answerOrder, selected: {}, startedAt: new Date().toISOString(), idx: 0 })
    })
  }, [testId, storageKey])

  useEffect(() => {
    if (progress) saveProgress(storageKey, progress)
  }, [progress, storageKey])

  const byId = useMemo(() => new Map(test?.questions.map((q) => [q.id, q]) ?? []), [test])

  if (error)
    return (
      <div className="container narrow stack">
        <ErrorBox error={error} />
        <Link to="/" className="btn" style={{ alignSelf: 'flex-start' }}>Zpět na testy</Link>
      </div>
    )
  if (!test || !progress) return <Spinner label="Načítám test…" />

  const total = progress.order.length
  const q = byId.get(progress.order[progress.idx])!
  const answerMap = new Map(q.answers.map((a) => [a.id, a]))
  const answers = (progress.answerOrder[q.id] ?? q.answers.map((a) => a.id)).map((aid) => answerMap.get(aid)).filter(Boolean) as TakeAnswer[]
  const selected = progress.selected[q.id] ?? []
  const answeredCount = progress.order.filter((qid) => (progress.selected[qid] ?? []).length > 0).length
  const unanswered = total - answeredCount

  const go = (idx: number) => setProgress((p) => (p ? { ...p, idx: Math.max(0, Math.min(total - 1, idx)) } : p))

  function toggle(aid: number) {
    setProgress((p) => {
      if (!p) return p
      const cur = p.selected[q.id] ?? []
      const next = q.multiple ? (cur.includes(aid) ? cur.filter((x) => x !== aid) : [...cur, aid]) : cur.includes(aid) ? [] : [aid]
      return { ...p, selected: { ...p.selected, [q.id]: next } }
    })
  }

  async function submit() {
    if (!progress) return
    setSubmitting(true)
    const { data, error } = await supabase.rpc('submit_attempt', {
      p_test_id: testId,
      p_answers: progress.selected,
      p_started_at: progress.startedAt,
    })
    if (error) {
      setSubmitting(false)
      setConfirmOpen(false)
      setError(errMsg(error))
      return
    }
    saveProgress(storageKey, null)
    navigate(`/attempt/${data}`, { replace: true })
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="crumbs"><Link to="/">Testy</Link> / {test.title}</div>
          <h1>{test.title}</h1>
        </div>
        <button className="btn primary" onClick={() => setConfirmOpen(true)}>Odevzdat test</button>
      </div>

      <div className="take-layout">
        <div className="card stack" style={{ gap: 18 }}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="row small muted">
              <span>Otázka <b style={{ color: 'var(--text)' }}>{progress.idx + 1}</b> z {total}</span>
              <span className="spacer" />
              <span className="qid" title="ID otázky">#{q.id}</span>
            </div>
            <div className="progress"><div style={{ transform: `scaleX(${(progress.idx + 1) / total})` }} /></div>
          </div>

          <div className="stack" style={{ gap: 6 }}>
            <p className="q-text">{q.text}</p>
            <p className="q-hint">{q.multiple ? 'Vyber všechny správné odpovědi.' : 'Vyber jednu odpověď.'}</p>
          </div>

          <div className="options" role={q.multiple ? 'group' : 'radiogroup'}>
            {answers.map((a, i) => {
              const on = selected.includes(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  role={q.multiple ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  className={`option${on ? ' selected' : ''}`}
                  onClick={() => toggle(a.id)}
                >
                  <span className={`mark ${q.multiple ? 'box' : 'radio'}`}>{on ? '✓' : ''}</span>
                  <span className="letter">{LETTERS[i]}</span>
                  <span className="otext">{a.text}</span>
                </button>
              )
            })}
          </div>

          <div className="row">
            <button className="btn" onClick={() => go(progress.idx - 1)} disabled={progress.idx === 0}>← Předchozí</button>
            <span className="spacer" />
            {progress.idx < total - 1 ? (
              <button className="btn primary" onClick={() => go(progress.idx + 1)}>Další →</button>
            ) : (
              <button className="btn primary" onClick={() => setConfirmOpen(true)}>Odevzdat test</button>
            )}
          </div>
        </div>

        <aside className="card take-side stack">
          <div className="row">
            <h3>Přehled</h3>
            <span className="spacer" />
            <span className="small muted">{answeredCount}/{total}</span>
          </div>
          <div className="q-grid">
            {progress.order.map((qid, i) => (
              <button
                key={qid}
                className={`q-dot${(progress.selected[qid] ?? []).length ? ' answered' : ''}${i === progress.idx ? ' current' : ''}`}
                onClick={() => go(i)}
                title={`Otázka ${i + 1} (#${qid})`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="small muted">Rozpracovaný test se ukládá v prohlížeči, klidně ho zavři a vrať se později.</p>
        </aside>
      </div>

      {confirmOpen && (
        <Modal onClose={() => !submitting && setConfirmOpen(false)}>
          <div className="stack" style={{ gap: 14 }}>
            <h2>Odevzdat test?</h2>
            {unanswered > 0 ? (
              <div className="alert warn">
                Nezodpověděl(a) jsi <b>{unanswered}</b> {unanswered === 1 ? 'otázku' : unanswered < 5 ? 'otázky' : 'otázek'}. Ty se počítají jako špatně.
              </div>
            ) : (
              <p className="muted">Máš zodpovězené všechny otázky. Po odevzdání už odpovědi nejde změnit.</p>
            )}
            <div className="row">
              <span className="spacer" />
              <button className="btn" onClick={() => setConfirmOpen(false)} disabled={submitting}>Zpět k testu</button>
              <button className="btn primary" onClick={submit} disabled={submitting}>{submitting ? 'Odevzdávám…' : 'Odevzdat'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
