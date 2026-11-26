import { cn } from '@/lib/utils'

export function Logo({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-heading font-bold tracking-tight', size === 'lg' ? 'text-2xl' : 'text-lg', className)}>
      <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className={size === 'lg' ? 'size-9' : 'size-7'} />
      Testíky
    </span>
  )
}
