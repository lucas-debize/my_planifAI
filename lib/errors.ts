export function actionErrorMessage(
  error: unknown,
  fallback = "Impossible d’enregistrer. Réessaie."
): string {
  const message = error instanceof Error ? error.message : String(error ?? "")
  if (message === "NAME_REQUIRED") return "Donne un nom au plat."
  if (message === "INGREDIENT_NAME_REQUIRED") {
    return "Donne un nom à l’ingrédient."
  }
  if (message === "INGREDIENT_EXISTS") {
    return "Cet ingrédient est déjà dans le carnet."
  }
  if (message === "INGREDIENT_FROM_MEAL") {
    return "Retire-le du plat pour l’enlever des courses."
  }
  if (message === "SAME_WEEK") return "Choisis une autre semaine."
  if (message === "UNAUTHENTICATED") return "Reconnecte-toi pour continuer."
  return fallback
}

export function isEmailRateLimited(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { code?: string; status?: number; message?: string }
  const code = (candidate.code ?? "").toLowerCase()
  const message = (candidate.message ?? "").toLowerCase()
  return (
    candidate.status === 429 ||
    code.includes("over_email") ||
    code.includes("rate_limit") ||
    message.includes("rate limit") ||
    message.includes("too many")
  )
}
