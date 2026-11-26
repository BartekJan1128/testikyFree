import { Fragment, useState, type ReactNode } from 'react'
import { SquareTerminal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

/**
 * Jednoduchý formátovaný text (bez HTML, bezpečný):
 *   ```               blok kódu (volitelně ```cisco, ```bash … – název se ukáže v hlavičce)
 *   `kód`             kód v řádku
 *   **tučně**         tučné písmo
 *   ![popis](https://…)  obrázek (kliknutím se zvětší)
 * Konce řádků se zachovají.
 */

const FENCE = /```([^\n`]*)\n?([\s\S]*?)```/g
const INLINE = /!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)|`([^`\n]+)`|\*\*([^*\n]+)\*\*/g

export function ZoomImage({ src, alt, className }: { src: string; alt?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {/* span místo button – obrázek může být uvnitř tlačítka s odpovědí */}
      <span
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn('my-2 block w-fit max-w-full cursor-zoom-in overflow-hidden rounded-lg border bg-white', className)}
        title="Zvětšit"
      >
        <img src={src} alt={alt ?? ''} loading="lazy" className="block max-h-80 w-auto max-w-full object-contain" />
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-auto max-w-[min(96vw,1400px)] p-2 sm:max-w-[min(96vw,1400px)]">
          <DialogTitle className="sr-only">{alt || 'Obrázek'}</DialogTitle>
          <img src={src} alt={alt ?? ''} className="max-h-[88vh] w-auto max-w-full rounded-md bg-white object-contain" />
        </DialogContent>
      </Dialog>
    </>
  )
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  INLINE.lastIndex = 0
  while ((m = INLINE.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const key = `${keyBase}-${i++}`
    if (m[2] != null) out.push(<ZoomImage key={key} src={m[2]} alt={m[1]} />)
    else if (m[3] != null)
      out.push(
        <code key={key} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.88em] text-foreground">
          {m[3]}
        </code>,
      )
    else out.push(<strong key={key} className="font-semibold">{m[4]}</strong>)
    last = INLINE.lastIndex
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
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[obrázek]')
    .replace(/```[^\n`]*\n?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
}
