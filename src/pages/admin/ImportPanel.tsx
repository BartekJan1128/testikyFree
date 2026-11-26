import { useRef, useState } from 'react'
import { CircleAlert, CircleCheck, Download, FileUp, Loader2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { errMsg } from '@/lib/format'
import { cleanupImages } from '@/lib/upload'
import { cn } from '@/lib/utils'
import { CSV_LONG_TEMPLATE, CSV_WIDE_TEMPLATE, JSON_TEMPLATE, parseAuto, type ParseResult } from '@/lib/importParser'
import { Confirm, ErrorAlert } from '@/components/common'
import { ArrowRight } from 'lucide-react'
import { RichText } from '@/components/RichText'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

function download(name: string, content: string, type: string) {
  const blob = new Blob([type.includes('csv') ? '﻿' + content : content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const FORMATS = [
  {
    key: 'json',
    label: 'JSON',
    file: 'sablona.json',
    type: 'application/json',
    body: JSON_TEMPLATE,
    note: 'Odpovědi jako objekty s "correct": true/false, nebo jako pole textů a "correct": [1, 3]. Přiřazování: "type": "match", "pairs" a volitelně "distractors". V textu jde použít `kód`, **tučně** a blok ``` … ``` (ve JSONu je nový řádek \\n).',
  },
  {
    key: 'wide',
    label: 'CSV, řádek = otázka',
    file: 'sablona-otazky.csv',
    type: 'text/csv',
    body: CSV_WIDE_TEMPLATE,
    note: 'correct = písmena správných sloupců (A,C). U type=match jsou v buňkách dvojice "položka => možnost" a buňka bez => je matoucí možnost navíc. Víceřádkový text (blok kódu) dej do uvozovek.',
  },
  {
    key: 'long',
    label: 'CSV, řádek = odpověď',
    file: 'sablona-odpovedi.csv',
    type: 'text/csv',
    body: CSV_LONG_TEMPLATE,
    note: 'Prázdná buňka v question = další odpověď k předchozí otázce. Správnost 1/0, ano/ne nebo x. U type=match je v answer "položka => možnost".',
  },
]

export default function ImportPanel({
  testId,
  existingCount,
  onImported,
}: {
  testId: number
  existingCount: number
  onImported: () => void | Promise<void>
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [raw, setRaw] = useState('')
  const [filename, setFilename] = useState<string | undefined>()
  const [result, setResult] = useState<ParseResult | null>(null)
  const [replace, setReplace] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [over, setOver] = useState(false)

  function analyze(text: string, name?: string) {
    setRaw(text)
    setFilename(name)
    setResult(text.trim() ? parseAuto(text, name) : null)
    setError(null)
  }

  async function doImport() {
    if (!result || result.errors.length || !result.questions.length) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('import_questions', { p_test_id: testId, p_questions: result.questions, p_replace: replace })
    setBusy(false)
    if (error) return setError(errMsg(error))
    if (replace) cleanupImages()
    toast.success(`Naimportováno ${result.questions.length} otázek`)
    setRaw('')
    setResult(null)
    setFilename(undefined)
    await onImported()
  }

  const ok = !!result && !result.errors.length && result.questions.length > 0
  const matchN = result?.questions.filter((q) => q.type === 'match').length ?? 0
  const importLabel = ok ? `Importovat ${result!.questions.length} otázek` : 'Importovat'
  const importBtn = (
    <Button disabled={!ok || busy} onClick={replace && existingCount > 0 ? undefined : doImport}>
      {busy && <Loader2 className="animate-spin" />} {importLabel}
    </Button>
  )

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setOver(false)
            const f = e.dataTransfer.files[0]
            if (f) f.text().then((t) => analyze(t, f.name))
          }}
          className={cn(
            'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
            over ? 'border-primary bg-accent/50' : 'hover:border-foreground/25 hover:bg-muted/50',
          )}
        >
          <FileUp className="size-6 text-muted-foreground" />
          <span className="font-medium">{filename ? filename : 'Přetáhni sem soubor .json nebo .csv'}</span>
          <span className="text-sm text-muted-foreground">{filename ? 'Klikni pro jiný soubor' : 'nebo klikni a vyber ho z počítače'}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,.txt,application/json,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) f.text().then((t) => analyze(t, f.name))
            e.target.value = ''
          }}
        />
        <Textarea
          rows={7}
          placeholder="Nebo obsah vlož sem"
          value={raw}
          onChange={(e) => analyze(e.target.value)}
          className="font-mono text-xs"
        />

        {result && result.errors.length > 0 && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>Takhle to importovat nejde</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {result.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              {result.errors.length > 10 && <p>a dalších {result.errors.length - 10}</p>}
            </AlertDescription>
          </Alert>
        )}
        {result && result.skipped.length > 0 && (
          <Alert className="border-warning/40 bg-warning-soft text-warning">
            <TriangleAlert />
            <AlertTitle>
              {result.skipped.length === 1 ? '1 otázka se přeskočí' : `${result.skipped.length} otázek se přeskočí`}
            </AlertTitle>
            <AlertDescription className="text-warning">
              <ul className="list-disc pl-4">
                {result.skipped.slice(0, 15).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              {result.skipped.length > 15 && <p>a dalších {result.skipped.length - 15}</p>}
              <p className="mt-1">Ostatní otázky se naimportují. Přeskočené můžeš opravit v souboru, nebo je přidat ručně v editoru.</p>
            </AlertDescription>
          </Alert>
        )}
        {result && result.warnings.length > 0 && (
          <Alert className="border-warning/40 bg-warning-soft text-warning">
            <TriangleAlert />
            <AlertTitle>Zkontroluj před importem</AlertTitle>
            <AlertDescription className="text-warning">
              <ul className="list-disc pl-4">
                {result.warnings.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}
              </ul>
              {result.warnings.length > 8 && <p>a dalších {result.warnings.length - 8}</p>}
            </AlertDescription>
          </Alert>
        )}

        {ok && (
          <div className="rounded-xl border bg-card">
            <div className="flex items-center gap-2 border-b px-5 py-3 text-sm">
              <CircleCheck className="size-4 text-success" />
              <span>
                Rozpoznáno <b>{result!.questions.length}</b> otázek
                {matchN > 0 && <>, z toho {matchN} přiřazování</>}
              </span>
            </div>
            <ol className="divide-y">
              {result!.questions.slice(0, 5).map((q, i) => (
                <li key={i} className="px-5 py-4">
                  <div className="flex gap-1.5 text-sm font-medium">
                    <span>{i + 1}.</span>
                    <RichText text={q.text} className="min-w-0 flex-1" />
                    {q.type === 'match' && <Badge variant="secondary">Přiřazování</Badge>}
                  </div>
                  {q.type === 'match' ? (
                    <ul className="mt-2 space-y-1 text-sm">
                      {q.pairs.map((p, j) => (
                        <li key={j} className="flex items-center gap-2 text-success">
                          <RichText as="span" text={p.left} />
                          <ArrowRight className="size-3.5 shrink-0" />
                          <RichText as="span" text={p.right} className="font-medium" />
                        </li>
                      ))}
                      {q.distractors.map((d, j) => (
                        <li key={`d${j}`} className="text-muted-foreground">navíc: <RichText as="span" text={d} /></li>
                      ))}
                    </ul>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {q.answers.map((a, j) => (
                        <li key={j} className={cn('flex items-start gap-2 text-sm', a.correct ? 'text-success' : 'text-muted-foreground')}>
                          <span className="w-4 shrink-0 text-xs leading-5 font-semibold">{String.fromCharCode(65 + j)}</span>
                          <RichText as="span" text={a.text} className={cn('min-w-0', a.correct && 'font-medium')} />
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
            {result!.questions.length > 5 && (
              <p className="border-t px-5 py-3 text-xs text-muted-foreground">a dalších {result!.questions.length - 5} otázek</p>
            )}
          </div>
        )}

        <ErrorAlert error={error} />

      </div>

      <aside className="divide-y rounded-xl border bg-card lg:sticky lg:top-[76px]">
        <div className="space-y-4 p-5">
          {existingCount > 0 ? (
            <div className="flex items-start gap-3">
              <Switch id="replace" checked={replace} onCheckedChange={setReplace} className="mt-0.5" />
              <Label htmlFor="replace" className="flex flex-col items-start gap-0.5 font-normal">
                <span className="font-medium">Nahradit současné otázky</span>
                <span className="text-xs text-muted-foreground">
                  {replace ? `Všech ${existingCount} otázek se smaže a nahradí importem.` : `Nové se přidají za ${existingCount} stávajících.`}
                </span>
              </Label>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Test je zatím prázdný.</p>
          )}
          <div className="[&>button]:w-full">
            {replace && existingCount > 0 ? (
              <Confirm
                trigger={importBtn}
                title={`Nahradit ${existingCount} otázek?`}
                description="Současné otázky se smažou a nahradí importem. Historie odevzdaných pokusů zůstane."
                confirmLabel="Nahradit"
                destructive
                onConfirm={doImport}
              />
            ) : (
              importBtn
            )}
          </div>
          {!result && <p className="text-xs text-muted-foreground">Nejdřív nahraj soubor nebo vlož obsah.</p>}
        </div>

        <div className="p-5">
        <h3 className="font-semibold">Formát souboru</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Otázka může mít víc správných odpovědí. CSV může mít oddělovač středník, čárku i tabulátor.
        </p>
        <Tabs defaultValue="wide" className="mt-4">
          <TabsList className="w-full">
            {FORMATS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="text-xs">
                {f.key === 'json' ? 'JSON' : f.key === 'wide' ? 'CSV otázky' : 'CSV odpovědi'}
              </TabsTrigger>
            ))}
          </TabsList>
          {FORMATS.map((f) => (
            <TabsContent key={f.key} value={f.key} className="space-y-3">
              <pre className="max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">{f.body}</pre>
              <p className="text-xs leading-relaxed text-muted-foreground">{f.note}</p>
              <Button variant="outline" size="sm" onClick={() => download(f.file, f.body, f.type)}>
                <Download /> Stáhnout šablonu
              </Button>
            </TabsContent>
          ))}
        </Tabs>
        </div>
      </aside>
    </div>
  )
}
