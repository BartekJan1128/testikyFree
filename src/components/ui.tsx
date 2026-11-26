import type { ReactNode } from 'react'
import { fmtPct, scoreTone } from '../lib/format'

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="center-screen">
      <div className="stack" style={{ alignItems: 'center' }}>
        <div className="spinner" />
        {label && <span className="small">{label}</span>}
      </div>
    </div>
  )
}

export function ErrorBox({ error }: { error: string | null | undefined }) {
  if (!error) return null
  return <div className="alert error">{error}</div>
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card empty">
      <h3>{title}</h3>
      {children && <div>{children}</div>}
    </div>
  )
}

export function Score({ pct }: { pct: number | null | undefined }) {
  return <span className={`score ${scoreTone(pct)}`}>{fmtPct(pct)}</span>
}

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        className="input"
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}

export function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card modal">{children}</div>
    </div>
  )
}
