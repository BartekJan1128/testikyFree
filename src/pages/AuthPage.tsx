import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { errMsg } from '../lib/format'
import { ErrorBox } from '../components/ui'

const translate = (m: string) => {
  if (/invalid login credentials/i.test(m)) return 'Špatný e-mail nebo heslo.'
  if (/already registered|already exists/i.test(m)) return 'Účet s tímto e-mailem už existuje – přihlas se.'
  if (/password should be at least/i.test(m)) return 'Heslo musí mít alespoň 6 znaků.'
  if (/rate limit/i.test(m)) return 'Příliš mnoho pokusů, zkus to za chvíli.'
  if (/valid email|invalid.*email/i.test(m)) return 'Zadej platný e-mail.'
  return m
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setInfo(null)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: window.location.origin + window.location.pathname,
          },
        })
        if (error) throw error
        if (!data.session) setInfo('Účet vytvořen. Potvrď registraci odkazem v e-mailu a pak se přihlas.')
      }
    } catch (err) {
      setError(translate(errMsg(err)))
    } finally {
      setBusy(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-head">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <h1>Testíky</h1>
          <p>{isLogin ? 'Přihlas se a jdi procvičovat.' : 'Vytvoř si účet. Testy ti pak zpřístupní admin.'}</p>
        </div>
        <form className="card stack" onSubmit={submit} style={{ gap: 14 }}>
          <div className="seg" style={{ display: 'flex' }}>
            <button type="button" style={{ flex: 1 }} className={isLogin ? 'active' : ''} onClick={() => setMode('login')}>
              Přihlášení
            </button>
            <button type="button" style={{ flex: 1 }} className={!isLogin ? 'active' : ''} onClick={() => setMode('register')}>
              Registrace
            </button>
          </div>
          {!isLogin && (
            <label className="field">
              Přezdívka
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jak tě uvidí ostatní v žebříčku" maxLength={40} required />
            </label>
          )}
          <label className="field">
            E-mail
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="field">
            Heslo
            <input
              className="input"
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <ErrorBox error={error} />
          {info && <div className="alert info">{info}</div>}
          <button className="btn primary lg block" disabled={busy}>
            {busy ? 'Moment…' : isLogin ? 'Přihlásit se' : 'Vytvořit účet'}
          </button>
        </form>
      </div>
    </div>
  )
}
