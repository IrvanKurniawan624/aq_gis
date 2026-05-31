const OPEN_METEO_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality'
const SURABAYA_LATITUDE = '-7.24917'
const SURABAYA_LONGITUDE = '112.75083'
const TIMEZONE = 'Asia/Jakarta'
const CURRENT_FIELDS = [
  'pm10',
  'pm2_5',
  'carbon_monoxide',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'ozone',
  'aerosol_optical_depth',
  'dust',
  'uv_index',
  'us_aqi',
  'european_aqi',
]

function getJakartaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())

  const dateParts = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`
}

function buildUrl() {
  const params = new URLSearchParams({
    latitude: SURABAYA_LATITUDE,
    longitude: SURABAYA_LONGITUDE,
    current: CURRENT_FIELDS.join(','),
    timezone: TIMEZONE,
  })

  return `${OPEN_METEO_URL}?${params.toString()}`
}

export default async function fetchOpenMeteo() {
  const response = await fetch(buildUrl())

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const current = data.current ?? {}

  return {
    measured_on: getJakartaDate(),
    pm10: current.pm10 ?? null,
    pm2_5: current.pm2_5 ?? null,
    carbon_monoxide: current.carbon_monoxide ?? null,
    nitrogen_dioxide: current.nitrogen_dioxide ?? null,
    sulphur_dioxide: current.sulphur_dioxide ?? null,
    ozone: current.ozone ?? null,
    aerosol_optical_depth: current.aerosol_optical_depth ?? null,
    dust: current.dust ?? null,
    uv_index: current.uv_index ?? null,
    us_aqi: current.us_aqi ?? null,
    european_aqi: current.european_aqi ?? null,
  }
}
