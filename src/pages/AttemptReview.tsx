import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Check, Lightbulb, Pencil, RotateCcw, SearchX, Trophy, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Attempt, AttemptAnswer } from '@/lib/types'
import { errMsg, fmtDate, fmtDuration, scoreTone } from '@/lib/format'
import { isIdQuery, makeQuestionMatcher } from '@/lib/search'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorAlert, Loading, Page, QuestionId, SearchField, Stat } from '@/components/common'
import { RichText } from '@/components/RichText'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

type Filter = 'all' | 'wrong' | 'right'

const tone = { good: 'text-success', mid: 'text-warning', bad: 'text-destructive', neutral: 'text-muted-foreground' }

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
      if (!a.data) return setError('Tenhle pokus neexistuje, nebo k němu nemáš přístup.')
      setAttempt(a.data as Attempt)
      setItems((b.data as AttemptAnswer[]) ?? [])
    })()
  }, [id])

  const matcher = useMemo(() => makeQuestionMatcher(query), [query])
  const visible = items.filter(
    (it) =>
      (filter === 'all' || (filter === 'wrong' ? !it.is_correct : it.is_correct)) &&
      matcher(it.question_id, it.question_text, ...it.answers.map((a) => `${a.text} ${a.match_text ?? ''}`)),
  )

  if (error) return <Page narrow><ErrorAlert error={error} /></Page>
  if (!attempt) return <Loading />

  const pct = Number(attempt.score_pct)
  const isOwn = attempt.user_id === session?.user.id
  const wrong = items.filter((i) => !i.is_correct).length
  const duration = fmtDuration(attempt.started_at, attempt.finished_at)

  return (
    <Page narrow>
      <div className="mb-3 text-sm text-muted-foreground">
        {isOwn ? <Link to="/history" className="hover:text-foreground">Historie</Link> : <Link to={`/admin/tests/${attempt.test_id}?tab=results`} className="hover:text-foreground">Výsledky testu</Link>}
      </div>

      <section className="mb-10 rounded-2xl border bg-card p-6 sm:p-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{attempt.test_title}</h1>
        {!isOwn && (
          <p className="mt-1 text-sm text-muted-foreground">
            Vyplnil(a) <span className="font-medium text-foreground">{attempt.profiles?.display_name}</span> ({attempt.profiles?.email})
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-6">
          <div>
            <div className={cn('font-heading text-6xl leading-none font-bold tabular-nums sm:text-7xl', tone[scoreTone(pct)])}>
              <span className="hl">{Math.round(pct)}</span>
              <span className="text-3xl sm:text-4xl"> %</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-8 pb-1">
            <Stat label="Správně">{attempt.correct_count} z {attempt.total_count}</Stat>
            <Stat label="Čas">{duration ?? '–'}</Stat>
            <Stat label="Odevzdáno">{fmtDate(attempt.finished_at)}</Stat>
          </div>
        </div>
        <div className="mt-7 flex flex-wrap gap-2">
          {attempt.test_id && isOwn && (
            <Button asChild><Link to={`/test/${attempt.test_id}`}><RotateCcw /> Zkusit znovu</Link></Button>
          )}
          {attempt.test_id && (
            <Button variant="outline" asChild><Link to={`/leaderboard/${attempt.test_id}`}><Trophy /> Žebříček</Link></Button>
          )}
          {profile?.is_admin && attempt.test_id && (
            <Button variant="ghost" asChild><Link to={`/admin/tests/${attempt.test_id}`}><Pencil /> Upravit test</Link></Button>
          )}
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Najít otázku podle ID nebo textu" />
        <ToggleGroup type="single" variant="outline" value={filter} onValueChange={(v) => v && setFilter(v as Filter)}>
          <ToggleGroupItem value="all" className="px-3">Vše {items.length}</ToggleGroupItem>
          <ToggleGroupItem value="wrong" className="px-3">Chyby {wrong}</ToggleGroupItem>
          <ToggleGroupItem value="right" className="px-3">Správně {items.length - wrong}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mb-8 flex flex-wrap gap-1">
        {items.map((it) => (
          <button
            key={it.id}
            title={`Otázka ${it.position}, ID ${it.question_id}`}
            onClick={() => document.getElementById(`r-${it.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            className={cn(
              'size-8 rounded-md text-xs font-semibold tabular-nums transition-opacity hover:opacity-80',
              it.is_correct ? 'bg-success-soft text-success' : 'bg-danger-soft text-destructive',
            )}
          >
            {it.position}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={SearchX} title={isIdQuery(query) ? 'Otázka s tímhle ID v testu není' : 'Nic neodpovídá hledání'}>
          Zkus jiné ID nebo přepni filtr.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {visible.map((it) => <ReviewItem key={it.id} item={it} own={isOwn} />)}
        </div>
      )}
    </Page>
  )
}

function ReviewItem({ item, own }: { item: AttemptAnswer; own: boolean }) {
  const sel = new Set(item.selected_answer_ids.map(Number))
  return (
    <article id={`r-${item.id}`} className="scroll-mt-24 rounded-xl border bg-card p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            'grid size-6 place-items-center rounded-full',
            item.is_correct ? 'bg-success text-background' : 'bg-destructive text-background',
          )}
          aria-label={item.is_correct ? 'Správně' : 'Špatně'}
        >
          {item.is_correct ? <Check className="size-3.5" strokeWidth={3} /> : <X className="size-3.5" strokeWidth={3} />}
        </span>
        <span className="text-sm font-medium">Otázka {item.position}</span>
        <QuestionId id={item.question_id} />
        {item.question_type === 'match' && <Badge variant="secondary">Přiřazování</Badge>}
        {item.question_type !== 'match' && sel.size === 0 && <Badge variant="outline" className="text-warning">Bez odpovědi</Badge>}
      </div>
      <RichText text={item.question_text} className="leading-relaxed font-medium" />
      {item.question_type === 'match' ? (
        <MatchReview item={item} own={own} />
      ) : (
      <ul className="mt-4 space-y-1.5">
        {item.answers.map((a) => {
          const picked = sel.has(a.id)
          const state = picked && a.is_correct ? 'hit' : picked ? 'wrong' : a.is_correct ? 'missed' : 'none'
          return (
            <li
              key={a.id}
              className={cn(
                'flex items-start gap-3 rounded-lg border px-3 py-2 text-sm',
                state === 'hit' && 'border-transparent bg-success-soft',
                state === 'wrong' && 'border-transparent bg-danger-soft',
                state === 'missed' && 'border-dashed border-success/60',
                state === 'none' && 'text-muted-foreground',
              )}
            >
              <span className="mt-0.5 w-4 shrink-0">
                {state === 'hit' && <Check className="size-4 text-success" strokeWidth={2.5} />}
                {state === 'wrong' && <X className="size-4 text-destructive" strokeWidth={2.5} />}
                {state === 'missed' && <Check className="size-4 text-success/70" strokeWidth={2.5} />}
              </span>
              <RichText as="span" text={a.text} className="min-w-0 flex-1" />
              {state !== 'none' && (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {state === 'hit' ? (own ? 'tvoje, správně' : 'vybráno, správně') : state === 'wrong' ? (own ? 'tvoje odpověď' : 'vybráno') : 'správná odpověď'}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      )}
      {item.explanation && (
        <div className="mt-4 flex gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <RichText text={item.explanation} className="min-w-0 flex-1" />
        </div>
      )}
    </article>
  )
}

function MatchReview({ item, own }: { item: AttemptAnswer; own: boolean }) {
  const chosen = item.selected_matches ?? {}
  const pairs = item.answers.filter((a) => a.text !== '')
  return (
    <div className="mt-4 overflow-hidden rounded-lg border">
      <div className="hidden grid-cols-[1fr_1fr] gap-4 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground sm:grid">
        <span>Položka</span>
        <span>{own ? 'Tvoje přiřazení' : 'Přiřazení'}</span>
      </div>
      <ul className="divide-y">
        {pairs.map((a) => {
          const pick = chosen[String(a.id)]
          const ok = pick != null && pick.trim() === (a.match_text ?? '').trim()
          return (
            <li key={a.id} className="grid gap-1.5 px-3 py-2.5 text-sm sm:grid-cols-[1fr_1fr] sm:gap-4">
              <RichText text={a.text} className="min-w-0" />
              <div className="flex min-w-0 items-start gap-2">
                {ok ? (
                  <Check className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={2.5} />
                ) : (
                  <X className="mt-0.5 size-4 shrink-0 text-destructive" strokeWidth={2.5} />
                )}
                <div className="min-w-0">
                  {pick != null ? (
                    <RichText as="span" text={pick} className={cn('font-medium', ok ? 'text-success' : 'text-destructive line-through decoration-destructive/50')} />
                  ) : (
                    <span className="text-warning">nepřiřazeno</span>
                  )}
                  {!ok && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      správně: <RichText as="span" text={a.match_text ?? ''} className="font-medium text-success" />
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
