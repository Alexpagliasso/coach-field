const fromDate = (value: string) => new Date(`${value}T12:00:00`)
const key = (date: Date) => date.toISOString().slice(0, 10)

export function weekStart(value: string | Date): string {
  const date = typeof value === 'string' ? fromDate(value) : new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12)
  const offset = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - offset)
  return key(date)
}

export function addWeeks(monday: string, amount: number): string {
  const date = fromDate(monday); date.setDate(date.getDate() + amount * 7); return key(date)
}

export function nextWeek(monday: string): string { return addWeeks(monday, 1) }
