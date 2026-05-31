const TIMEZONE = 'Asia/Jakarta'

function formatJakartaHour(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  const dateParts = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${dateParts.year}-${dateParts.month}-${dateParts.day} ${dateParts.hour}:00:00`
}

function normalizeLocalTimestamp(value) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):\d{2}(?::\d{2}(?:\.\d+)?)?$/,
  )

  if (!match) return null

  const [, year, month, day, hour] = match
  const date = new Date(Date.UTC(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    Number.parseInt(hour, 10),
  ))

  if (
    date.getUTCFullYear() !== Number.parseInt(year, 10)
    || date.getUTCMonth() !== Number.parseInt(month, 10) - 1
    || date.getUTCDate() !== Number.parseInt(day, 10)
    || date.getUTCHours() !== Number.parseInt(hour, 10)
  ) {
    throw new Error(`Invalid local timestamp: ${value}`)
  }

  return `${year}-${month}-${day} ${hour}:00:00`
}

export function toJakartaHour(value = new Date()) {
  if (typeof value === 'string') {
    const localTimestamp = normalizeLocalTimestamp(value)

    if (localTimestamp) return localTimestamp
  }

  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid timestamp: ${value}`)
  }

  return formatJakartaHour(date)
}
