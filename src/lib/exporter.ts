import type { ImportQuestion, Question } from './types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/** Převede otázky z databáze do stejného tvaru, jaký přijímá import. */
export function toImportShape(questions: Question[]): ImportQuestion[] {
  return questions.map((q) => {
    const answers = [...q.answers].sort((a, b) => a.position - b.position || a.id - b.id)
    if (q.type === 'match')
      return {
        type: 'match',
        text: q.text,
        explanation: q.explanation,
        answers: [],
        pairs: answers.filter((a) => a.text).map((a) => ({ left: a.text, right: a.match_text ?? '' })),
        distractors: answers.filter((a) => !a.text && a.match_text).map((a) => a.match_text!),
      }
    return {
      type: 'choice',
      text: q.text,
      explanation: q.explanation,
      answers: answers.map((a) => ({ text: a.text, correct: a.is_correct })),
      pairs: [],
      distractors: [],
    }
  })
}

/** JSON ve formátu importu (pole otázek). */
export function exportJson(questions: Question[]): string {
  const data = toImportShape(questions).map((q) =>
    q.type === 'match'
      ? {
          type: 'match',
          question: q.text,
          ...(q.explanation ? { explanation: q.explanation } : {}),
          pairs: q.pairs,
          ...(q.distractors.length ? { distractors: q.distractors } : {}),
        }
      : {
          question: q.text,
          ...(q.explanation ? { explanation: q.explanation } : {}),
          answers: q.answers,
        },
  )
  return JSON.stringify(data, null, 2)
}

/** Buňka CSV – do uvozovek, když obsahuje oddělovač, uvozovku nebo nový řádek. */
function cell(v: string, sep: string) {
  const s = v ?? ''
  return s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV „řádek = otázka“ se středníkem (stejný formát jako import). */
export function exportCsv(questions: Question[], sep = ';'): string {
  const rows = toImportShape(questions)
  const width = Math.max(4, ...rows.map((q) => (q.type === 'match' ? q.pairs.length + q.distractors.length : q.answers.length)))
  const cols = Math.min(width, LETTERS.length)
  const header = ['question', 'type', ...LETTERS.slice(0, cols).split(''), 'correct', 'explanation']
  const lines = [header.join(sep)]
  for (const q of rows) {
    let cells: string[]
    let type: string
    let correct = ''
    if (q.type === 'match') {
      type = 'match'
      cells = [...q.pairs.map((p) => `${p.left} => ${p.right}`), ...q.distractors]
    } else {
      const n = q.answers.filter((a) => a.correct).length
      type = n > 1 ? 'multiple' : 'single'
      cells = q.answers.map((a) => a.text)
      correct = q.answers.map((a, i) => (a.correct ? LETTERS[i] : '')).filter(Boolean).join(',')
    }
    const padded = Array.from({ length: cols }, (_, i) => cells[i] ?? '')
    lines.push([q.text, type, ...padded, correct, q.explanation ?? ''].map((c) => cell(c, sep)).join(sep))
  }
  return lines.join('\r\n') + '\r\n'
}

export function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([type.includes('csv') ? '﻿' + content : content], { type: `${type};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const fileSlug = (title: string) =>
  title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'test'
