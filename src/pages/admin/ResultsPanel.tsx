import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, Trash2, Trophy } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Attempt } from '@/lib/types'
import { errMsg, fmtDate, fmtDuration } from '@/lib/format'
import { Confirm, EmptyState, ErrorAlert, Loading, Score, Stat } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function ResultsPanel({ testId }: { testId: number }) {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Attempt[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('attempts')
      .select('*, profiles(display_name, email)')
      .eq('test_id', testId)
      .order('finished_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) setError(errMsg(error))
        setRows((data as Attempt[]) ?? [])
      })
  }, [testId])

  async function del(a: Attempt) {
    const { error } = await supabase.from('attempts').delete().eq('id', a.id)
    if (error) return toast.error(errMsg(error))
    setRows((r) => r && r.filter((x) => x.id !== a.id))
    toast.success('Pokus smazán')
  }

  if (!rows) return <Loading />
  if (rows.length === 0) return <EmptyState icon={BarChart3} title="Test zatím nikdo neodevzdal">Pokusy se tu objeví hned po odevzdání.</EmptyState>

  const avg = rows.reduce((s, r) => s + Number(r.score_pct), 0) / rows.length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-10 rounded-xl border bg-card px-5 py-4">
        <Stat label="Pokusů">{rows.length}</Stat>
        <Stat label="Hráčů">{new Set(rows.map((r) => r.user_id)).size}</Stat>
        <Stat label="Průměr"><Score pct={avg} /></Stat>
        <Button variant="outline" size="sm" asChild className="ml-auto">
          <Link to={`/leaderboard/${testId}`}><Trophy /> Žebříček</Link>
        </Button>
      </div>
      <ErrorAlert error={error} />
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-5">Uživatel</TableHead>
              <TableHead className="text-right">Výsledek</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Správně</TableHead>
              <TableHead className="hidden text-right md:table-cell">Čas</TableHead>
              <TableHead className="hidden md:table-cell">Odevzdáno</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/attempt/${r.id}`)}>
                <TableCell className="pl-5">
                  <div className="font-medium">{r.profiles?.display_name}</div>
                  <div className="text-xs text-muted-foreground">{r.profiles?.email}</div>
                </TableCell>
                <TableCell className="text-right"><Score pct={r.score_pct} /></TableCell>
                <TableCell className="hidden text-right tabular-nums text-muted-foreground sm:table-cell">{r.correct_count}/{r.total_count}</TableCell>
                <TableCell className="hidden text-right text-muted-foreground md:table-cell">{fmtDuration(r.started_at, r.finished_at) ?? '–'}</TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(r.finished_at)}</TableCell>
                <TableCell className="pr-3" onClick={(e) => e.stopPropagation()}>
                  <Confirm
                    trigger={<Button variant="ghost" size="icon-sm" aria-label="Smazat pokus" className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>}
                    title="Smazat tenhle pokus?"
                    description={`${r.profiles?.display_name}, ${Math.round(r.score_pct)} %, ${fmtDate(r.finished_at)}. Zmizí i z historie a žebříčku.`}
                    confirmLabel="Smazat"
                    destructive
                    onConfirm={() => del(r)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
