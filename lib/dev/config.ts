export const DEV_COOKIE = "planifia-dev"
export const DEV_USER_ID = "11111111-1111-4111-8111-111111111111"
export const DEV_USER_EMAIL = "dev@planifia.local"

export function isDevBypassAllowed() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_AUTH_BYPASS === "1"
  )
}

export function isDevSessionValue(value: string | undefined | null) {
  return isDevBypassAllowed() && value === DEV_USER_ID
}
