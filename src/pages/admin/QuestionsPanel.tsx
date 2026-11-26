import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { supabase } from '../../lib/supabase'
import type { Answer, Question } from '../../lib/types'
import { errMsg } from '../../lib/format'
import { isIdQuery, makeQuestionMatcher } from '../../lib/search'
import { Empty, ErrorBox, SearchInput } from '../../components/ui'

type Props = { testId: number; questions: Question[]; setQuestions: Dispatch<SetStateAction<Question[] | null>> }
type Filter = 'all' | 'nocorrect' | 'multi'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export default function QuestionsPanel({ testId, questions, setQuestions }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)

  const matcher = useMemo(() => makeQuestionMatcher(query), [query])
  const noCorrect = questions.filter((q) => !q.answers.some((a) => a.is_correct)).length
  const multi = questions.filter((q) => q.answers.filter((a) => a.is_correct).length > 1).length

  const visible = questions
    .map((q, i) => ({ q, num: i + 1 }))
    .filter(({ q }) => {
      if (filter === 'nocorrect' && q.answers.some((a) => a.is_correct)) return false
      if (filter === 'multi' && q.answers.filter((a) => a.is_correct).length < 2) return false
      return matcher(q.id, q.text, q.explanation, ...q.answers.map((a) => a.text))
    })

  const replace = (q: Question) => setQuestions((list) => list && list.map((x) => (x.id === q.id ? q : x)))
  const remove = (id: number) => setQuestions((list) => list && list.filter((x) => x.id !== id))

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row">
        <SearchInput value={query} onChange={setQuery} placeholder="Hledat podle ID (#123, 12 15) nebo textu…" />
        <div className="seg">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Vše</button>
          <button className={filter === 'multi' ? 'active' : ''} onClick={() => setFilter('multi')}>Více správných ({multi})</button>
          <button className={filter === 'nocorrect' ? 'active' : ''} onClick={() => setFilter('nocorrect')}>Bez správné ({noCorrect})</button>
        </div>
        <button className="btn primary" onClick={() => setAdding(true)} disabled={adding}>+ Otázka</button>
      </div>

      {noCorrect > 0 && filter !== 'nocorrect' && (
        <div className="alert warn">
          {noCorrect} {noCorrect === 1 ? 'otázka nemá' : 'otázek nemá'} označenou žádnou správnou odpověď. Taková otázka se vždy počítá jako špatně.{' '}
          <button className="btn sm ghost" onClick={() => setFilter('nocorrect')}>Zobrazit</button>
        </div>
      )}

      <p className="small muted">
        Kliknutím na <b>✓</b> u odpovědi rovnou přepneš její správnost. Text otázky a odpovědí změníš přes <b>Upravit</b>.
      </p>

      {adding && (
        <QuestionCard
          testId={testId}
          num={questions.length + 1}
          question={null}
          nextPosition={Math.max(0, ...questions.map((q) => q.position)) + 1}
          onSaved={(q) => {
            setQuestions((list) => [...(list ?? []), q])
            setAdding(false)
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {questions.length === 0 && !adding ? (
        <Empty title="Test zatím nemá žádné otázky">Přidej je ručně tlačítkem „+ Otázka“ nebo hromadně v záložce Import.</Empty>
      ) : visible.length === 0 ? (
        <Empty title={isIdQuery(query) ? 'Otázka s tímto ID v tomto testu není' : 'Nic nenalezeno'} />
      ) : (
        visible.map(({ q, num }) => (
          <QuestionCard
            key={q.id}
            testId={testId}
            num={num}
            question={q}
            nextPosition={q.position}
            highlight={isIdQuery(query)}
            onSaved={replace}
            onDeleted={() => remove(q.id)}
          />
        ))
      )}
    </div>
  )
}

// ------------------------------------------------------------------------------

type Draft = { id?: number; text: string; is_correct: boolean; key: string }
let keySeq = 0
const newKey = () => `k${++keySeq}`

function QuestionCard({
  testId,
  num,
  question,
  nextPosition,
  highlight,
  onSaved,
  onDeleted,
  onCancel,
}: {
  testId: number
  num: number
  question: Question | null
  nextPosition: number
  highlight?: boolean
  onSaved: (q: Question) => void
  onDeleted?: () => void
  onCancel?: () => void
}) {
  const isNew = !question
  const [editing, setEditing] = useState(isNew)
  const [text, setText] = useState(question?.text ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  // nová otázka – předvyplň 4 prázdné odpovědi
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    question ? [] : [0, 1, 2, 3].map(() => ({ text: '', is_correct: false, key: newKey() })),
  )
  const [busy, setBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setText(question?.text ?? '')
    setExplanation(question?.explanation ?? '')
    setDrafts(
      question?.answers.map((a) => ({ id: a.id, text: a.text, is_correct: a.is_correct, key: newKey() })) ?? [],
    )
    setError(null)
    setEditing(true)
  }

  async function quickToggle(a: Answer) {
    if (!question) return
    setTogglingId(a.id)
    setError(null)
    const { error } = await supabase.from('answers').update({ is_correct: !a.is_correct }).eq('id', a.id)
    setTogglingId(null)
    if (error) return setError(errMsg(error))
    onSaved({ ...question, answers: question.answers.map((x) => (x.id === a.id ? { ...x, is_correct: !a.is_correct } : x)) })
  }

  async function save() {
    const rows = drafts.filter((d) => d.text.trim())
    if (!text.trim()) return setError('Otázka musí mít text.')
    if (rows.length < 1) return setError('Přidej alespoň jednu odpověď.')
    setBusy(true)
    setError(null)
    try {
      let qid = question?.id
      if (qid) {
        const { error } = await supabase.from('questions').update({ text: text.trim(), explanation: explanation.trim() }).eq('id', qid)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('questions')
          .insert({ test_id: testId, text: text.trim(), explanation: explanation.trim(), position: nextPosition })
          .select('id')
          .single()
        if (error) throw error
        qid = data.id as number
      }

      const keptIds = new Set(rows.filter((r) => r.id).map((r) => r.id))
      const removed = (question?.answers ?? []).filter((a) => !keptIds.has(a.id)).map((a) => a.id)
      if (removed.length) {
        const { error } = await supabase.from('answers').delete().in('id', removed)
        if (error) throw error
      }
      const existing = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => r.id)
        .map(({ r, i }) => ({ id: r.id, question_id: qid, text: r.text.trim(), is_correct: r.is_correct, position: i + 1 }))
      if (existing.length) {
        const { error } = await supabase.from('answers').upsert(existing)
        if (error) throw error
      }
      const fresh = rows
        .map((r, i) => ({ r, i }))
        .filter(({ r }) => !r.id)
        .map(({ r, i }) => ({ question_id: qid, text: r.text.trim(), is_correct: r.is_correct, position: i + 1 }))
      if (fresh.length) {
        const { error } = await supabase.from('answers').insert(fresh)
        if (error) throw error
      }

      const { data, error } = await supabase.from('questions').select('*, answers(*)').eq('id', qid).single()
      if (error) throw error
      const q = data as Question
      q.answers.sort((a, b) => a.position - b.position || a.id - b.id)
      onSaved(q)
      setEditing(false)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!question) return
    if (!confirm(`Opravdu smazat otázku #${question.id}?\n\n„${question.text.slice(0, 120)}“`)) return
    setBusy(true)
    const { error } = await supabase.from('questions').delete().eq('id', question.id)
    setBusy(false)
    if (error) return setError(errMsg(error))
    onDeleted?.()
  }

  const updateDraft = (key: string, patch: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  // ------------------------------------------------------------------ edit mode
  if (editing) {
    return (
      <div className="card qcard editing stack" style={{ gap: 14 }}>
        <div className="qcard-head">
          <span className="num">{isNew ? 'Nová otázka' : `Otázka ${num}`}</span>
          {question && <span className="qid">#{question.id}</span>}
        </div>
        <label className="field">
          Text otázky
          <textarea className="input" autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <div className="stack" style={{ gap: 8 }}>
          <div className="row small">
            <b>Odpovědi</b>
            <span className="muted">· zaškrtni všechny správné ({drafts.filter((d) => d.is_correct && d.text.trim()).length} označeno)</span>
          </div>
          {drafts.map((d, i) => (
            <div key={d.key} className={`a-row${d.is_correct ? ' correct' : ''}`}>
              <button
                type="button"
                className={`toggle-correct${d.is_correct ? ' on' : ''}`}
                title={d.is_correct ? 'Správná – kliknutím označit jako špatnou' : 'Špatná – kliknutím označit jako správnou'}
                onClick={() => updateDraft(d.key, { is_correct: !d.is_correct })}
              >
                {d.is_correct ? '✓' : LETTERS[i]}
              </button>
              <input
                className="input"
                value={d.text}
                placeholder={`Odpověď ${LETTERS[i]}`}
                onChange={(e) => updateDraft(d.key, { text: e.target.value })}
              />
              <button type="button" className="btn ghost sm" title="Odebrat odpověď" onClick={() => setDrafts((x) => x.filter((y) => y.key !== d.key))}>✕</button>
            </div>
          ))}
          <button
            type="button"
            className="btn sm"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setDrafts((x) => [...x, { text: '', is_correct: false, key: newKey() }])}
          >
            + Přidat odpověď
          </button>
        </div>

        <label className="field">
          <span>Vysvětlení <span className="muted small">(nepovinné, zobrazí se po odevzdání)</span></span>
          <textarea className="input" rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
        </label>

        <ErrorBox error={error} />
        <div className="row">
          <span className="spacer" />
          <button className="btn" disabled={busy} onClick={() => (isNew ? onCancel?.() : setEditing(false))}>Zrušit</button>
          <button className="btn primary" disabled={busy} onClick={save}>{busy ? 'Ukládám…' : 'Uložit otázku'}</button>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ view mode
  const q = question!
  const correctCount = q.answers.filter((a) => a.is_correct).length
  return (
    <div className={`card qcard${highlight ? ' flash' : ''}`}>
      <div className="qcard-head">
        <span className="num">Otázka {num}</span>
        <span className="qid">#{q.id}</span>
        {correctCount === 0 && <span className="badge mid">Bez správné odpovědi</span>}
        {correctCount > 1 && <span className="badge accent">{correctCount} správné</span>}
        <span className="spacer" />
        <button className="btn sm" onClick={startEdit} disabled={busy}>Upravit</button>
        <button className="btn sm danger" onClick={del} disabled={busy}>Smazat</button>
      </div>
      <p className="qtext">{q.text}</p>
      <div className="a-list">
        {q.answers.map((a, i) => (
          <div key={a.id} className={`a-row${a.is_correct ? ' correct' : ''}`}>
            <button
              className={`toggle-correct${a.is_correct ? ' on' : ''}`}
              disabled={togglingId === a.id}
              title={a.is_correct ? 'Správná – kliknutím označit jako špatnou' : 'Kliknutím označit jako správnou'}
              onClick={() => quickToggle(a)}
            >
              {a.is_correct ? '✓' : LETTERS[i]}
            </button>
            <span className="atext">{a.text}</span>
            <span className="qid" title="ID odpovědi">{a.id}</span>
          </div>
        ))}
        {q.answers.length === 0 && <span className="small muted">Žádné odpovědi.</span>}
      </div>
      {q.explanation && <div className="explain">💡 {q.explanation}</div>}
      {error && <div style={{ marginTop: 10 }}><ErrorBox error={error} /></div>}
    </div>
  )
}
