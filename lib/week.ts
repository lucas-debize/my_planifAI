export const SLOTS = ["dejeuner", "diner"] as const
export type SlotKind = (typeof SLOTS)[number]
export const SLOT_LABEL: Record<SlotKind, string> = {
  dejeuner: "Déjeuner",
  diner: "Dîner",
}
