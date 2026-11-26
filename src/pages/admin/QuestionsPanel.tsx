import { useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { Check, FileUp, Lightbulb, ListPlus, Loader2, Pencil, Plus, SearchX, Trash2, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Answer, Question } from '@/lib/types'
import { errMsg } from '@/lib/format'
import { isIdQuery, makeQuestionMatcher } from '@/lib/search'
import { cn } from '@/lib/utils'
import { Confirm, EmptyState, ErrorAlert, QuestionId, SearchField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertAction, AlertDescription } from '@/components/ui/alert'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type Props = {
  testId: number
  questions: Question[]
  setQuestions: Dispatch<SetStateAction<Question[] | null>>
  onImport: () => void
}
type Filter = 'all' | 'nocorrect' | 'multi'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const correctCount = (q: Question) => q.answers.filter((a) => a.is_correct).length

export default function QuestionsPanel({ testId, questions, setQuestions, onImport }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)

  const matcher = useMemo(() => makeQuestionMatcher(query), [query])
  const noCorrect = questions.filter((q) => correctCount(q) === 0).length
  const multi = questions.filter((q) => correctCount(q) > 1).length

  const visible = questions
    .map((q, i) => ({ q, num: i + 1 }))
    .filter(({ q }) => {
      if (filter === 'nocorrect' && correctCount(q) > 0) return false
      if (filter === 'multi' && correctCount(q) < 2) return false
      return matcher(q.id, q.text, q.explanation, ...q.answers.map((a) => a.text))
    })

  const replace = (q: Question) => setQuestions((list) => list && list.map((x) => (x.id === q.id ? q : x)))
  const remove = (id: number) => setQuestions((list) => list && list.filter((x) => x.id !== id))

  if (questions.length === 0 && !adding)
    return (
      <EmptyState
        icon={ListPlus}
        title="Test zatím nemá otázky"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={onImport}><FileUp /> Importovat z JSON / CSV</Button>
            <Button variant="outline" onClick={() => setAdding(true)}><Plus /> Napsat ručně</Button>
          </div>
        }
      >
        Nahraj je hromadně ze souboru, nebo je napiš jednu po druhé.
      </EmptyState>
    )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Najít podle ID (214, nebo víc: 12 15) či textu" />
        <ToggleGroup type="single" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          <ToggleGroupItem value="all" className="px-3">Všechny</ToggleGroupItem>
          <ToggleGroupItem value="multi" className="px-3">Víc správných {multi}</ToggleGroupItem>
          <ToggleGroupItem value="nocorrect" className="px-3">Bez správné {noCorrect}</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => setAdding(true)} disabled={adding}><Plus /> Otázka</Button>
      </div>

      {noCorrect > 0 && filter !== 'nocorrect' && (
        <Alert className="border-warning/40 bg-warning-soft text-warning">
          <TriangleAlert />
          <AlertDescription className="text-warning">
            {noCorrect === 1 ? '1 otázka nemá' : `${noCorrect} otázek nemá`} označenou správnou odpověď a vždy se započítá jako chyba.
          </AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => setFilter('nocorrect')}>Ukázat</Button>
          </AlertAction>
        </Alert>
      )}

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

      {visible.length === 0 ? (
        <EmptyState icon={SearchX} title={isIdQuery(query) ? 'Otázka s tímhle ID v testu není' : 'Nic neodpovídá hledání'} />
      ) : (
        <div className="space-y-3">
          {visible.map(({ q, num }) => (
            <QuestionCard
              key={q.id}
              testId={testId}
              num={num}
              question={q}
              nextPosition={q.position}
              onSaved={replace}
              onDeleted={() => remove(q.id)}
            />
          ))}
        </div>
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
  onSaved,
  onDeleted,
  onCancel,
}: {
  testId: number
  num: number
  question: Question | null
  nextPosition: number
  onSaved: (q: Question) => void
  onDeleted?: () => void
  onCancel?: () => void
}) {
  const isNew = !question
  const [editing, setEditing] = useState(isNew)
  const [text, setText] = useState(question?.text ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    question ? [] : [0, 1, 2, 3].map(() => ({ text: '', is_correct: false, key: newKey() })),
  )
  const [busy, setBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function startEdit() {
    setText(question?.text ?? '')
    setExplanation(question?.explanation ?? '')
    setDrafts(question?.answers.map((a) => ({ id: a.id, text: a.text, is_correct: a.is_correct, key: newKey() })) ?? [])
    setError(null)
    setEditing(true)
  }

  async function quickToggle(a: Answer) {
    if (!question) return
    setTogglingId(a.id)
    const { error } = await supabase.from('answers').update({ is_correct: !a.is_correct }).eq('id', a.id)
    setTogglingId(null)
    if (error) return toast.error(errMsg(error))
    onSaved({ ...question, answers: question.answers.map((x) => (x.id === a.id ? { ...x, is_correct: !a.is_correct } : x)) })
  }

  async function save() {
    const rows = drafts.filter((d) => d.text.trim())
    if (!text.trim()) return setError('Otázka potřebuje text.')
    if (rows.length < 1) return setError('Přidej aspoň jednu odpověď.')
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
      const indexed = rows.map((r, i) => ({ r, position: i + 1 }))
      const existing = indexed
        .filter(({ r }) => r.id)
        .map(({ r, position }) => ({ id: r.id, question_id: qid, text: r.text.trim(), is_correct: r.is_correct, position }))
      if (existing.length) {
        const { error } = await supabase.from('answers').upsert(existing)
        if (error) throw error
      }
      const fresh = indexed
        .filter(({ r }) => !r.id)
        .map(({ r, position }) => ({ question_id: qid, text: r.text.trim(), is_correct: r.is_correct, position }))
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
      toast.success(isNew ? `Otázka přidána (ID ${q.id})` : `Otázka ID ${q.id} uložena`)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!question) return
    const { error } = await supabase.from('questions').delete().eq('id', question.id)
    if (error) return toast.error(errMsg(error))
    toast.success(`Otázka ID ${question.id} smazána`)
    onDeleted?.()
  }

  const updateDraft = (key: string, patch: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  // ------------------------------------------------------------------ úprava
  if (editing) {
    const marked = drafts.filter((d) => d.is_correct && d.text.trim()).length
    return (
      <div className="rounded-xl border border-primary/50 bg-card p-5 ring-3 ring-primary/10 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-semibold">{isNew ? 'Nová otázka' : `Otázka ${num}`}</span>
          {question && <QuestionId id={question.id} />}
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor={`qt-${question?.id ?? 'new'}`}>Znění otázky</Label>
            <Textarea id={`qt-${question?.id ?? 'new'}`} autoFocus rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <Label>Odpovědi</Label>
              <span className="text-xs text-muted-foreground">
                Kliknutím na písmeno označíš správnou. Označeno {marked}.
              </span>
            </div>
            {drafts.map((d, i) => (
              <div
                key={d.key}
                className={cn('flex items-center gap-2 rounded-lg border p-1.5 transition-colors', d.is_correct ? 'border-success/40 bg-success-soft' : 'bg-background')}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => updateDraft(d.key, { is_correct: !d.is_correct })}
                      aria-pressed={d.is_correct}
                      aria-label={d.is_correct ? 'Správná odpověď' : 'Špatná odpověď'}
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-md border text-xs font-semibold transition-colors',
                        d.is_correct ? 'border-success bg-success text-background' : 'text-muted-foreground hover:border-success hover:text-success',
                      )}
                    >
                      {d.is_correct ? <Check className="size-4" strokeWidth={3} /> : LETTERS[i]}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{d.is_correct ? 'Označit jako špatnou' : 'Označit jako správnou'}</TooltipContent>
                </Tooltip>
                <Input
                  value={d.text}
                  placeholder={`Odpověď ${LETTERS[i]}`}
                  onChange={(e) => updateDraft(d.key, { text: e.target.value })}
                  className="h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Odebrat odpověď"
                  onClick={() => setDrafts((x) => x.filter((y) => y.key !== d.key))}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => setDrafts((x) => [...x, { text: '', is_correct: false, key: newKey() }])}>
              <Plus /> Přidat odpověď
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`qe-${question?.id ?? 'new'}`}>
              Vysvětlení <span className="font-normal text-muted-foreground">(nepovinné, ukáže se po odevzdání)</span>
            </Label>
            <Textarea id={`qe-${question?.id ?? 'new'}`} rows={2} value={explanation} onChange={(e) => setExplanation(e.target.value)} />
          </div>

          <ErrorAlert error={error} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={() => (isNew ? onCancel?.() : setEditing(false))}>Zrušit</Button>
            <Button disabled={busy} onClick={save}>
              {busy && <Loader2 className="animate-spin" />} {isNew ? 'Přidat otázku' : 'Uložit změny'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------------ náhled
  const q = question!
  const cc = correctCount(q)
  return (
    <article className="group/q rounded-xl border bg-card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">{num}.</span>
        <QuestionId id={q.id} />
        {cc === 0 && <Badge variant="outline" className="border-warning/50 text-warning">Bez správné odpovědi</Badge>}
        {cc > 1 && <Badge variant="secondary">{cc} správné</Badge>}
        <div className="ml-auto flex gap-1">
          <Button variant="ghost" size="sm" onClick={startEdit}><Pencil /> Upravit</Button>
          <Confirm
            trigger={<Button variant="ghost" size="icon-sm" aria-label="Smazat otázku" className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>}
            title={`Smazat otázku ID ${q.id}?`}
            description={<span className="line-clamp-3">{q.text}</span>}
            confirmLabel="Smazat"
            destructive
            onConfirm={del}
          />
        </div>
      </div>
      <p className="leading-relaxed font-medium whitespace-pre-wrap">{q.text}</p>
      <ul className="mt-4 space-y-1.5">
        {q.answers.map((a, i) => (
          <li key={a.id} className={cn('flex items-center gap-3 rounded-lg border px-1.5 py-1.5', a.is_correct ? 'border-success/40 bg-success-soft' : '')}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => quickToggle(a)}
                  disabled={togglingId === a.id}
                  aria-pressed={a.is_correct}
                  aria-label={a.is_correct ? 'Správná, kliknutím označit jako špatnou' : 'Špatná, kliknutím označit jako správnou'}
                  className={cn(
                    'grid size-7 shrink-0 place-items-center rounded-md border text-xs font-semibold transition-colors disabled:opacity-60',
                    a.is_correct ? 'border-success bg-success text-background' : 'text-muted-foreground hover:border-success hover:text-success',
                  )}
                >
                  {togglingId === a.id ? <Loader2 className="size-3.5 animate-spin" /> : a.is_correct ? <Check className="size-4" strokeWidth={3} /> : LETTERS[i]}
                </button>
              </TooltipTrigger>
              <TooltipContent>{a.is_correct ? 'Označit jako špatnou' : 'Označit jako správnou'}</TooltipContent>
            </Tooltip>
            <span className="flex-1 text-sm whitespace-pre-wrap">{a.text}</span>
          </li>
        ))}
        {q.answers.length === 0 && <li className="text-sm text-muted-foreground">Žádné odpovědi.</li>}
      </ul>
      {q.explanation && (
        <div className="mt-4 flex gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <p className="whitespace-pre-wrap">{q.explanation}</p>
        </div>
      )}
    </article>
  )
}
