import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRight, History as HistoryIcon } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { Attempt } from '@/lib/types'
import { errMsg, fmtDate, fmtDuration } from '@/lib/format'
import { EmptyState, ErrorAlert, Loading, Page, PageHeader, Score } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function History() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState<Attempt[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('attempts')
      .select('*')
      .eq('user_id', session!.user.id)
      .order('finished_at', { ascending: false })
      .limit(200)
      .then(({ data, error }) => {
        if (error) setError(errMsg(error))
        setRows((data as Attempt[]) ?? [])
      })
  }, [session])

  if (!rows) return <Loading />

  return (
    <Page>
      <PageHeader title="Historie" description="Otevři pokus a projdi si chyby. Otázky v něm najdeš i podle ID." />
      <ErrorAlert error={error} className="mb-6" />
      {rows.length === 0 ? (
        <EmptyState icon={HistoryIcon} title="Zatím žádné pokusy" action={<Button asChild><Link to="/">Vybrat test</Link></Button>}>
          Každý odevzdaný test se tady uloží i s tvými odpověďmi.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-5">Test</TableHead>
                <TableHead className="text-right">Výsledek</TableHead>
                <TableHead className="text-right">Správně</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Čas</TableHead>
                <TableHead className="hidden md:table-cell">Odevzdáno</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/attempt/${r.id}`)}>
                  <TableCell className="pl-5 font-medium">{r.test_title}</TableCell>
                  <TableCell className="text-right"><Score pct={r.score_pct} /></TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{r.correct_count}/{r.total_count}</TableCell>
                  <TableCell className="hidden text-right text-muted-foreground sm:table-cell">{fmtDuration(r.started_at, r.finished_at) ?? '–'}</TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{fmtDate(r.finished_at)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground"><ChevronRight className="size-4" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Page>
  )
}
