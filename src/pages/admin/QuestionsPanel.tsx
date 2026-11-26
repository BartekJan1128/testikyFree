import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { ArrowRight, Check, FileUp, ImagePlus, Lightbulb, ListPlus, Loader2, Pencil, Plus, SearchX, Trash2, TriangleAlert, X } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Answer, Question, QuestionType } from '@/lib/types'
import { errMsg } from '@/lib/format'
import { cleanupImages, imageFromClipboard, imageMarkdown, uploadImage } from '@/lib/upload'
import { isIdQuery, makeQuestionMatcher } from '@/lib/search'
import { cn } from '@/lib/utils'
import { Confirm, EmptyState, ErrorAlert, QuestionId, SearchField } from '@/components/common'
import { RichText } from '@/components/RichText'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
type Filter = 'all' | 'nocorrect' | 'multi' | 'match'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const correctCount = (q: Question) => q.answers.filter((a) => a.is_correct).length
const isBroken = (q: Question) => (q.type === 'match' ? q.answers.filter((a) => a.text && a.match_text).length === 0 : correctCount(q) === 0)

export default function QuestionsPanel({ testId, questions, setQuestions, onImport }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const matcher = useMemo(() => makeQuestionMatcher(query), [query])
  const broken = questions.filter(isBroken).length
  const multi = questions.filter((q) => q.type === 'choice' && correctCount(q) > 1).length
  const matchCount = questions.filter((q) => q.type === 'match').length

  const visible = questions
    .map((q, i) => ({ q, num: i + 1 }))
    .filter(({ q }) => {
      if (filter === 'nocorrect' && !isBroken(q)) return false
      if (filter === 'multi' && (q.type !== 'choice' || correctCount(q) < 2)) return false
      if (filter === 'match' && q.type !== 'match') return false
      return matcher(q.id, q.text, q.explanation, ...q.answers.map((a) => `${a.text} ${a.match_text ?? ''}`))
    })

  const replace = (q: Question) => setQuestions((list) => list && list.map((x) => (x.id === q.id ? q : x)))
  const remove = (id: number) => {
    setQuestions((list) => list && list.filter((x) => x.id !== id))
    setSelected((s) => {
      const n = new Set(s)
      n.delete(id)
      return n
    })
  }

  const visibleIds = visible.map(({ q }) => q.id)
  const selectedVisible = visibleIds.filter((id) => selected.has(id)).length
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible === visibleIds.length
  const toggleOne = (id: number) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAllVisible = () =>
    setSelected((s) => {
      const n = new Set(s)
      if (allVisibleSelected) visibleIds.forEach((id) => n.delete(id))
      else visibleIds.forEach((id) => n.add(id))
      return n
    })

  async function deleteSelected() {
    const ids = [...selected]
    // po dávkách, ať URL dotazu nepřeteče
    for (let i = 0; i < ids.length; i += 150) {
      const { error } = await supabase.from('questions').delete().in('id', ids.slice(i, i + 150))
      if (error) {
        toast.error(errMsg(error))
        break
      }
      const done = new Set(ids.slice(i, i + 150))
      setQuestions((list) => list && list.filter((x) => !done.has(x.id)))
    }
    setSelected(new Set())
    cleanupImages()
    toast.success(`Smazáno ${ids.length} ${ids.length === 1 ? 'otázka' : ids.length < 5 ? 'otázky' : 'otázek'}`)
  }

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
          <ToggleGroupItem value="match" className="px-3">Přiřazování {matchCount}</ToggleGroupItem>
          <ToggleGroupItem value="nocorrect" className="px-3">Bez správné {broken}</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={() => setAdding(true)} disabled={adding}><Plus /> Otázka</Button>
      </div>

      {broken > 0 && filter !== 'nocorrect' && (
        <Alert className="border-warning/40 bg-warning-soft text-warning">
          <TriangleAlert />
          <AlertDescription className="text-warning">
            {broken === 1 ? '1 otázka nemá' : `${broken} otázek nemá`} nastavenou správnou odpověď a vždy se započítá jako chyba.
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

      {visible.length > 0 && (
        <div
          className={cn(
            'sticky top-[68px] z-20 -mx-1 flex min-h-12 flex-wrap items-center gap-3 rounded-xl border px-4 py-2 shadow-sm transition-colors',
            selected.size > 0 ? 'border-primary/40 bg-accent/90 backdrop-blur' : 'bg-background/90 backdrop-blur',
          )}
        >
          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-medium">
            <Checkbox
              checked={allVisibleSelected ? true : selectedVisible > 0 ? 'indeterminate' : false}
              onCheckedChange={toggleAllVisible}
              aria-label="Vybrat vše"
            />
            {query || filter !== 'all' ? `Vybrat nalezené (${visibleIds.length})` : `Vybrat vše (${visibleIds.length})`}
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-sm text-muted-foreground">Vybráno {selected.size}</span>
              <div className="ml-auto flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Zrušit výběr</Button>
                <Confirm
                  trigger={<Button variant="destructive" size="sm"><Trash2 /> Smazat vybrané ({selected.size})</Button>}
                  title={`Smazat ${selected.size} ${selected.size === 1 ? 'otázku' : selected.size < 5 ? 'otázky' : 'otázek'}?`}
                  description="Otázky se smažou i s odpovědmi. Odevzdané pokusy v historii zůstanou."
                  confirmLabel="Smazat"
                  destructive
                  onConfirm={deleteSelected}
                />
              </div>
            </>
          )}
        </div>
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
              selected={selected.has(q.id)}
              onSelect={() => toggleOne(q.id)}
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

/** text = odpověď (výběr) nebo levá položka (přiřazování), right = možnost (přiřazování) */
type Draft = { id?: number; text: string; right: string; is_correct: boolean; key: string }
let keySeq = 0
const newKey = () => `k${++keySeq}`
const emptyDraft = (): Draft => ({ text: '', right: '', is_correct: false, key: newKey() })

function QuestionCard({
  testId,
  num,
  question,
  nextPosition,
  selected,
  onSelect,
  onSaved,
  onDeleted,
  onCancel,
}: {
  testId: number
  num: number
  question: Question | null
  nextPosition: number
  selected?: boolean
  onSelect?: () => void
  onSaved: (q: Question) => void
  onDeleted?: () => void
  onCancel?: () => void
}) {
  const isNew = !question
  const [editing, setEditing] = useState(isNew)
  const [type, setType] = useState<QuestionType>(question?.type ?? 'choice')
  const [text, setText] = useState(question?.text ?? '')
  const [explanation, setExplanation] = useState(question?.explanation ?? '')
  const [drafts, setDrafts] = useState<Draft[]>(() => (question ? [] : [0, 1, 2, 3].map(emptyDraft)))
  const [busy, setBusy] = useState(false)
  const [togglingId, setTogglingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /** Nahraje obrázek a výsledný zápis ![](url) předá do apply. */
  async function addImage(file: File, apply: (md: string) => void) {
    setUploading(true)
    try {
      apply(imageMarkdown(await uploadImage(file)))
      toast.success('Obrázek nahrán')
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setUploading(false)
    }
  }
  const appendMd = (prev: string, md: string) => (prev.trim() ? prev.replace(/\s*$/, '') + '\n' : '') + md
  /** onPaste pro pole: když je ve schránce obrázek, nahraje ho a vloží. */
  const pasteImage = (apply: (md: string) => void) => (e: React.ClipboardEvent) => {
    const f = imageFromClipboard(e)
    if (!f) return
    e.preventDefault()
    addImage(f, apply)
  }

  function startEdit() {
    setType(question?.type ?? 'choice')
    setText(question?.text ?? '')
    setExplanation(question?.explanation ?? '')
    setDrafts(
      question?.answers.map((a) => ({ id: a.id, text: a.text, right: a.match_text ?? '', is_correct: a.is_correct, key: newKey() })) ?? [],
    )
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
    const isMatch = type === 'match'
    const rows = drafts.filter((d) => (isMatch ? d.right.trim() : d.text.trim()))
    if (!text.trim()) return setError('Otázka potřebuje text.')
    if (isMatch) {
      if (rows.filter((r) => r.text.trim()).length < 2) return setError('Přiřazování potřebuje aspoň 2 dvojice (položka i možnost).')
    } else if (rows.length < 1) return setError('Přidej aspoň jednu odpověď.')
    setBusy(true)
    setError(null)
    try {
      let qid = question?.id
      if (qid) {
        const { error } = await supabase.from('questions').update({ type, text: text.trim(), explanation: explanation.trim() }).eq('id', qid)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('questions')
          .insert({ test_id: testId, type, text: text.trim(), explanation: explanation.trim(), position: nextPosition })
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
      const toRow = (r: Draft, position: number) =>
        isMatch
          ? { question_id: qid, text: r.text.trim(), match_text: r.right.trim(), is_correct: !!r.text.trim(), position }
          : { question_id: qid, text: r.text.trim(), match_text: null, is_correct: r.is_correct, position }
      const indexed = rows.map((r, i) => ({ r, position: i + 1 }))
      const existing = indexed.filter(({ r }) => r.id).map(({ r, position }) => ({ id: r.id, ...toRow(r, position) }))
      if (existing.length) {
        const { error } = await supabase.from('answers').upsert(existing)
        if (error) throw error
      }
      const fresh = indexed.filter(({ r }) => !r.id).map(({ r, position }) => toRow(r, position))
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
      cleanupImages()
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
    cleanupImages()
    toast.success(`Otázka ID ${question.id} smazána`)
    onDeleted?.()
  }

  const updateDraft = (key: string, patch: Partial<Draft>) => setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)))
  const removeDraft = (key: string) => setDrafts((x) => x.filter((y) => y.key !== key))
  const removeBtn = (key: string) => (
    <Button type="button" variant="ghost" size="icon-sm" aria-label="Odebrat" onClick={() => removeDraft(key)}>
      <X />
    </Button>
  )
  const bareInput = 'h-8 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent'

  // ------------------------------------------------------------------ úprava
  if (editing) {
    const marked = drafts.filter((d) => d.is_correct && d.text.trim()).length
    return (
      <div className="rounded-xl border border-primary/50 bg-card p-5 ring-3 ring-primary/10 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{isNew ? 'Nová otázka' : `Otázka ${num}`}</span>
          {question && <QuestionId id={question.id} />}
          <ToggleGroup type="single" variant="outline" size="sm" value={type} onValueChange={(v) => v && setType(v as QuestionType)} className="ml-auto">
            <ToggleGroupItem value="choice" className="px-3">Výběr odpovědi</ToggleGroupItem>
            <ToggleGroupItem value="match" className="px-3">Přiřazování</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor={`qt-${question?.id ?? 'new'}`}>Znění otázky</Label>
              <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />} Obrázek
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (f) addImage(f, (md) => setText((t) => appendMd(t, md)))
                }}
              />
            </div>
            <Textarea
              id={`qt-${question?.id ?? 'new'}`}
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={pasteImage((md) => setText((t) => appendMd(t, md)))}
            />
            {/!\[[^\]]*\]\(/.test(text) && (
              <div className="rounded-lg border border-dashed p-3">
                <div className="mb-1 text-xs text-muted-foreground">Náhled</div>
                <RichText text={text} className="text-sm" />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Formátování: <code className="rounded bg-muted px-1">`kód`</code>, <code className="rounded bg-muted px-1">**tučně**</code>, blok kódu mezi řádky <code className="rounded bg-muted px-1">```</code>. Obrázek vložíš tlačítkem nebo Ctrl+V screenshotu (i do odpovědí).
            </p>
          </div>

          {type === 'choice' ? (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label>Odpovědi</Label>
                <span className="text-xs text-muted-foreground">Kliknutím na písmeno označíš správnou. Označeno {marked}.</span>
              </div>
              {drafts.map((d, i) => (
                <div key={d.key} className={cn('flex items-center gap-2 rounded-lg border p-1.5 transition-colors', d.is_correct ? 'border-success/40 bg-success-soft' : 'bg-background')}>
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
                  <Input value={d.text} placeholder={`Odpověď ${LETTERS[i]}`} onChange={(e) => updateDraft(d.key, { text: e.target.value })} onPaste={pasteImage((md) => setDrafts((x) => x.map((y) => (y.key === d.key ? { ...y, text: appendMd(y.text, md).replace(/\n/g, ' ') } : y))))} className={bareInput} />
                  {removeBtn(d.key)}
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => setDrafts((x) => [...x, emptyDraft()])}>
                <Plus /> Přidat odpověď
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <Label>Dvojice</Label>
                <span className="text-xs text-muted-foreground">Vlevo položka, vpravo správná možnost. Bez položky vlevo jde o matoucí možnost navíc.</span>
              </div>
              {drafts.map((d) => {
                const distractor = !d.text.trim() && !!d.right.trim()
                return (
                  <div key={d.key} className={cn('grid grid-cols-[1fr_auto_1fr_auto] items-center gap-1.5 rounded-lg border p-1.5', distractor ? 'border-dashed bg-muted/40' : 'bg-background')}>
                    <Input value={d.text} placeholder={distractor ? 'matoucí možnost' : 'Položka'} onChange={(e) => updateDraft(d.key, { text: e.target.value })} className={bareInput} />
                    <ArrowRight className="size-4 text-muted-foreground" />
                    <Input value={d.right} placeholder="Správná možnost" onChange={(e) => updateDraft(d.key, { right: e.target.value })} onPaste={pasteImage((md) => setDrafts((x) => x.map((y) => (y.key === d.key ? { ...y, right: appendMd(y.right, md).replace(/\n/g, ' ') } : y))))} className={bareInput} />
                    {removeBtn(d.key)}
                  </div>
                )
              })}
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setDrafts((x) => [...x, emptyDraft()])}>
                  <Plus /> Přidat dvojici
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor={`qe-${question?.id ?? 'new'}`}>
              Vysvětlení <span className="font-normal text-muted-foreground">(nepovinné, ukáže se po odevzdání)</span>
            </Label>
            <Textarea
              id={`qe-${question?.id ?? 'new'}`}
              rows={2}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              onPaste={pasteImage((md) => setExplanation((t) => appendMd(t, md)))}
            />
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
  const isMatch = q.type === 'match'
  return (
    <article className={cn('rounded-xl border bg-card p-5 transition-colors sm:p-6', selected && 'border-primary/60 bg-accent/30')}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {onSelect && <Checkbox checked={!!selected} onCheckedChange={onSelect} aria-label={`Vybrat otázku ID ${q.id}`} className="mr-1" />}
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">{num}.</span>
        <QuestionId id={q.id} />
        {isMatch && <Badge variant="secondary">Přiřazování</Badge>}
        {isBroken(q) && <Badge variant="outline" className="border-warning/50 text-warning">Bez správné odpovědi</Badge>}
        {!isMatch && cc > 1 && <Badge variant="secondary">{cc} správné</Badge>}
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
      <RichText text={q.text} className="leading-relaxed font-medium" />

      {isMatch ? (
        <ul className="mt-4 space-y-1.5">
          {q.answers.map((a) =>
            a.text ? (
              <li key={a.id} className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 rounded-lg border border-success/40 bg-success-soft px-3 py-2 text-sm">
                <RichText text={a.text} className="min-w-0" />
                <ArrowRight className="mt-0.5 size-4 text-success" />
                <RichText text={a.match_text ?? ''} className="min-w-0 font-medium" />
              </li>
            ) : (
              <li key={a.id} className="flex items-center gap-3 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                <span className="text-xs">navíc</span>
                <RichText as="span" text={a.match_text ?? ''} />
              </li>
            ),
          )}
        </ul>
      ) : (
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
              <RichText text={a.text} className="min-w-0 flex-1 text-sm" />
            </li>
          ))}
          {q.answers.length === 0 && <li className="text-sm text-muted-foreground">Žádné odpovědi.</li>}
        </ul>
      )}
      {q.explanation && (
        <div className="mt-4 flex gap-2.5 rounded-lg bg-muted px-3.5 py-3 text-sm text-muted-foreground">
          <Lightbulb className="mt-0.5 size-4 shrink-0" />
          <RichText text={q.explanation} className="min-w-0 flex-1" />
        </div>
      )}
    </article>
  )
}
