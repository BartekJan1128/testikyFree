import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Question, Test } from '../../lib/types'
import { errMsg } from '../../lib/format'
import { ErrorBox, Spinner } from '../../components/ui'
import QuestionsPanel from './QuestionsPanel'
import ImportPanel from './ImportPanel'
import AccessPanel from './AccessPanel'
import ResultsPanel from './ResultsPanel'
import SettingsPanel from './SettingsPanel'

const TABS = [
  ['questions', 'Otázky'],
  ['import', 'Import'],
  ['access', 'Přístupy'],
  ['results', 'Výsledky'],
  ['settings', 'Nastavení'],
] as const
type Tab = (typeof TABS)[number][0]

export default function AdminTestDetail() {
  const { id } = useParams()
  const testId = Number(id)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'questions'
  const setTab = (t: Tab) => setParams(t === 'questions' ? {} : { tab: t }, { replace: true })

  const [test, setTest] = useState<Test | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [accessCount, setAccessCount] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)

  const loadQuestions = useCallback(async () => {
    const { data, error } = await supabase
      .from('questions')
      .select('*, answers(*)')
      .eq('test_id', testId)
      .order('position')
      .order('id')
    if (error) return setError(errMsg(error))
    const qs = (data as Question[]).map((q) => ({ ...q, answers: [...q.answers].sort((a, b) => a.position - b.position || a.id - b.id) }))
    setQuestions(qs)
  }, [testId])

  useEffect(() => {
    supabase.from('tests').select('*').eq('id', testId).maybeSingle().then(({ data, error }) => {
      if (error) setError(errMsg(error))
      else if (!data) setError('Test neexistuje.')
      setTest(data as Test)
    })
    supabase.from('test_access').select('*', { count: 'exact', head: true }).eq('test_id', testId).then(({ count }) => setAccessCount(count ?? 0))
    loadQuestions()
  }, [testId, loadQuestions])

  if (error && !test) return <div className="container"><ErrorBox error={error} /></div>
  if (!test || !questions) return <Spinner />

  return (
    <div className="container">
      <div className="crumbs"><Link to="/admin">Administrace</Link> / {test.title}</div>
      <div className="page-head">
        <div>
          <h1>{test.title}</h1>
          <p className="sub">
            {questions.length} otázek · přístup má {accessCount} uživ.
            {!test.is_published && <> · <span className="badge">Skrytý</span></>}
          </p>
        </div>
        <Link to={`/test/${test.id}`} className="btn">Vyzkoušet test</Link>
      </div>

      <div className="tabs">
        {TABS.map(([key, label]) => (
          <button key={key} className={`tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {label}
            {key === 'questions' && <span className="count">{questions.length}</span>}
            {key === 'access' && <span className="count">{accessCount}</span>}
          </button>
        ))}
      </div>

      <ErrorBox error={error} />

      {tab === 'questions' && <QuestionsPanel testId={testId} questions={questions} setQuestions={setQuestions} />}
      {tab === 'import' && (
        <ImportPanel
          testId={testId}
          existingCount={questions.length}
          onImported={async () => {
            await loadQuestions()
            setTab('questions')
          }}
        />
      )}
      {tab === 'access' && <AccessPanel testId={testId} onCountChange={setAccessCount} />}
      {tab === 'results' && <ResultsPanel testId={testId} />}
      {tab === 'settings' && <SettingsPanel test={test} onSaved={setTest} />}
    </div>
  )
}
