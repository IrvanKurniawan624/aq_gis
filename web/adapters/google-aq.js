const GOOGLE_AQ_URL = 'https://airquality.googleapis.com/v1/currentConditions:lookup'
const SURABAYA_LOCATION = {
  latitude: -7.24917,
  longitude: 112.75083,
}
const TIMEZONE = 'Asia/Jakarta'
const EMPTY_READING = {
  pm10: null,
  pm2_5: null,
  carbon_monoxide: null,
  nitrogen_dioxide: null,
  sulphur_dioxide: null,
  ozone: null,
  aerosol_optical_depth: null,
  dust: null,
  uv_index: null,
  us_aqi: null,
  european_aqi: null,
}
const POLLUTANT_CODE_MAP = {
  pm25: 'pm2_5',
  pm10: 'pm10',
  no2: 'nitrogen_dioxide',
  o3: 'ozone',
  so2: 'sulphur_dioxide',
  co: 'carbon_monoxide',
}

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

function getPollutantValue(pollutant) {
  return pollutant?.concentration?.value ?? null
}

function getUsAqi(indexes = []) {
  const usaEpaIndex = indexes.find((index) => index.code?.toLowerCase() === 'usa_epa')
  const universalIndex = indexes.find((index) => index.code?.toLowerCase() === 'uaqi')

  return usaEpaIndex?.aqi ?? universalIndex?.aqi ?? null
}

export default async function fetchGoogleAQ(location = SURABAYA_LOCATION) {
  const apiKey = process.env.GOOGLE_AQ_API_KEY

  if (!apiKey) {
    console.warn('GOOGLE_AQ_API_KEY is not set; skipping Google Air Quality fetch')
    return null
  }

  const response = await fetch(`${GOOGLE_AQ_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      location,
      extraComputations: ['LOCAL_AQI', 'POLLUTANT_CONCENTRATION'],
    }),
  })

  if (!response.ok) {
    throw new Error(`Google Air Quality request failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const reading = {
    measured_on: getJakartaDate(),
    ...EMPTY_READING,
    us_aqi: getUsAqi(data.indexes),
  }

  for (const pollutant of data.pollutants ?? []) {
    const field = POLLUTANT_CODE_MAP[pollutant.code?.toLowerCase()]

    if (field) {
      reading[field] = getPollutantValue(pollutant)
    }
  }

  return reading
}
