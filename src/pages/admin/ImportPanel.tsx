import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { errMsg } from '../../lib/format'
import { CSV_LONG_TEMPLATE, CSV_WIDE_TEMPLATE, JSON_TEMPLATE, parseAuto, type ParseResult } from '../../lib/importParser'
import { ErrorBox } from '../../components/ui'

function download(name: string, content: string, type: string) {
  const blob = new Blob([type.includes('csv') ? '﻿' + content : content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

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

  async function readFile(f: File) {
    analyze(await f.text(), f.name)
  }

  async function doImport() {
    if (!result || result.errors.length || !result.questions.length) return
    if (replace && existingCount > 0 && !confirm(`Smazat všech ${existingCount} stávajících otázek a nahradit je importem?`)) return
    setBusy(true)
    setError(null)
    const { error } = await supabase.rpc('import_questions', {
      p_test_id: testId,
      p_questions: result.questions,
      p_replace: replace,
    })
    setBusy(false)
    if (error) return setError(errMsg(error))
    setRaw('')
    setResult(null)
    await onImported()
  }

  const ok = result && !result.errors.length && result.questions.length > 0

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card stack" style={{ gap: 14 }}>
        <div
          className={`dropzone${over ? ' over' : ''}`}
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
            if (f) readFile(f)
          }}
        >
          <b>Přetáhni sem soubor .json nebo .csv</b>
          <div className="small">nebo klikni a vyber ho · případně obsah vlož níže</div>
          {filename && <div className="small" style={{ marginTop: 6 }}>Načteno: <span className="mono">{filename}</span></div>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.csv,.txt,application/json,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) readFile(f)
            e.target.value = ''
          }}
        />
        <textarea
          className="input mono"
          rows={8}
          placeholder="…nebo sem vlož JSON / CSV"
          value={raw}
          onChange={(e) => analyze(e.target.value)}
          style={{ fontSize: '0.84rem' }}
        />

        {result && (
          <div className="stack" style={{ gap: 10 }}>
            {result.errors.length > 0 && (
              <div className="alert error">
                <b>Import nelze provést:</b>
                <ul>{result.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}</ul>
                {result.errors.length > 12 && <div>…a dalších {result.errors.length - 12}</div>}
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="alert warn">
                <b>Upozornění</b> (import půjde, ale zkontroluj):
                <ul>{result.warnings.slice(0, 8).map((e, i) => <li key={i}>{e}</li>)}</ul>
                {result.warnings.length > 8 && <div>…a dalších {result.warnings.length - 8}</div>}
              </div>
            )}
            {ok && (
              <div className="alert success">
                Rozpoznáno <b>{result.questions.length}</b> otázek,{' '}
                {result.questions.reduce((s, q) => s + q.answers.length, 0)} odpovědí.
              </div>
            )}
            {ok && (
              <div className="stack" style={{ gap: 8 }}>
                <b className="small">Náhled (prvních 5):</b>
                {result.questions.slice(0, 5).map((q, i) => (
                  <div key={i} className="card tight">
                    <div className="qtext" style={{ fontWeight: 600 }}>{i + 1}. {q.text}</div>
                    <div className="a-list" style={{ marginTop: 8 }}>
                      {q.answers.map((a, j) => (
                        <div key={j} className={`a-row${a.correct ? ' correct' : ''}`} style={{ padding: '4px 10px' }}>
                          <span style={{ width: 18, fontWeight: 700, color: a.correct ? 'var(--good)' : 'var(--muted)' }}>{a.correct ? '✓' : '·'}</span>
                          <span className="atext">{a.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <ErrorBox error={error} />

        <div className="row">
          {existingCount > 0 && (
            <label className="check">
              <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
              Nahradit stávající otázky ({existingCount}) – jinak se nové přidají na konec
            </label>
          )}
          <span className="spacer" />
          <button className="btn primary" disabled={!ok || busy} onClick={doImport}>
            {busy ? 'Importuji…' : ok ? `Importovat ${result!.questions.length} otázek` : 'Importovat'}
          </button>
        </div>
      </div>

      <div className="card stack" style={{ gap: 12 }}>
        <h3>Formáty</h3>
        <p className="small muted">
          Jedna otázka může mít víc správných odpovědí. CSV může používat oddělovač <span className="mono">;</span>,{' '}
          <span className="mono">,</span> nebo tabulátor (Excel → „Uložit jako CSV“). Hodnoty správnosti: <span className="mono">1 / ano / true / x</span>.
        </p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          <div className="stack" style={{ gap: 8 }}>
            <div className="row"><b>JSON</b><span className="spacer" /><button className="btn sm" onClick={() => download('sablona.json', JSON_TEMPLATE, 'application/json')}>Stáhnout šablonu</button></div>
            <pre className="code">{JSON_TEMPLATE}</pre>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <div className="row"><b>CSV – řádek = otázka</b><span className="spacer" /><button className="btn sm" onClick={() => download('sablona-siroka.csv', CSV_WIDE_TEMPLATE, 'text/csv')}>Stáhnout</button></div>
            <pre className="code">{CSV_WIDE_TEMPLATE}</pre>
            <p className="small muted">Sloupec <span className="mono">correct</span> = písmena (nebo čísla) správných sloupců, např. <span className="mono">A,C</span>.</p>
            <div className="row" style={{ marginTop: 8 }}><b>CSV – řádek = odpověď</b><span className="spacer" /><button className="btn sm" onClick={() => download('sablona-dlouha.csv', CSV_LONG_TEMPLATE, 'text/csv')}>Stáhnout</button></div>
            <pre className="code">{CSV_LONG_TEMPLATE}</pre>
            <p className="small muted">Prázdná buňka otázky = další odpověď k předchozí otázce.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
