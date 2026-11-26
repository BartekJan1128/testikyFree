import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

const navCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    'relative rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
    isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
  )

function NavItem({ to, end, children }: { to: string; end?: boolean; children: ReactNode }) {
  return (
    <NavLink to={to} end={end} className={navCls}>
      {({ isActive }) => (
        <>
          {children}
          {isActive && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-primary" />}
        </>
      )}
    </NavLink>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, session, signOut } = useAuth()
  const name = profile?.display_name || session?.user.email || ''
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-[52px] max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link to="/" className="shrink-0">
            <Logo />
          </Link>
          <nav className="-mx-1 flex flex-1 items-center gap-0.5 overflow-x-auto">
            <NavItem to="/" end>Testy</NavItem>
            <NavItem to="/history">Historie</NavItem>
            {profile?.is_admin && <NavItem to="/admin">Administrace</NavItem>}
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 gap-2 px-1.5" aria-label="Účet">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-primary text-[11px] font-semibold text-primary-foreground">{initials(name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-36 truncate text-sm sm:inline">{name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="truncate font-medium text-foreground">{profile?.display_name}</div>
                  <div className="truncate text-xs text-muted-foreground">{session?.user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut}>
                  <LogOut /> Odhlásit se
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  )
}
