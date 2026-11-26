import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Test } from '../../lib/types'
import { errMsg } from '../../lib/format'
import { ErrorBox } from '../../components/ui'

export default function SettingsPanel({ test, onSaved }: { test: Test; onSaved: (t: Test) => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(test)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const set = <K extends keyof Test>(k: K, v: Test[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function save() {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase
      .from('tests')
      .update({
        title: form.title.trim(),
        description: form.description.trim(),
        shuffle_questions: form.shuffle_questions,
        shuffle_answers: form.shuffle_answers,
        is_published: form.is_published,
      })
      .eq('id', test.id)
      .select()
      .single()
    setBusy(false)
    if (error) return setError(errMsg(error))
    onSaved(data as Test)
    setSaved(true)
  }

  async function del() {
    const answer = prompt(`Smazáním testu se smažou i všechny otázky a přístupy (historie pokusů zůstane).\n\nPro potvrzení napiš název testu:\n${test.title}`)
    if (answer !== test.title) return
    const { error } = await supabase.from('tests').delete().eq('id', test.id)
    if (error) return setError(errMsg(error))
    navigate('/admin', { replace: true })
  }

  return (
    <div className="stack" style={{ gap: 16, maxWidth: 640 }}>
      <div className="card stack" style={{ gap: 14 }}>
        <label className="field">
          Název
          <input className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
        </label>
        <label className="field">
          Popis
          <textarea className="input" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={form.shuffle_questions} onChange={(e) => set('shuffle_questions', e.target.checked)} />
          Zamíchat pořadí otázek
        </label>
        <label className="check">
          <input type="checkbox" checked={form.shuffle_answers} onChange={(e) => set('shuffle_answers', e.target.checked)} />
          Zamíchat pořadí odpovědí
        </label>
        <label className="check">
          <input type="checkbox" checked={form.is_published} onChange={(e) => set('is_published', e.target.checked)} />
          Aktivní (uživatelé s přístupem ho vidí)
        </label>
        <ErrorBox error={error} />
        <div className="row">
          {saved && <span className="small" style={{ color: 'var(--good)' }}>✓ Uloženo</span>}
          <span className="spacer" />
          <button className="btn primary" disabled={busy || !form.title.trim()} onClick={save}>{busy ? 'Ukládám…' : 'Uložit změny'}</button>
        </div>
      </div>

      <div className="card stack" style={{ gap: 10 }}>
        <h3>Nebezpečná zóna</h3>
        <p className="small muted">Smaže test, otázky i přístupy. Odevzdané pokusy zůstanou v historii uživatelů.</p>
        <button className="btn danger" style={{ alignSelf: 'flex-start' }} onClick={del}>Smazat test</button>
      </div>
    </div>
  )
}
