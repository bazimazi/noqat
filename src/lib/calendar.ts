/** Calendar keys follow the player's local midnight, including daylight saving. */
export function localDay(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function previousDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  // Noon stays clear of time zones that move their clocks at midnight.
  return localDay(new Date(year, month - 1, date - 1, 12))
}
