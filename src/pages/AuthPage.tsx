import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { errMsg } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/Logo'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ErrorAlert } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'

const translate = (m: string) => {
  if (/invalid login credentials/i.test(m)) return 'E-mail nebo heslo nesedí.'
  if (/already registered|already exists/i.test(m)) return 'Tenhle e-mail už má účet. Přihlas se.'
  if (/password should be at least/i.test(m)) return 'Heslo musí mít aspoň 6 znaků.'
  if (/rate limit/i.test(m)) return 'Moc pokusů za sebou. Zkus to za minutu.'
  if (/valid email|invalid.*email/i.test(m)) return 'Tohle nevypadá jako e-mail.'
  return m
}

const DEMO = ['Mitochondrie', 'Ribozom', 'Golgiho aparát', 'Lysozom']

function DemoQuestion() {
  const [picked, setPicked] = useState<number | null>(0)
  return (
    <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-[0_1px_0_0_var(--border),0_24px_48px_-24px_color-mix(in_oklch,var(--primary)_35%,transparent)]">
      <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Otázka 3 z 20</span>
        <span className="tabular-nums">ID 214</span>
      </div>
      <p className="font-heading text-lg leading-snug font-semibold">Která organela je hlavním místem buněčného dýchání?</p>
      <div className="mt-5 space-y-2">
        {DEMO.map((a, i) => (
          <button
            key={a}
            type="button"
            onClick={() => setPicked(i)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
              picked === i ? 'border-primary/50 bg-accent/60' : 'hover:bg-muted',
            )}
          >
            <span
              className={cn(
                'grid size-6 shrink-0 place-items-center rounded-md border text-xs font-semibold',
                picked === i ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {String.fromCharCode(65 + i)}
            </span>
            <span className={cn(picked === i && 'font-medium')}>{a}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const isLogin = mode === 'login'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: window.location.origin + window.location.pathname },
        })
        if (error) throw error
        if (!data.session) setInfo('Účet je vytvořený. Potvrď ho odkazem v e-mailu a pak se přihlas.')
      }
    } catch (err) {
      setError(translate(errMsg(err)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <aside className="grid-paper relative hidden flex-col justify-between border-r bg-muted/40 p-10 lg:flex">
        <Logo size="lg" />
        <div className="flex flex-col items-start gap-10">
          <h2 className="max-w-md text-4xl leading-[1.1] font-bold">Procvičuj, dokud to nebude sedět.</h2>
          <DemoQuestion />
        </div>
        <p className="text-sm text-muted-foreground">Testy pro naši partu. Výsledky a správné odpovědi uvidíš až po odevzdání.</p>
      </aside>

      <div className="relative flex flex-col">
        <div className="flex items-center justify-between p-4 lg:justify-end">
          <Logo className="lg:hidden" />
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16">
          <form onSubmit={submit} className="w-full max-w-sm space-y-6">
            <div className="space-y-1.5">
              <h1 className="text-3xl font-bold">{isLogin ? 'Přihlášení' : 'Nový účet'}</h1>
              <p className="text-muted-foreground">
                {isLogin ? 'Vítej zpátky. Testy na tebe čekají.' : 'Po registraci ti admin zpřístupní testy.'}
              </p>
            </div>

            <Tabs value={mode} onValueChange={(v) => setMode(v as 'login' | 'register')}>
              <TabsList className="w-full">
                <TabsTrigger value="login">Mám účet</TabsTrigger>
                <TabsTrigger value="register">Jsem tu poprvé</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Přezdívka</Label>
                  <Input id="name" className="h-10" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required placeholder="Pod tímhle jménem budeš v žebříčku" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" className="h-10" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Heslo</Label>
                <Input
                  id="password"
                  className="h-10"
                  type="password"
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {!isLogin && <p className="text-xs text-muted-foreground">Aspoň 6 znaků.</p>}
              </div>
            </div>

            <ErrorAlert error={error} />
            {info && (
              <Alert>
                <AlertDescription>{info}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="h-10 w-full text-sm" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {isLogin ? 'Přihlásit se' : 'Vytvořit účet'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
