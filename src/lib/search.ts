const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Vyhledávání otázek:
 *  - "123" nebo "#123"     -> přesná shoda ID
 *  - "12, 15 #20"           -> kterékoliv z ID
 *  - cokoliv jiného         -> fulltext v textu otázky / odpovědí (bez diakritiky)
 */
export function makeQuestionMatcher(query: string) {
  const q = query.trim()
  if (!q) return () => true
  if (/^[#\d,;\s]+$/.test(q)) {
    const ids = new Set(
      q.split(/[\s,;#]+/).filter(Boolean).map((x) => Number(x)),
    )
    return (id: number) => ids.has(id)
  }
  const needle = normalize(q)
  return (_id: number, ...texts: string[]) => texts.some((t) => normalize(t).includes(needle))
}

export function isIdQuery(query: string) {
  return /^[#\d,;\s]+$/.test(query.trim()) && query.trim() !== ''
}
