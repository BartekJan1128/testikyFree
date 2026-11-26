import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, Play, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'
import type { MyTest } from '@/lib/types'
import { errMsg, fmtDate, fmtPct } from '@/lib/format'
import { EmptyState, ErrorAlert, Page, PageHeader, Score } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const plural = (n: number, one: string, few: string, many: string) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

export default function Dashboard() {
  const { profile } = useAuth()
  const [tests, setTests] = useState<MyTest[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.rpc('list_my_tests').then(({ data, error }) => {
      if (error) setError(errMsg(error))
      setTests((data as MyTest[]) ?? [])
    })
  }, [])

  const done = tests?.filter((t) => t.attempts_count > 0) ?? []
  const avgBest = done.length ? done.reduce((s, t) => s + Number(t.best_pct ?? 0), 0) / done.length : null

  return (
    <Page>
      <PageHeader
        title={profile?.display_name ? `Ahoj, ${profile.display_name}` : 'Tvoje testy'}
        description={
          tests && tests.length > 0
            ? avgBest != null
              ? <>Máš za sebou {done.length} z {tests.length} testů, průměrně nejlépe na <span className="font-medium text-foreground">{fmtPct(avgBest)}</span>.</>
              : 'Vyber si test. Výsledek uvidíš až po odevzdání.'
            : undefined
        }
      />
      <ErrorAlert error={error} className="mb-6" />

      {!tests ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      ) : tests.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Zatím tu žádný test není"
          action={profile?.is_admin ? <Button asChild><Link to="/admin">Vytvořit test</Link></Button> : undefined}
        >
          {profile?.is_admin ? 'Vytvoř první test a nahraj do něj otázky.' : 'Testy zpřístupňuje admin. Napiš mu, ať ti nějaký přidělí.'}
        </EmptyState>
      ) : (
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {tests.map((t) => (
            <div key={t.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:gap-6">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold">{t.title}</h2>
                {t.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                <p className="mt-2 text-xs text-muted-foreground">
                  {t.question_count} {plural(t.question_count, 'otázka', 'otázky', 'otázek')}
                  {t.last_at && <span className="ml-3">naposledy {fmtDate(t.last_at)}</span>}
                </p>
              </div>
              <div className="flex items-center gap-6 sm:w-48 sm:justify-end">
                {t.attempts_count > 0 ? (
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Nejlepší</div>
                    <Score pct={t.best_pct} className="text-xl" />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Ještě nevyplněno</span>
                )}
                {t.attempts_count > 0 && (
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Pokusů</div>
                    <div className="text-xl font-semibold tabular-nums">{t.attempts_count}</div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" asChild aria-label="Žebříček">
                  <Link to={`/leaderboard/${t.id}`} title="Žebříček"><Trophy /></Link>
                </Button>
                {t.question_count > 0 ? (
                  <Button asChild size="lg">
                    <Link to={`/test/${t.id}`}><Play /> {t.attempts_count ? 'Znovu' : 'Spustit'}</Link>
                  </Button>
                ) : (
                  <Button size="lg" disabled variant="outline">Bez otázek</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  )
}
