import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, FilePlus2, Loader2, Plus, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errMsg, fmtDate } from '@/lib/format'
import { EmptyState, ErrorAlert, Loading, Page, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Row = {
  id: number
  title: string
  description: string
  is_published: boolean
  created_at: string
  questions: { count: number }[]
  test_access: { count: number }[]
}

export default function AdminTests() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('tests')
      .select('id, title, description, is_published, created_at, questions(count), test_access(count)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errMsg(error))
        setRows((data as Row[]) ?? [])
      })
  }, [])

  async function create(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { data, error } = await supabase.from('tests').insert({ title: title.trim(), description: description.trim() }).select('id').single()
    setBusy(false)
    if (error) return setError(errMsg(error))
    navigate(`/admin/tests/${data.id}?tab=import`)
  }

  if (!rows) return <Loading />

  return (
    <Page>
      <PageHeader
        title="Administrace"
        description="Vytvářej testy, nahrávej do nich otázky a rozhoduj, kdo je uvidí."
        actions={
          <>
            <Button variant="outline" asChild><Link to="/admin/users"><Users /> Uživatelé</Link></Button>
            <Button onClick={() => setCreating(true)}><Plus /> Nový test</Button>
          </>
        }
      />
      <ErrorAlert error={error} className="mb-6" />

      {rows.length === 0 ? (
        <EmptyState icon={FilePlus2} title="Zatím žádný test" action={<Button onClick={() => setCreating(true)}><Plus /> Vytvořit první test</Button>}>
          Test pojmenuješ a pak do něj nahraješ otázky z JSON nebo CSV.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Test</TableHead>
                <TableHead className="text-right">Otázek</TableHead>
                <TableHead className="text-right">Přístup</TableHead>
                <TableHead className="hidden sm:table-cell">Stav</TableHead>
                <TableHead className="hidden md:table-cell">Vytvořen</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id} className="cursor-pointer" onClick={() => navigate(`/admin/tests/${t.id}`)}>
                  <TableCell className="max-w-md pl-5 whitespace-normal">
                    <div className="font-medium">{t.title}</div>
                    {t.description && <div className="line-clamp-1 text-xs text-muted-foreground">{t.description}</div>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.questions[0]?.count ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{t.test_access[0]?.count ?? 0}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {t.is_published ? <Badge variant="secondary">Aktivní</Badge> : <Badge variant="outline">Skrytý</Badge>}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(t.created_at)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground"><ChevronRight className="size-4" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <form onSubmit={create} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Nový test</DialogTitle>
              <DialogDescription>Po vytvoření se otevře import otázek.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="t-title">Název</Label>
              <Input id="t-title" autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Biologie: buňka" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-desc">Popis <span className="font-normal text-muted-foreground">(nepovinné)</span></Label>
              <Textarea id="t-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Zrušit</Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                {busy && <Loader2 className="animate-spin" />} Vytvořit test
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  )
}
