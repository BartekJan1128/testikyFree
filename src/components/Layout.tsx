import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, session, signOut } = useAuth()
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
            Testíky
          </Link>
          <nav className="nav">
            <NavLink to="/" end>Testy</NavLink>
            <NavLink to="/history">Historie</NavLink>
            {profile?.is_admin && <NavLink to="/admin">Administrace</NavLink>}
          </nav>
          <div className="user-box">
            <span className="name" title={session?.user.email}>
              {profile?.display_name || session?.user.email}
            </span>
            <button className="btn sm" onClick={signOut}>Odhlásit</button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </>
  )
}
