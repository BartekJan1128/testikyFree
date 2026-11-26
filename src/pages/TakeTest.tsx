import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { errMsg, shuffle } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ErrorAlert, Loading, Page } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { RichText } from '@/components/RichText'
import { MatchQuestion, type MatchValue } from '@/components/MatchQuestion'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

type TakeAnswer = { id: number; text: string }
type TakeQuestion = { id: number; type: 'choice' | 'match'; text: string; multiple: boolean; answers: TakeAnswer[]; options: string[] }
type TakeTestData = {
  id: number
  title: string
  description: string
  shuffle_questions: boolean
  shuffle_answers: boolean
  questions: TakeQuestion[]
}
type ProgressState = {
  order: number[]
  answerOrder: Record<number, number[]>
  selected: Record<number, number[]>
  /** přiřazování: question_id -> { answer_id: index možnosti } */
  matches: Record<number, MatchValue>
  startedAt: string
  idx: number
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function loadProgress(key: string): ProgressState | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as ProgressState) : null
  } catch {
    return null
  }
}
function saveProgress(key: string, p: ProgressState | null) {
  try {
    if (p) localStorage.setItem(key, JSON.stringify(p))
    else localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

const plural = (n: number) => (n === 1 ? 'otázku' : n >= 2 && n <= 4 ? 'otázky' : 'otázek')

export default function TakeTest() {
  const { id } = useParams()
  const testId = Number(id)
  const { session } = useAuth()
  const navigate = useNavigate()
  const storageKey = `testiky:progress:${session?.user.id}:${testId}`

  const [test, setTest] = useState<TakeTestData | null>(null)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.rpc('get_test_for_taking', { p_test_id: testId }).then(({ data, error }) => {
      if (error) return setError(errMsg(error))
      const t = data as TakeTestData
      setTest(t)
      const ids = new Set(t.questions.map((q) => q.id))
      const saved = loadProgress(storageKey)
      if (saved && saved.order.length === ids.size && saved.order.every((x) => ids.has(x))) {
        setProgress({ ...saved, matches: saved.matches ?? {} })
        return
      }
      const order = (t.shuffle_questions ? shuffle(t.questions) : t.questions).map((q) => q.id)
      const answerOrder: Record<number, number[]> = {}
      t.questions.forEach((q) => {
        answerOrder[q.id] = (t.shuffle_answers ? shuffle(q.answers) : q.answers).map((a) => a.id)
      })
      setProgress({ order, answerOrder, selected: {}, matches: {}, startedAt: new Date().toISOString(), idx: 0 })
    })
  }, [testId, storageKey])

  useEffect(() => {
    if (progress) saveProgress(storageKey, progress)
  }, [progress, storageKey])

  const byId = useMemo(() => new Map(test?.questions.map((q) => [q.id, q]) ?? []), [test])
  const total = progress?.order.length ?? 0
  const q = progress ? byId.get(progress.order[progress.idx]) : undefined
  const answers = useMemo(() => {
    if (!q || !progress) return []
    const m = new Map(q.answers.map((a) => [a.id, a]))
    return (progress.answerOrder[q.id] ?? q.answers.map((a) => a.id)).map((aid) => m.get(aid)).filter(Boolean) as TakeAnswer[]
  }, [q, progress])

  const go = useCallback(
    (idx: number) => setProgress((p) => (p ? { ...p, idx: Math.max(0, Math.min(p.order.length - 1, idx)) } : p)),
    [],
  )

  const toggle = useCallback(
    (aid: number) => {
      if (!q) return
      setProgress((p) => {
        if (!p) return p
        const cur = p.selected[q.id] ?? []
        const next = q.multiple ? (cur.includes(aid) ? cur.filter((x) => x !== aid) : [...cur, aid]) : cur.includes(aid) ? [] : [aid]
        return { ...p, selected: { ...p.selected, [q.id]: next } }
      })
    },
    [q],
  )

  // klávesové zkratky: A–Z / 1–9 výběr, šipky navigace
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!progress || confirmOpen || q?.type === 'match' || e.metaKey || e.ctrlKey || e.altKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') return go(progress.idx + 1)
      if (e.key === 'ArrowLeft') return go(progress.idx - 1)
      const k = e.key.toUpperCase()
      let i = -1
      if (/^[1-9]$/.test(k)) i = Number(k) - 1
      else if (/^[A-Z]$/.test(k)) i = LETTERS.indexOf(k)
      if (i >= 0 && answers[i]) {
        e.preventDefault()
        toggle(answers[i].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [progress, answers, toggle, go, confirmOpen, q])

  if (error && !test)
    return (
      <Page className="space-y-4">
        <ErrorAlert error={error} />
        <Button variant="outline" asChild><Link to="/"><ArrowLeft /> Zpět na testy</Link></Button>
      </Page>
    )
  if (!test || !progress || !q) return <Loading label="Načítám test" />

  const selected = progress.selected[q.id] ?? []
  const isAnswered = (qid: number) => {
    const qq = byId.get(qid)
    if (qq?.type === 'match') return Object.keys(progress.matches[qid] ?? {}).length >= qq.answers.length
    return (progress.selected[qid] ?? []).length > 0
  }
  const answeredCount = progress.order.filter(isAnswered).length
  const unanswered = total - answeredCount
  const isLast = progress.idx === total - 1

  function buildAnswers() {
    const out: Record<number, number[] | Record<number, string>> = { ...progress!.selected }
    for (const [qid, m] of Object.entries(progress!.matches)) {
      const qq = byId.get(Number(qid))
      if (!qq) continue
      const pairs: Record<number, string> = {}
      for (const [aid, idx] of Object.entries(m)) if (qq.options[idx] != null) pairs[Number(aid)] = qq.options[idx]
      out[Number(qid)] = pairs
    }
    return out
  }

  async function submit() {
    if (!progress) return
    setSubmitting(true)
    const { data, error } = await supabase.rpc('submit_attempt', {
      p_test_id: testId,
      p_answers: buildAnswers(),
      p_started_at: progress.startedAt,
    })
    if (error) {
      setSubmitting(false)
      setConfirmOpen(false)
      return setError(errMsg(error))
    }
    saveProgress(storageKey, null)
    navigate(`/attempt/${data}`, { replace: true })
  }

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="min-w-0 flex-1">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Testy</Link>
          <h1 className="truncate text-2xl font-bold">{test.title}</h1>
        </div>
        <Button variant="outline" onClick={() => setConfirmOpen(true)}>
          <Send /> Odevzdat
        </Button>
      </div>

      <ErrorAlert error={error} className="mb-6" />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_272px]">
        <section className="rounded-2xl border bg-card p-5 sm:p-8">
          <div className="mb-6 space-y-3">
            <div className="flex items-baseline justify-between text-sm text-muted-foreground">
              <span>
                Otázka <span className="font-semibold text-foreground tabular-nums">{progress.idx + 1}</span> z {total}
              </span>
              <span className="text-xs tabular-nums">ID {q.id}</span>
            </div>
            <Progress value={((progress.idx + 1) / total) * 100} className="h-1" />
          </div>

          <RichText as="div" text={q.text} className="font-heading text-xl leading-snug font-semibold sm:text-[1.4rem]" />
          <p className="mt-2 text-sm text-muted-foreground">
            {q.type === 'match'
              ? 'Ke každé položce přiřaď správnou možnost.'
              : q.multiple
                ? 'Správných odpovědí je víc, označ všechny.'
                : 'Vyber jednu odpověď.'}
          </p>

          {q.type === 'match' ? (
            <div className="mt-6">
              <MatchQuestion
                key={q.id}
                items={answers}
                options={q.options}
                value={progress.matches[q.id] ?? {}}
                onChange={(v) => setProgress((p) => (p ? { ...p, matches: { ...p.matches, [q.id]: v } } : p))}
              />
            </div>
          ) : (
          <div className="mt-6 space-y-2.5" role={q.multiple ? 'group' : 'radiogroup'}>
            {answers.map((a, i) => {
              const on = selected.includes(a.id)
              return (
                <button
                  key={a.id}
                  type="button"
                  role={q.multiple ? 'checkbox' : 'radio'}
                  aria-checked={on}
                  onClick={() => toggle(a.id)}
                  className={cn(
                    'group flex w-full items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                    on ? 'border-primary/60 bg-accent/50' : 'hover:border-foreground/20 hover:bg-muted/60',
                  )}
                >
                  <span
                    className={cn(
                      'mt-px grid size-7 shrink-0 place-items-center border text-xs font-semibold transition-colors',
                      q.multiple ? 'rounded-md' : 'rounded-full',
                      on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground group-hover:border-foreground/30',
                    )}
                  >
                    {on && q.multiple ? <Check className="size-4" strokeWidth={3} /> : LETTERS[i]}
                  </span>
                  <span className="min-w-0 pt-0.5 leading-relaxed">
                    <RichText as="span" text={a.text} className={cn(on && 'font-medium')} />
                  </span>
                </button>
              )
            })}
          </div>
          )}

          <div className="mt-8 flex items-center gap-2">
            <Button variant="ghost" onClick={() => go(progress.idx - 1)} disabled={progress.idx === 0}>
              <ArrowLeft /> Předchozí
            </Button>
            <span className="hidden flex-1 text-center text-xs text-muted-foreground sm:block">
              {q.type === 'match'
                ? 'Šipky přepínají otázky'
                : `Klávesy A–${LETTERS[Math.max(0, answers.length - 1)]} vybírají, šipky přepínají otázky`}
            </span>
            <span className="flex-1 sm:hidden" />
            {isLast ? (
              <Button size="lg" onClick={() => setConfirmOpen(true)}><Send /> Odevzdat test</Button>
            ) : (
              <Button size="lg" onClick={() => go(progress.idx + 1)}>Další <ArrowRight /></Button>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border bg-card p-5 lg:sticky lg:top-[76px]">
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="font-semibold">Přehled</h3>
            <span className="text-sm text-muted-foreground tabular-nums">{answeredCount} / {total}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1.5">
            {progress.order.map((qid, i) => {
              const answered = isAnswered(qid)
              const current = i === progress.idx
              return (
                <button
                  key={qid}
                  onClick={() => go(i)}
                  title={`Otázka ${i + 1}, ID ${qid}`}
                  className={cn(
                    'h-9 rounded-md text-xs font-semibold tabular-nums transition-colors',
                    answered ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
                    current && 'ring-2 ring-foreground ring-offset-2 ring-offset-card',
                  )}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Odpovědi se průběžně ukládají v tomhle prohlížeči, takže test můžeš zavřít a dokončit později.
          </p>
        </aside>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !submitting && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odevzdat test?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered > 0
                ? `Zbývá ti ${unanswered} ${plural(unanswered)} bez odpovědi. Ty se počítají jako špatně.`
                : 'Máš zodpovězeno všechno. Po odevzdání už odpovědi nejde změnit.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Zpět k testu</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(e) => {
                e.preventDefault()
                submit()
              }}
            >
              {submitting && <Loader2 className="animate-spin" />}
              Odevzdat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  )
}
