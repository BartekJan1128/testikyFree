import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, MoreHorizontal, ShieldCheck, ShieldOff, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Profile } from '@/lib/types'
import { errMsg, fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorAlert, Loading, Page, PageHeader, SearchField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

type TestLite = { id: number; title: string }
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function AdminUsers() {
  const { session } = useAuth()
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [tests, setTests] = useState<TestLite[]>([])
  const [access, setAccess] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('tests').select('id, title').order('created_at', { ascending: false }),
      supabase.from('test_access').select('test_id, user_id'),
    ]).then(([p, t, a]) => {
      const err = p.error || t.error || a.error
      if (err) setError(errMsg(err))
      setUsers((p.data as Profile[]) ?? [])
      setTests((t.data as TestLite[]) ?? [])
      setAccess(new Set((a.data ?? []).map((r: { test_id: number; user_id: string }) => `${r.test_id}:${r.user_id}`)))
    })
  }, [])

  const visible = useMemo(() => {
    const n = norm(query.trim())
    return (users ?? []).filter((u) => !n || norm(`${u.display_name ?? ''} ${u.email}`).includes(n))
  }, [users, query])

  async function toggleAccess(u: Profile, t: TestLite) {
    const key = `${t.id}:${u.id}`
    const has = access.has(key)
    setBusy(key)
    const { error } = has
      ? await supabase.from('test_access').delete().eq('test_id', t.id).eq('user_id', u.id)
      : await supabase.from('test_access').insert({ test_id: t.id, user_id: u.id })
    setBusy(null)
    if (error) return toast.error(errMsg(error))
    setAccess((s) => {
      const n = new Set(s)
      if (has) n.delete(key)
      else n.add(key)
      return n
    })
  }

  async function setAdmin(u: Profile, next: boolean) {
    setBusy(`admin:${u.id}`)
    const { error } = await supabase.rpc('set_user_admin', { p_user_id: u.id, p_is_admin: next })
    setBusy(null)
    if (error) return toast.error(errMsg(error))
    setUsers((list) => list && list.map((x) => (x.id === u.id ? { ...x, is_admin: next } : x)))
    toast.success(next ? `${u.display_name || u.email} je teď admin` : `${u.display_name || u.email} už není admin`)
  }

  if (!users) return <Loading />

  return (
    <Page>
      <PageHeader
        back={<Link to="/admin" className="hover:text-foreground">Administrace</Link>}
        title="Uživatelé"
        description="Kliknutím na test u uživatele mu přístup přidáš nebo odebereš."
      />
      <SearchField value={query} onChange={setQuery} placeholder="Hledat podle jména nebo e-mailu" className="mb-5 max-w-md" />
      <ErrorAlert error={error} className="mb-5" />
      {visible.length === 0 ? (
        <EmptyState icon={UserX} title="Nikdo takový tu není" />
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {visible.map((u) => (
            <div key={u.id} className="flex flex-col gap-3 p-5 md:flex-row md:items-start md:gap-6">
              <div className="min-w-0 md:w-64 md:shrink-0">
                <div className="flex items-center gap-2 font-medium">
                  <span className="truncate">{u.display_name || 'Bez jména'}</span>
                  {u.is_admin && <Badge variant="secondary">admin</Badge>}
                </div>
                <div className="truncate text-sm text-muted-foreground">{u.email}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">registrace {fmtDate(u.created_at)}</div>
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {u.is_admin ? (
                  <span className="text-sm text-muted-foreground">Admin vidí všechny testy.</span>
                ) : tests.length === 0 ? (
                  <span className="text-sm text-muted-foreground">Zatím neexistuje žádný test.</span>
                ) : (
                  tests.map((t) => {
                    const key = `${t.id}:${u.id}`
                    const on = access.has(key)
                    return (
                      <button
                        key={t.id}
                        disabled={busy === key}
                        onClick={() => toggleAccess(u, t)}
                        aria-pressed={on}
                        className={cn(
                          'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-60',
                          on ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                        )}
                      >
                        {on && <Check className="size-3.5" strokeWidth={3} />}
                        {t.title}
                      </button>
                    )
                  })
                )}
              </div>
              {u.id !== session?.user.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Další akce" disabled={busy !== null} className="self-start">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {u.is_admin ? (
                      <DropdownMenuItem onSelect={() => setAdmin(u, false)}><ShieldOff /> Odebrat roli admina</DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onSelect={() => setAdmin(u, true)}><ShieldCheck /> Udělat adminem</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
