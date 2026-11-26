import { cn } from '@/lib/utils'

// ?v= obchází starou ikonu v mezipaměti prohlížeče
export const LOGO_SRC = `${import.meta.env.BASE_URL}favicon.svg?v=2`

export function Logo({ className, size = 'md', compact }: { className?: string; size?: 'md' | 'lg'; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5 font-heading leading-none font-bold tracking-tight', size === 'lg' ? 'text-2xl' : 'text-lg', className)}>
      <img src={LOGO_SRC} alt="" className={cn('block', size === 'lg' ? 'size-9' : 'size-7')} />
      <span className={cn(compact && 'hidden sm:inline')}>Testíky</span>
    </span>
  )
}
