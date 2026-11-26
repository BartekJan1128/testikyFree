import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Play, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import { errMsg, fmtDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { EmptyState, ErrorAlert, Loading, Page, PageHeader, Score } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type Row = {
  user_id: string
  display_name: string | null
  best_pct: number
  best_correct: number
  total_count: number
  attempts_count: number
  last_at: string
}

export default function Leaderboard() {
  const { id } = useParams()
  const { session } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const testId = Number(id)
    supabase.from('tests').select('title').eq('id', testId).maybeSingle().then(({ data }) => setTitle(data?.title ?? ''))
    supabase.rpc('get_leaderboard', { p_test_id: testId }).then(({ data, error }) => {
      if (error) setError(errMsg(error))
      setRows(
        ((data as Row[]) ?? []).sort(
          (a, b) => Number(b.best_pct) - Number(a.best_pct) || new Date(a.last_at).getTime() - new Date(b.last_at).getTime(),
        ),
      )
    })
  }, [id])

  if (!rows) return <Loading />

  return (
    <Page narrow>
      <PageHeader
        back={<Link to="/" className="hover:text-foreground">Testy</Link>}
        title={title ? `Žebříček: ${title}` : 'Žebříček'}
        description="Každému se počítá jeho nejlepší pokus. Při shodě vede ten, kdo to zvládl dřív."
        actions={<Button asChild><Link to={`/test/${id}`}><Play /> Spustit test</Link></Button>}
      />
      <ErrorAlert error={error} className="mb-6" />
      {rows.length === 0 ? (
        <EmptyState icon={Trophy} title="Zatím nikdo nesoutěžil">Odevzdej test jako první a obsaď první místo.</EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 pl-5">Pořadí</TableHead>
                <TableHead>Hráč</TableHead>
                <TableHead className="text-right">Nejlepší</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Pokusů</TableHead>
                <TableHead className="hidden md:table-cell">Naposledy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => {
                const me = r.user_id === session?.user.id
                return (
                  <TableRow key={r.user_id} className={cn(me && 'bg-accent/50 hover:bg-accent/60')}>
                    <TableCell className="pl-5">
                      <span
                        className={cn(
                          'font-heading inline-grid size-8 place-items-center rounded-full text-sm font-bold tabular-nums',
                          i === 0 ? 'bg-highlight text-highlight-foreground' : i < 3 ? 'bg-muted text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {i + 1}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.display_name || 'Bez jména'}
                      {me && <Badge variant="secondary" className="ml-2">ty</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Score pct={r.best_pct} />
                      <span className="ml-2 text-xs text-muted-foreground tabular-nums">{r.best_correct}/{r.total_count}</span>
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{r.attempts_count}</TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(r.last_at)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Page>
  )
}
