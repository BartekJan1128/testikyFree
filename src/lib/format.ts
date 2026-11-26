export const fmtDate = (s: string | null | undefined) =>
  s
    ? new Date(s).toLocaleString('cs-CZ', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '–'

export const fmtPct = (n: number | null | undefined) =>
  n == null ? '–' : `${Math.round(Number(n))} %`

export function fmtDuration(from: string | null, to: string | null) {
  if (!from || !to) return null
  const sec = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) return `${Math.floor(m / 60)} h ${m % 60} min`
  return m ? `${m} min ${s} s` : `${s} s`
}

export function scoreTone(pct: number | null | undefined) {
  if (pct == null) return 'neutral'
  if (pct >= 85) return 'good'
  if (pct >= 50) return 'mid'
  return 'bad'
}

export function errMsg(e: unknown) {
  if (!e) return 'Neznámá chyba'
  if (typeof e === 'string') return e
  if (typeof e === 'object' && e && 'message' in e) return String((e as { message: unknown }).message)
  return String(e)
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
