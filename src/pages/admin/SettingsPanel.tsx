import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { Test } from '@/lib/types'
import { errMsg } from '@/lib/format'
import { cleanupImages } from '@/lib/upload'
import { ErrorAlert } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

function SwitchRow({ id, title, hint, checked, onChange }: { id: string; title: string; hint: ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <Label htmlFor={id} className="flex flex-col items-start gap-1 font-normal">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{hint}</span>
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  )
}

export default function SettingsPanel({ test, onSaved }: { test: Test; onSaved: (t: Test) => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(test)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const set = <K extends keyof Test>(k: K, v: Test[K]) => setForm((f) => ({ ...f, [k]: v }))
  const dirty =
    form.title !== test.title ||
    form.description !== test.description ||
    form.shuffle_questions !== test.shuffle_questions ||
    form.shuffle_answers !== test.shuffle_answers ||
    form.is_published !== test.is_published

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
    setForm(data as Test)
    toast.success('Nastavení uloženo')
  }

  async function del() {
    setDeleting(true)
    const { error } = await supabase.from('tests').delete().eq('id', test.id)
    setDeleting(false)
    if (error) return toast.error(errMsg(error))
    toast.success(`Test „${test.title}“ smazán`)
    cleanupImages()
    navigate('/admin', { replace: true })
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="s-title">Název</Label>
            <Input id="s-title" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-desc">Popis</Label>
            <Textarea id="s-desc" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
          </div>
        </div>
        <div className="mt-4 divide-y border-t">
          <SwitchRow
            id="s-pub"
            title="Aktivní"
            hint="Uživatelé s přístupem test vidí a můžou ho spustit."
            checked={form.is_published}
            onChange={(v) => set('is_published', v)}
          />
          <SwitchRow
            id="s-shq"
            title="Míchat pořadí otázek"
            hint="Každý pokus dostane otázky v jiném pořadí."
            checked={form.shuffle_questions}
            onChange={(v) => set('shuffle_questions', v)}
          />
          <SwitchRow
            id="s-sha"
            title="Míchat pořadí odpovědí"
            hint="Odpovědi se u každé otázky zamíchají."
            checked={form.shuffle_answers}
            onChange={(v) => set('shuffle_answers', v)}
          />
        </div>
        <ErrorAlert error={error} className="mt-4" />
        <div className="mt-4 flex justify-end gap-2">
          {dirty && <Button variant="ghost" onClick={() => setForm(test)}>Vrátit</Button>}
          <Button disabled={busy || !dirty || !form.title.trim()} onClick={save}>
            {busy && <Loader2 className="animate-spin" />} Uložit změny
          </Button>
        </div>
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/30 p-5 sm:p-6">
        <div>
          <h3 className="font-semibold">Smazat test</h3>
          <p className="text-sm text-muted-foreground">Smaže otázky i přístupy. Odevzdané pokusy zůstanou v historii.</p>
        </div>
        <AlertDialog onOpenChange={() => setConfirmName('')}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Smazat test</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Opravdu smazat „{test.title}“?</AlertDialogTitle>
              <AlertDialogDescription>Tohle nejde vrátit. Pro potvrzení napiš název testu.</AlertDialogDescription>
            </AlertDialogHeader>
            <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={test.title} autoFocus />
            <AlertDialogFooter>
              <AlertDialogCancel>Zrušit</AlertDialogCancel>
              <Button variant="destructive" disabled={confirmName !== test.title || deleting} onClick={del}>
                {deleting && <Loader2 className="animate-spin" />} Smazat natrvalo
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </div>
  )
}
