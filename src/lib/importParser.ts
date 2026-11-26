import Papa from 'papaparse'
import type { ImportQuestion, QuestionType } from './types'

export type ParseResult = { questions: ImportQuestion[]; errors: string[]; warnings: string[] }

const TRUTHY = new Set(['1', 'true', 'ano', 'a', 'yes', 'y', 'x', '✓', '✔', 'správně', 'spravne', 'správná', 'spravna', 'ok'])
const isTruthy = (v: unknown) =>
  typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : TRUTHY.has(String(v ?? '').trim().toLowerCase())

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

const MATCH_TYPES = new Set(['match', 'matching', 'prirazovani', 'prirazeni', 'drag', 'dragdrop', 'parovani'])
const parseType = (v: unknown): QuestionType => (MATCH_TYPES.has(norm(String(v ?? ''))) ? 'match' : 'choice')

/** Oddělovač dvojice u přiřazování: "levá položka => možnost". Buňka bez "=>" je matoucí možnost navíc. */
export const PAIR_SEP = '=>'
function splitPair(cell: string): { left: string; right: string } | null {
  const i = cell.indexOf(PAIR_SEP)
  if (i < 0) return null
  return { left: cell.slice(0, i).trim(), right: cell.slice(i + PAIR_SEP.length).trim() }
}

const Q_KEYS = ['question', 'otazka', 'text', 'q']
const A_KEYS = ['answer', 'odpoved']
const C_KEYS = ['correct', 'spravne', 'spravna', 'spravnost', 'iscorrect', 'ok']
const E_KEYS = ['explanation', 'vysvetleni', 'poznamka', 'note']
const T_KEYS = ['type', 'typ']

const blank = (type: QuestionType, text: string, explanation = ''): ImportQuestion => ({
  type,
  text,
  explanation,
  answers: [],
  pairs: [],
  distractors: [],
})

/** Přidá buňku s odpovědí – u přiřazování jako dvojici nebo distraktor. */
function addCell(q: ImportQuestion, cell: string, correct: boolean) {
  if (!cell) return
  if (q.type === 'match') {
    const p = splitPair(cell)
    if (p) q.pairs.push(p)
    else q.distractors.push(cell)
  } else q.answers.push({ text: cell, correct })
}

function validate(questions: ImportQuestion[], errors: string[], warnings: string[]) {
  questions.forEach((q, i) => {
    const label = `Otázka ${i + 1}`
    if (!q.text.trim()) errors.push(`${label}: chybí text otázky.`)
    if (q.type === 'match') {
      if (q.pairs.length < 2) errors.push(`${label} (přiřazování): potřebuje aspoň 2 dvojice ve tvaru "položka ${PAIR_SEP} možnost".`)
      q.pairs.forEach((p, j) => {
        if (!p.left || !p.right) errors.push(`${label}, dvojice ${j + 1}: obě strany kolem "${PAIR_SEP}" musí mít text.`)
      })
    } else {
      if (q.answers.length < 2) warnings.push(`${label}: má méně než 2 odpovědi.`)
      if (!q.answers.some((a) => a.correct)) warnings.push(`${label}: nemá žádnou správnou odpověď.`)
      q.answers.forEach((a, j) => {
        if (!a.text.trim()) errors.push(`${label}, odpověď ${j + 1}: prázdný text.`)
      })
    }
  })
}

// ---------------------------------------------------------------- JSON

/**
 * Výběr odpovědí:
 *   { "question": "...", "answers": [{ "text": "...", "correct": true }, ...] }
 *   { "question": "...", "answers": ["A", "B", "C"], "correct": [1, 3] }     (1 = první, lze i "A","C")
 * Přiřazování:
 *   { "type": "match", "question": "...",
 *     "pairs": [{ "left": "...", "right": "..." }]  nebo  [["levá", "pravá"]]  nebo  { "levá": "pravá" },
 *     "distractors": ["možnost navíc"] }
 * Celé může být i zabalené v { "questions": [...] }.
 */
export function parseJson(input: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  let data: unknown
  try {
    data = JSON.parse(input)
  } catch (e) {
    return { questions: [], errors: [`Neplatný JSON: ${(e as Error).message}`], warnings }
  }
  if (data && typeof data === 'object' && !Array.isArray(data) && Array.isArray((data as { questions?: unknown }).questions)) {
    data = (data as { questions: unknown[] }).questions
  }
  if (!Array.isArray(data)) return { questions: [], errors: ['JSON musí být pole otázek (nebo objekt s klíčem "questions").'], warnings }

  const questions: ImportQuestion[] = []
  data.forEach((raw, i) => {
    if (!raw || typeof raw !== 'object') return errors.push(`Položka ${i + 1} není objekt.`)
    const o = raw as Record<string, unknown>
    const text = String(o.question ?? o.otazka ?? o.text ?? '').trim()
    const explanation = String(o.explanation ?? o.vysvetleni ?? '').trim()
    const type: QuestionType = o.pairs != null ? 'match' : parseType(o.type ?? o.typ)
    const q = blank(type, text, explanation)

    if (type === 'match') {
      const pairs = o.pairs ?? o.dvojice
      if (Array.isArray(pairs)) {
        pairs.forEach((p) => {
          if (Array.isArray(p)) q.pairs.push({ left: String(p[0] ?? '').trim(), right: String(p[1] ?? '').trim() })
          else if (p && typeof p === 'object') {
            const po = p as Record<string, unknown>
            q.pairs.push({ left: String(po.left ?? po.item ?? '').trim(), right: String(po.right ?? po.match ?? po.option ?? '').trim() })
          } else if (typeof p === 'string') addCell(q, p.trim(), false)
        })
      } else if (pairs && typeof pairs === 'object') {
        Object.entries(pairs as Record<string, unknown>).forEach(([l, r]) => q.pairs.push({ left: l.trim(), right: String(r ?? '').trim() }))
      }
      const d = o.distractors ?? o.navic
      if (Array.isArray(d)) d.forEach((x) => String(x ?? '').trim() && q.distractors.push(String(x).trim()))
    } else {
      const rawAnswers = (o.answers ?? o.odpovedi ?? []) as unknown
      if (!Array.isArray(rawAnswers)) return errors.push(`Otázka ${i + 1}: "answers" musí být pole.`)
      const correctList = Array.isArray(o.correct) ? o.correct : o.correct != null && typeof o.correct !== 'boolean' ? [o.correct] : []
      const correctIdx = new Set(
        correctList.map((c) => {
          const s = String(c).trim().toUpperCase()
          return /^[A-Z]$/.test(s) ? s.charCodeAt(0) - 64 : Number(s)
        }),
      )
      rawAnswers.forEach((a, j) => {
        if (a && typeof a === 'object') {
          const ao = a as Record<string, unknown>
          q.answers.push({
            text: String(ao.text ?? ao.answer ?? ao.odpoved ?? '').trim(),
            correct: isTruthy(ao.correct ?? ao.is_correct ?? ao.spravne ?? false) || correctIdx.has(j + 1),
          })
        } else q.answers.push({ text: String(a ?? '').trim(), correct: correctIdx.has(j + 1) })
      })
    }
    questions.push(q)
  })
  validate(questions, errors, warnings)
  return { questions, errors, warnings }
}

// ---------------------------------------------------------------- CSV

/**
 * Oddělovač , ; nebo tabulátor se rozpozná sám. První řádek je hlavička.
 * Volitelný sloupec "type": choice (výchozí) nebo match (přiřazování).
 *
 *  1) "řádek = otázka": question;type;A;B;C;D;…;correct;explanation
 *     - výběr: correct = písmena/čísla správných sloupců ("A,C")
 *     - přiřazování: buňky "položka => možnost", buňka bez "=>" = možnost navíc, correct se ignoruje
 *
 *  2) "řádek = odpověď": question;type;answer;correct;explanation
 *     - prázdná buňka question = další odpověď k předchozí otázce
 */
export function parseCsv(input: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const parsed = Papa.parse<string[]>(input.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  parsed.errors.slice(0, 5).forEach((e) => errors.push(`CSV řádek ${(e.row ?? 0) + 1}: ${e.message}`))
  const rows = parsed.data
  if (rows.length < 2) return { questions: [], errors: [...errors, 'CSV musí mít hlavičku a aspoň jeden řádek.'], warnings }

  const header = rows[0].map((h) => norm(String(h)))
  const find = (keys: string[]) => header.findIndex((h) => keys.includes(h))
  const qi = find(Q_KEYS)
  const ai = find(A_KEYS)
  const ci = find(C_KEYS)
  const ei = find(E_KEYS)
  const ti = find(T_KEYS)
  if (qi < 0) return { questions: [], errors: [...errors, 'V hlavičce chybí sloupec "question" (nebo "otazka").'], warnings }

  const cell = (r: string[], i: number) => (i >= 0 ? String(r[i] ?? '').trim() : '')
  const questions: ImportQuestion[] = []

  // víc sloupců typu answer / answer1 / odpoved2 … = formát "řádek = otázka"
  const answerLike = header.filter((h) => /^(answer|odpoved)\d*$/.test(h)).length
  if (ai >= 0 && answerLike < 2) {
    let current: ImportQuestion | null = null
    rows.slice(1).forEach((r, idx) => {
      const qText = cell(r, qi)
      const expl = cell(r, ei)
      if (qText) {
        current = blank(parseType(cell(r, ti)), qText, expl)
        questions.push(current)
      } else if (!current) {
        errors.push(`Řádek ${idx + 2}: odpověď bez otázky.`)
        return
      }
      if (expl && !current.explanation) current.explanation = expl
      addCell(current, cell(r, ai), isTruthy(cell(r, ci)))
    })
  } else {
    const answerCols = header.map((_, i) => i).filter((i) => ![qi, ci, ei, ti].includes(i))
    rows.slice(1).forEach((r, idx) => {
      const qText = cell(r, qi)
      if (!qText) return
      const q = blank(parseType(cell(r, ti)), qText, cell(r, ei))
      if (q.type === 'choice' && ci < 0) errors.push(`Řádek ${idx + 2}: chybí sloupec "correct" se správnými písmeny.`)
      const tokens = cell(r, ci).toUpperCase().split(/[\s,;|+]+/).filter(Boolean)
      const correctIdx = new Set(tokens.map((t) => (/^[A-Z]$/.test(t) ? t.charCodeAt(0) - 64 : Number(t))))
      answerCols.forEach((col, k) => addCell(q, cell(r, col), correctIdx.has(k + 1)))
      questions.push(q)
    })
  }

  validate(questions, errors, warnings)
  return { questions, errors, warnings }
}

export function parseAuto(input: string, filename?: string): ParseResult {
  const t = input.trim()
  if (filename?.toLowerCase().endsWith('.json') || t.startsWith('[') || t.startsWith('{')) return parseJson(t)
  return parseCsv(input)
}

// ---------------------------------------------------------------- Šablony

export const JSON_TEMPLATE = JSON.stringify(
  [
    {
      question: 'Který protokol šifruje vzdálenou správu zařízení?',
      explanation: 'Telnet posílá vše včetně hesla v čitelné podobě.',
      answers: [
        { text: 'Telnet', correct: false },
        { text: 'SSH', correct: true },
        { text: 'HTTP', correct: false },
      ],
    },
    {
      question: 'Které dvě vlastnosti patří do CIA triády? (Vyber dvě.)',
      answers: ['Důvěrnost', 'Rychlost', 'Integrita', 'Anonymita'],
      correct: [1, 3],
    },
    {
      question: 'Co udělá tato konfigurace?\n```cisco\naccess-list 10 permit 192.168.1.0 0.0.0.255\ninterface g0/1\n ip access-group 10 in\n```',
      answers: [
        { text: 'Na `g0/1` pustí dovnitř jen provoz ze sítě **192.168.1.0/24**', correct: true },
        { text: 'Zablokuje veškerý provoz ze sítě 192.168.1.0/24', correct: false },
      ],
    },
    {
      type: 'match',
      question: 'Přiřaď službu k výchozímu portu.',
      pairs: [
        { left: 'SSH', right: '22' },
        { left: 'DNS', right: '53' },
        { left: 'HTTPS', right: '443' },
      ],
      distractors: ['8080'],
    },
  ],
  null,
  2,
)

export const CSV_WIDE_TEMPLATE = `question;type;A;B;C;D;correct;explanation
Který protokol šifruje vzdálenou správu zařízení?;;Telnet;SSH;HTTP;;B;Telnet posílá vše v čitelné podobě.
Které dvě vlastnosti patří do CIA triády? (Vyber dvě.);;Důvěrnost;Rychlost;Integrita;Anonymita;A,C;
"Co udělá tato konfigurace?
\`\`\`cisco
access-list 10 permit 192.168.1.0 0.0.0.255
interface g0/1
 ip access-group 10 in
\`\`\`";;Na \`g0/1\` pustí dovnitř jen provoz ze sítě **192.168.1.0/24**;Zablokuje veškerý provoz ze sítě 192.168.1.0/24;;;A;
Přiřaď službu k výchozímu portu.;match;SSH => 22;DNS => 53;HTTPS => 443;8080;;
`

export const CSV_LONG_TEMPLATE = `question;type;answer;correct;explanation
Který protokol šifruje vzdálenou správu zařízení?;;Telnet;0;Telnet posílá vše v čitelné podobě.
;;SSH;1;
;;HTTP;0;
Přiřaď službu k výchozímu portu.;match;SSH => 22;;
;;DNS => 53;;
;;HTTPS => 443;;
;;8080;;
`
