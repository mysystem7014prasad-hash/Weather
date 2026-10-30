import type { Place, WeatherBundle } from '../types'

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url)
  const body = await response.json()
  if (!response.ok) {
    throw new Error(body.error || 'Something went wrong. Please try again.')
  }
  return body as T
}

export function searchPlaces(query: string): Promise<Place[]> {
  return request<Place[]>(`/api/geocode?q=${encodeURIComponent(query)}`)
}

export function reverseGeocode(lat: number, lon: number): Promise<Place> {
  return request<Place>(`/api/reverse-geocode?lat=${lat}&lon=${lon}`)
}

export function getWeather(lat: number, lon: number): Promise<WeatherBundle> {
  return request<WeatherBundle>(`/api/weather?lat=${lat}&lon=${lon}`)
}
