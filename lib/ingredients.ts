export function normalizeName(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase()
}

export function displayName(s: string): string {
  return s.trim().replace(/\s+/g, " ")
}
