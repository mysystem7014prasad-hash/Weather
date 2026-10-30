import 'dotenv/config'
import express from 'express'

const app = express()
const port = Number(process.env.PORT) || 3001
const apiKey = process.env.OPENWEATHER_API_KEY
const apiBase = 'https://api.openweathermap.org'

app.use(express.json())

async function openWeather(path, parameters) {
  const url = new URL(`${apiBase}${path}`)
  for (const [key, value] of Object.entries({ ...parameters, appid: apiKey })) {
    url.searchParams.set(key, String(value))
  }

  const response = await fetch(url)
  if (!response.ok) {
    const details = await response.json().catch(() => ({}))
    const error = new Error(details.message || 'Weather service request failed')
    error.status = response.status
    throw error
  }
  return response.json()
}

function requireApiKey(_request, response, next) {
  if (!apiKey) {
    return response.status(503).json({
      error: 'Weather service is not configured. Add OPENWEATHER_API_KEY to your .env file.',
    })
  }
  next()
}

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, configured: Boolean(apiKey) })
})

app.get('/api/geocode', requireApiKey, async (request, response) => {
  const query = String(request.query.q || '').trim()
  if (query.length < 2) return response.json([])

  try {
    const places = await openWeather('/geo/1.0/direct', { q: query, limit: 5 })
    response.json(places)
  } catch (error) {
    console.error('Geocoding failed:', error.message)
    response.status(error.status || 502).json({ error: error.message })
  }
})

app.get('/api/reverse-geocode', requireApiKey, async (request, response) => {
  const { lat, lon } = request.query
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return response.status(400).json({ error: 'Valid latitude and longitude are required.' })
  }

  try {
    const places = await openWeather('/geo/1.0/reverse', { lat, lon, limit: 1 })
    if (!places.length) return response.status(404).json({ error: 'No location found for those coordinates.' })
    response.json(places[0])
  } catch (error) {
    console.error('Reverse geocoding failed:', error.message)
    response.status(error.status || 502).json({ error: error.message })
  }
})

app.get('/api/weather', requireApiKey, async (request, response) => {
  const { lat, lon } = request.query
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return response.status(400).json({ error: 'Valid latitude and longitude are required.' })
  }

  try {
    const coordinates = { lat, lon, units: 'metric' }
    const [current, forecast, airQuality] = await Promise.all([
      openWeather('/data/2.5/weather', coordinates),
      openWeather('/data/2.5/forecast', coordinates).catch((error) => {
        console.warn('Forecast data unavailable:', error.message)
        return null
      }),
      openWeather('/data/2.5/air_pollution', { lat, lon }).catch((error) => {
        console.warn('Air quality data unavailable:', error.message)
        return null
      }),
    ])
    response.json({ current, forecast, airQuality })
  } catch (error) {
    console.error('Weather lookup failed:', error.message)
    response.status(error.status || 502).json({
      error: error.status === 404 ? 'Weather could not be found for this location.' : error.message,
    })
  }
})

app.listen(port, () => {
  console.log(`WeatherWise API listening on http://localhost:${port}`)
})
