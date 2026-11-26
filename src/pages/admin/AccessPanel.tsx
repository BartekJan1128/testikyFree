import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'
import { errMsg, fmtDate } from '@/lib/format'
import { ErrorAlert, Loading, SearchField } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default function AccessPanel({ testId, onCountChange }: { testId: number; onCountChange: (n: number) => void }) {
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [granted, setGranted] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('test_access').select('user_id').eq('test_id', testId),
    ]).then(([p, a]) => {
      if (p.error || a.error) setError(errMsg(p.error || a.error))
      setUsers((p.data as Profile[]) ?? [])
      setGranted(new Set((a.data ?? []).map((r: { user_id: string }) => r.user_id)))
    })
  }, [testId])

  useEffect(() => onCountChange(granted.size), [granted, onCountChange])

  const visible = useMemo(() => {
    const n = norm(query.trim())
    return (users ?? []).filter((u) => !n || norm(`${u.display_name ?? ''} ${u.email}`).includes(n))
  }, [users, query])

  async function toggle(u: Profile) {
    setBusy(u.id)
    const has = granted.has(u.id)
    const { error } = has
      ? await supabase.from('test_access').delete().eq('test_id', testId).eq('user_id', u.id)
      : await supabase.from('test_access').insert({ test_id: testId, user_id: u.id })
    setBusy(null)
    if (error) return toast.error(errMsg(error))
    setGranted((g) => {
      const n = new Set(g)
      if (has) n.delete(u.id)
      else n.add(u.id)
      return n
    })
  }

  async function bulk(grant: boolean) {
    const targets = visible.filter((u) => !u.is_admin && granted.has(u.id) !== grant)
    if (!targets.length) return
    setBusy('bulk')
    const { error } = grant
      ? await supabase.from('test_access').insert(targets.map((u) => ({ test_id: testId, user_id: u.id })))
      : await supabase.from('test_access').delete().eq('test_id', testId).in('user_id', targets.map((u) => u.id))
    setBusy(null)
    if (error) return toast.error(errMsg(error))
    setGranted((g) => {
      const n = new Set(g)
      targets.forEach((u) => (grant ? n.add(u.id) : n.delete(u.id)))
      return n
    })
    toast.success(grant ? `Přístup přidán ${targets.length} uživatelům` : `Přístup odebrán ${targets.length} uživatelům`)
  }

  if (!users) return <Loading />

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchField value={query} onChange={setQuery} placeholder="Hledat podle jména nebo e-mailu" />
        <Button variant="outline" disabled={busy !== null} onClick={() => bulk(true)}>Povolit {query ? 'nalezeným' : 'všem'}</Button>
        <Button variant="ghost" disabled={busy !== null} onClick={() => bulk(false)}>Odebrat {query ? 'nalezeným' : 'všem'}</Button>
      </div>
      <p className="text-sm text-muted-foreground">Bez přístupu uživatel test neuvidí. Admini vidí všechny testy automaticky.</p>
      <ErrorAlert error={error} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Uživatel</TableHead>
              <TableHead className="hidden md:table-cell">Registrace</TableHead>
              <TableHead className="pr-5 text-right">Přístup</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="pl-5">
                  <div className="font-medium">
                    {u.display_name || 'Bez jména'}
                    {u.is_admin && <Badge variant="secondary" className="ml-2">admin</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(u.created_at)}</TableCell>
                <TableCell className="pr-5 text-right">
                  {u.is_admin ? (
                    <span className="text-sm text-muted-foreground">vždy</span>
                  ) : (
                    <Switch
                      checked={granted.has(u.id)}
                      disabled={busy !== null}
                      onCheckedChange={() => toggle(u)}
                      aria-label={`Přístup pro ${u.display_name || u.email}`}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">Nikdo takový tu není.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
