export interface Place {
  name: string
  lat: number
  lon: number
  country: string
  state?: string
}

export interface WeatherCondition {
  id: number
  main: string
  description: string
  icon: string
}

export interface CurrentWeather {
  dt: number
  timezone: number
  name: string
  coord: { lat: number; lon: number }
  main: { temp: number; feels_like: number; temp_min: number; temp_max: number; pressure: number; humidity: number }
  weather: WeatherCondition[]
  wind: { speed: number; deg: number; gust?: number }
  visibility: number
  sys: { country: string; sunrise: number; sunset: number }
}

export interface ForecastItem {
  dt: number
  main: { temp: number; feels_like: number; temp_min: number; temp_max: number; pressure: number; humidity: number }
  weather: WeatherCondition[]
  clouds: { all: number }
  wind: { speed: number; deg: number; gust?: number }
  visibility: number
  pop: number
  dt_txt: string
}

export interface ForecastResponse {
  list: ForecastItem[]
  city: { name: string; country: string; timezone: number; sunrise: number; sunset: number }
}

export interface AirQualityResponse {
  list: Array<{ main: { aqi: number }; components: Record<string, number> }>
}

export interface WeatherBundle {
  current: CurrentWeather
  forecast: ForecastResponse | null
  airQuality: AirQualityResponse | null
}

export type TemperatureUnit = 'C' | 'F'
