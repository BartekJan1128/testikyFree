import { useState, type ReactNode } from 'react'
import { Loader2, Search, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPct, scoreTone } from '@/lib/format'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CircleAlert } from 'lucide-react'

/** Jednotná šířka všech stránek. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full px-4 pt-8 pb-20 sm:px-6', 'max-w-6xl', className)}>{children}</div>
}

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: ReactNode
  description?: ReactNode
  back?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 space-y-1.5">
        {back && <div className="mb-3 text-sm text-muted-foreground">{back}</div>}
        <h1 className="text-[1.75rem] leading-tight font-bold sm:text-[2rem]">{title}</h1>
        {description && <p className="max-w-2xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Loading({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center text-muted-foreground">
      <div className="flex items-center gap-2.5 text-sm">
        <Loader2 className="size-4 animate-spin" />
        {label ?? 'Načítám'}
      </div>
    </div>
  )
}

export function ErrorAlert({ error, className }: { error: string | null | undefined; className?: string }) {
  if (!error) return null
  return (
    <Alert variant="destructive" className={className}>
      <CircleAlert />
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon
  title: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      )}
      <h3 className="text-lg font-semibold">{title}</h3>
      {children && <div className="mt-1.5 max-w-md text-sm text-muted-foreground">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

const toneClass = {
  good: 'text-success',
  mid: 'text-warning',
  bad: 'text-destructive',
  neutral: 'text-muted-foreground',
}

export function Score({ pct, className }: { pct: number | null | undefined; className?: string }) {
  return <span className={cn('font-semibold tabular-nums', toneClass[scoreTone(pct)], className)}>{fmtPct(pct)}</span>
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <div className={cn('relative min-w-56 flex-1', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 pl-9" />
    </div>
  )
}

export function QuestionId({ id, className }: { id: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex h-5 items-center rounded-md bg-muted px-1.5 text-xs font-medium tabular-nums text-muted-foreground', className)}
      title="ID otázky"
    >
      ID {id}
    </span>
  )
}

/** Potvrzovací dialog místo window.confirm */
export function Confirm({
  trigger,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description?: ReactNode
  confirmLabel: string
  destructive?: boolean
  onConfirm: () => unknown
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <AlertDialog open={open} onOpenChange={(o) => !busy && setOpen(o)}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Zrušit</AlertDialogCancel>
          <AlertDialogAction
            variant={destructive ? 'destructive' : 'default'}
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault()
              setBusy(true)
              try {
                await onConfirm()
                setOpen(false)
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium tabular-nums">{children}</div>
    </div>
  )
}
