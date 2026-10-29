import {
  addDays,
  format,
  isSameDay as isSameDayFns,
  isToday as isTodayFns,
  startOfWeek,
} from "date-fns"
import { fr } from "date-fns/locale"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function mondayOf(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 })
}
export function weekStartOf(d: Date, startDay: 1 | 6 = 1): Date {
  return startOfWeek(d, { weekStartsOn: startDay })
}


export function weekDays(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

export function toISODate(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

export function parseISODate(s: string): Date | null {
  if (!ISO_DATE.test(s)) return null
  const [year, month, day] = s.split("-").map(Number)
  const date = new Date(year, month - 1, day)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null
  }
  return date
}

export function weekLabel(monday: Date): string {
  const sunday = addDays(monday, 6)
  const start = format(monday, "EEEE d MMMM", { locale: fr })
  const end = format(sunday, "EEEE d MMMM yyyy", { locale: fr })
  return `${capitalize(start)} – ${capitalize(end)}`
}

export function weekLabelShort(monday: Date): string {
  const sunday = addDays(monday, 6)
  const start = format(monday, "d MMM", { locale: fr })
  const end = format(sunday, "d MMM", { locale: fr })
  return `${start} – ${end}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function isSameDay(a: Date, b: Date): boolean {
  return isSameDayFns(a, b)
}

export function isToday(d: Date): boolean {
  return isTodayFns(d)
}

export function isPastDay(d: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  return date < today
}

export function isMonday(d: Date): boolean {
  return d.getDay() === 1
}

export function dayShort(d: Date): string {
  return format(d, "EEE d", { locale: fr })
}

export function dayLong(d: Date): string {
  const raw = format(d, "EEEE d MMMM", { locale: fr })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function slotTitleDate(d: Date): string {
  return format(d, "EEEE d MMM", { locale: fr })
}

export function weekdayLong(d: Date): string {
  const raw = format(d, "EEEE", { locale: fr })
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

export function currentMondayIso(now = new Date()): string {
  return toISODate(mondayOf(now))
}
export function currentWeekStartIso(now = new Date(), startDay: 1 | 6 = 1): string {
  return toISODate(weekStartOf(now, startDay))
}
