import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronDown, Download, FileJson, FileSpreadsheet, Play } from 'lucide-react'
import { toast } from 'sonner'
import { downloadFile, exportCsv, exportJson, fileSlug } from '@/lib/exporter'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { supabase } from '@/lib/supabase'
import type { Question, Test } from '@/lib/types'
import { errMsg } from '@/lib/format'
import { ErrorAlert, Loading, Page, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import QuestionsPanel from './QuestionsPanel'
import ImportPanel from './ImportPanel'
import AccessPanel from './AccessPanel'
import ResultsPanel from './ResultsPanel'
import SettingsPanel from './SettingsPanel'

const TABS = ['questions', 'import', 'access', 'results', 'settings'] as const
type Tab = (typeof TABS)[number]

export default function AdminTestDetail() {
  const { id } = useParams()
  const testId = Number(id)
  const [params, setParams] = useSearchParams()
  const raw = params.get('tab') as Tab
  const tab: Tab = TABS.includes(raw) ? raw : 'questions'
  const setTab = (t: Tab) => setParams(t === 'questions' ? {} : { tab: t }, { replace: true })

  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [accessCount, setAccessCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const loadQuestions = useCallback(async () => {
    const { data, error } = await supabase.from('questions').select('*, answers(*)').eq('test_id', testId).order('position').order('id')
    if (error) return setError(errMsg(error))
    setQuestions((data as Question[]).map((q) => ({ ...q, answers: [...q.answers].sort((a, b) => a.position - b.position || a.id - b.id) })))
  }, [testId])

  useEffect(() => {
    supabase.from('tests').select('*').eq('id', testId).maybeSingle().then(({ data, error }) => {
      if (error) setError(errMsg(error))
      else if (!data) setError('Tenhle test neexistuje.')
      setTest(data as Test)
    })
    supabase.from('test_access').select('*', { count: 'exact', head: true }).eq('test_id', testId).then(({ count }) => setAccessCount(count ?? 0))
    loadQuestions()
  }, [testId, loadQuestions])

  if (error && !test) return <Page><ErrorAlert error={error} /></Page>
  if (!test || !questions) return <Loading />

  return (
    <Page>
      <PageHeader
        back={<Link to="/admin" className="hover:text-foreground">Administrace</Link>}
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            {test.title}
            {!test.is_published && <Badge variant="outline">Skrytý</Badge>}
          </span>
        }
        description={test.description || undefined}
        actions={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={questions.length === 0}>
                  <Download /> Exportovat <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                  {questions.length} otázek ve formátu importu
                </DropdownMenuLabel>
                <DropdownMenuItem
                  onSelect={() => {
                    downloadFile(`${fileSlug(test.title)}.csv`, exportCsv(questions), 'text/csv')
                    toast.success('CSV staženo')
                  }}
                >
                  <FileSpreadsheet /> CSV (Excel)
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    downloadFile(`${fileSlug(test.title)}.json`, exportJson(questions), 'application/json')
                    toast.success('JSON stažen')
                  }}
                >
                  <FileJson /> JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" asChild><Link to={`/test/${test.id}`}><Play /> Vyzkoušet</Link></Button>
          </>
        }
      />
      <ErrorAlert error={error} className="mb-6" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="-mx-4 mb-6 overflow-x-auto overflow-y-hidden border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <TabsList variant="line" className="h-10 [&>[data-slot=tabs-trigger]]:after:bottom-0!">
            <TabsTrigger value="questions" className="px-3">
              Otázky <span className="text-xs text-muted-foreground tabular-nums">{questions.length}</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="px-3">Import</TabsTrigger>
            <TabsTrigger value="access" className="px-3">
              Přístupy <span className="text-xs text-muted-foreground tabular-nums">{accessCount}</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="px-3">Výsledky</TabsTrigger>
            <TabsTrigger value="settings" className="px-3">Nastavení</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="questions">
          <QuestionsPanel testId={testId} questions={questions} setQuestions={setQuestions} onImport={() => setTab('import')} />
        </TabsContent>
        <TabsContent value="import">
          <ImportPanel
            testId={testId}
            existingCount={questions.length}
            onImported={async () => {
              await loadQuestions()
              setTab('questions')
            }}
          />
        </TabsContent>
        <TabsContent value="access">
          <AccessPanel testId={testId} onCountChange={setAccessCount} />
        </TabsContent>
        <TabsContent value="results">
          <ResultsPanel testId={testId} />
        </TabsContent>
        <TabsContent value="settings">
          <SettingsPanel test={test} onSaved={setTest} />
        </TabsContent>
      </Tabs>
    </Page>
  )
}
