import { Fragment, type ReactNode } from 'react'
import { SquareTerminal } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Jednoduchý formátovaný text (bez HTML, bezpečný):
 *   ```               blok kódu (volitelně ```cisco, ```bash … – název se ukáže v hlavičce)
 *   `kód`             kód v řádku
 *   **tučně**         tučné písmo
 * Konce řádků se zachovají.
 */

const FENCE = /```([^\n`]*)\n?([\s\S]*?)```/g

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /`([^`\n]+)`|\*\*([^*\n]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] != null)
      out.push(
        <code key={`${keyBase}-${i++}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.88em] text-foreground">
          {m[1]}
        </code>,
      )
    else out.push(<strong key={`${keyBase}-${i++}`} className="font-semibold">{m[2]}</strong>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="my-3 overflow-hidden rounded-lg border bg-muted/60 text-left">
      <div className="flex items-center gap-1.5 border-b bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <SquareTerminal className="size-3.5" />
        {lang || 'Terminal'}
      </div>
      <pre className="overflow-x-auto px-4 py-3 font-mono text-[0.85rem] leading-relaxed font-normal text-foreground">
        <code>{code.replace(/\n$/, '')}</code>
      </pre>
    </div>
  )
}

export function RichText({ text, className, as: Tag = 'div' }: { text: string; className?: string; as?: 'div' | 'span' }) {
  if (!text) return null
  const parts: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  FENCE.lastIndex = 0
  while ((m = FENCE.exec(text))) {
    const before = text.slice(last, m.index).replace(/\n$/, '')
    if (before) parts.push(<Fragment key={`t${i}`}>{inline(before, `t${i}`)}</Fragment>)
    parts.push(<CodeBlock key={`c${i}`} code={m[2]} lang={m[1].trim()} />)
    last = FENCE.lastIndex
    i++
  }
  const rest = text.slice(last).replace(/^\n/, '')
  if (rest) parts.push(<Fragment key="rest">{inline(rest, 'rest')}</Fragment>)
  return <Tag className={cn('whitespace-pre-wrap', className)}>{parts}</Tag>
}

/** Prostý text pro náhledy a hledání (bez značek). */
export function plainText(text: string) {
  return text.replace(/```[^\n`]*\n?/g, '').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1')
}
