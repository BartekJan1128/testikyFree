import Papa from 'papaparse'
import type { ImportQuestion } from './types'

export type ParseResult = { questions: ImportQuestion[]; errors: string[]; warnings: string[] }

const TRUTHY = new Set(['1', 'true', 'ano', 'a', 'yes', 'y', 'x', '✓', '✔', 'správně', 'spravne', 'správná', 'spravna', 'ok'])
const isTruthy = (v: unknown) =>
  typeof v === 'boolean' ? v : typeof v === 'number' ? v !== 0 : TRUTHY.has(String(v ?? '').trim().toLowerCase())

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')

const Q_KEYS = ['question', 'otazka', 'text', 'q']
const A_KEYS = ['answer', 'odpoved', 'a']
const C_KEYS = ['correct', 'spravne', 'spravna', 'spravnost', 'iscorrect', 'ok']
const E_KEYS = ['explanation', 'vysvetleni', 'poznamka', 'note']

function validate(questions: ImportQuestion[], errors: string[], warnings: string[]) {
  questions.forEach((q, i) => {
    const label = `Otázka ${i + 1}`
    if (!q.text.trim()) errors.push(`${label}: chybí text otázky.`)
    if (q.answers.length < 2) warnings.push(`${label}: má méně než 2 odpovědi.`)
    if (!q.answers.some((a) => a.correct)) warnings.push(`${label}: nemá žádnou správnou odpověď.`)
    q.answers.forEach((a, j) => {
      if (!a.text.trim()) errors.push(`${label}, odpověď ${j + 1}: prázdný text.`)
    })
  })
}

// ---------------------------------------------------------------- JSON

/**
 * Podporované tvary:
 *  [{ "question": "...", "explanation": "...", "answers": [{ "text": "...", "correct": true }] }]
 *  [{ "question": "...", "answers": ["A", "B", "C"], "correct": [1, 3] }]   (1 = první odpověď, lze i "A","C")
 *  { "questions": [ ... ] }
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
    if (!raw || typeof raw !== 'object') {
      errors.push(`Položka ${i + 1} není objekt.`)
      return
    }
    const o = raw as Record<string, unknown>
    const text = String(o.question ?? o.otazka ?? o.text ?? '').trim()
    const explanation = String(o.explanation ?? o.vysvetleni ?? '').trim()
    const rawAnswers = (o.answers ?? o.odpovedi ?? []) as unknown
    if (!Array.isArray(rawAnswers)) {
      errors.push(`Otázka ${i + 1}: "answers" musí být pole.`)
      return
    }
    const correctList = Array.isArray(o.correct) ? o.correct : o.correct != null && typeof o.correct !== 'boolean' ? [o.correct] : []
    const correctIdx = new Set(
      correctList.map((c) => {
        const s = String(c).trim().toUpperCase()
        return /^[A-Z]$/.test(s) ? s.charCodeAt(0) - 64 : Number(s)
      }),
    )
    const answers = rawAnswers.map((a, j) => {
      if (a && typeof a === 'object') {
        const ao = a as Record<string, unknown>
        return {
          text: String(ao.text ?? ao.answer ?? ao.odpoved ?? '').trim(),
          correct: isTruthy(ao.correct ?? ao.is_correct ?? ao.spravne ?? false) || correctIdx.has(j + 1),
        }
      }
      return { text: String(a ?? '').trim(), correct: correctIdx.has(j + 1) }
    })
    questions.push({ text, explanation, answers })
  })
  validate(questions, errors, warnings)
  return { questions, errors, warnings }
}

// ---------------------------------------------------------------- CSV

/**
 * Dva formáty (oddělovač , ; nebo tab se rozpozná automaticky, první řádek = hlavička):
 *
 *  1) "dlouhý" – jeden řádek = jedna odpověď
 *     question;answer;correct;explanation
 *     Kolik je 2+2?;3;0;
 *     ;4;1;            <- prázdná otázka = pokračování předchozí
 *
 *  2) "široký" – jeden řádek = jedna otázka
 *     question;A;B;C;D;correct;explanation
 *     Kolik je 2+2?;3;4;5;;B;
 *     (correct = písmena nebo čísla sloupců odpovědí, více oddělte čárkou/mezerou: "A,C" / "1 3")
 */
export function parseCsv(input: string): ParseResult {
  const errors: string[] = []
  const warnings: string[] = []
  const parsed = Papa.parse<string[]>(input.replace(/^﻿/, ''), { skipEmptyLines: 'greedy' })
  if (parsed.errors.length) {
    parsed.errors.slice(0, 5).forEach((e) => errors.push(`CSV řádek ${(e.row ?? 0) + 1}: ${e.message}`))
  }
  const rows = parsed.data
  if (rows.length < 2) return { questions: [], errors: [...errors, 'CSV musí mít hlavičku a alespoň jeden řádek.'], warnings }

  const header = rows[0].map((h) => norm(String(h)))
  const find = (keys: string[]) => header.findIndex((h) => keys.includes(h))
  const qi = find(Q_KEYS)
  const ai = find(A_KEYS)
  const ci = find(C_KEYS)
  const ei = find(E_KEYS)
  if (qi < 0) return { questions: [], errors: [...errors, 'V hlavičce chybí sloupec "question" (nebo "otazka").'], warnings }

  const questions: ImportQuestion[] = []

  if (ai >= 0) {
    // dlouhý formát
    let current: ImportQuestion | null = null
    rows.slice(1).forEach((r, idx) => {
      const qText = String(r[qi] ?? '').trim()
      const aText = String(r[ai] ?? '').trim()
      const expl = ei >= 0 ? String(r[ei] ?? '').trim() : ''
      if (qText && (!current || current.text !== qText)) {
        current = { text: qText, explanation: expl, answers: [] }
        questions.push(current)
      } else if (!current) {
        errors.push(`Řádek ${idx + 2}: odpověď bez otázky.`)
        return
      }
      if (expl && !current.explanation) current.explanation = expl
      if (aText) current.answers.push({ text: aText, correct: ci >= 0 ? isTruthy(r[ci]) : false })
    })
  } else {
    // široký formát – všechny ostatní sloupce jsou odpovědi
    const answerCols = header.map((_, i) => i).filter((i) => i !== qi && i !== ci && i !== ei)
    if (ci < 0) errors.push('Ve širokém formátu je potřeba sloupec "correct" (např. "A,C").')
    rows.slice(1).forEach((r) => {
      const qText = String(r[qi] ?? '').trim()
      if (!qText) return
      const tokens = String(ci >= 0 ? r[ci] ?? '' : '')
        .toUpperCase()
        .split(/[\s,;|+]+/)
        .filter(Boolean)
      const correctIdx = new Set(tokens.map((t) => (/^[A-Z]$/.test(t) ? t.charCodeAt(0) - 64 : Number(t))))
      const answers: ImportQuestion['answers'] = []
      answerCols.forEach((col, k) => {
        const t = String(r[col] ?? '').trim()
        if (t) answers.push({ text: t, correct: correctIdx.has(k + 1) })
      })
      questions.push({ text: qText, explanation: ei >= 0 ? String(r[ei] ?? '').trim() : '', answers })
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
      question: 'Jaké je hlavní město Francie?',
      explanation: 'Paříž je hlavním městem od roku 987.',
      answers: [
        { text: 'Lyon', correct: false },
        { text: 'Paříž', correct: true },
        { text: 'Marseille', correct: false },
      ],
    },
    {
      question: 'Která z čísel jsou prvočísla?',
      answers: ['2', '4', '7', '9'],
      correct: [1, 3],
    },
  ],
  null,
  2,
)

export const CSV_LONG_TEMPLATE = `question;answer;correct;explanation
Jaké je hlavní město Francie?;Lyon;0;Paříž je hlavním městem od roku 987.
;Paříž;1;
;Marseille;0;
Která z čísel jsou prvočísla?;2;1;
;4;0;
;7;1;
;9;0;
`

export const CSV_WIDE_TEMPLATE = `question;A;B;C;D;correct;explanation
Jaké je hlavní město Francie?;Lyon;Paříž;Marseille;;B;Paříž je hlavním městem od roku 987.
Která z čísel jsou prvočísla?;2;4;7;9;A,C;
`
