import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bookmark, Check, ChevronDown, ChevronRight,
  Clock3, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Compass,
  Droplets, Gauge, LocateFixed, MapPin, Menu, Moon, Plus, Search, Share2, Sun, Sunrise,
  Sunset, Thermometer, Wind, X,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { AirQualityResponse, ForecastItem, Place, TemperatureUnit, WeatherBundle } from './types'
import { getWeather, reverseGeocode, searchPlaces } from './services/weather'

type Section = 'Home' | 'Forecast' | 'Saved locations' | 'About'
type IconComponent = typeof Sun

const navItems: Array<{ label: Section; icon: IconComponent }> = [
  { label: 'Home', icon: CloudSun },
  { label: 'Forecast', icon: Clock3 },
  { label: 'Saved locations', icon: Bookmark },
  { label: 'About', icon: Compass },
]

function conditionIcon(code?: number, size = 24, className = '') {
  const Icon = !code ? CloudSun
    : code < 300 ? CloudLightning
      : code < 400 ? CloudDrizzle
        : code < 600 ? CloudRain
          : code < 700 ? CloudFog
            : code < 800 ? Cloud
              : code === 800 ? Sun
                : code < 803 ? CloudSun : Cloud
  return <Icon size={size} strokeWidth={1.7} className={className} />
}

function celsius(value: number, unit: TemperatureUnit) {
  return Math.round(unit === 'F' ? (value * 9) / 5 + 32 : value)
}

function timeAt(timestamp: number, offset: number, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
    ...options,
  }).format(new Date((timestamp + offset) * 1000))
}

function localClock(timestamp: number, offset: number) {
  return new Intl.DateTimeFormat('en', {
    timeZone: 'UTC',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date((timestamp + offset) * 1000))
}

function windDirection(degrees: number) {
  return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(degrees / 45) % 8]
}

function placeLabel(place: Place) {
  return [place.name, place.state, countryLabel(place.country)].filter(Boolean).join(', ')
}

function countryLabel(code: string) {
  return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code
}

function airLabel(data: AirQualityResponse | null) {
  const index = data?.list[0]?.main.aqi
  return !index ? 'Unavailable' : ['Good', 'Fair', 'Moderate', 'Poor', 'Very poor'][index - 1] || 'Unavailable'
}

function App() {
  const [section, setSection] = useState<Section>('Home')
  const [place, setPlace] = useState<Place>({ name: 'London', state: 'England', country: 'GB', lat: 51.5072, lon: -0.1276 })
  const [weather, setWeather] = useState<WeatherBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [unit, setUnit] = useState<TemperatureUnit>(() => (localStorage.getItem('weatherwise-unit') as TemperatureUnit) || 'C')
  const [dark, setDark] = useState(() => localStorage.getItem('weatherwise-theme') === 'dark')
  const [favorites, setFavorites] = useState<Place[]>(() => JSON.parse(localStorage.getItem('weatherwise-favorites') || '[]'))
  const [recents, setRecents] = useState<Place[]>(() => JSON.parse(localStorage.getItem('weatherwise-recents') || '[]'))
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const loadWeather = useCallback(async (target: Place, addRecent = true) => {
    setLoading(true)
    setError('')
    setPlace(target)
    setSuggestions([])
    setQuery('')
    try {
      const data = await getWeather(target.lat, target.lon)
      setWeather(data)
      setPlace(() => ({ ...target, name: data.current.name || target.name, country: data.current.sys.country || target.country }))
      if (addRecent) {
        setRecents((items) => {
          const next = [target, ...items.filter((item) => item.lat !== target.lat || item.lon !== target.lon)].slice(0, 6)
          localStorage.setItem('weatherwise-recents', JSON.stringify(next))
          return next
        })
      }
    } catch (cause) {
      setWeather(null)
      setError(cause instanceof Error ? cause.message : 'Weather could not be loaded. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadWeather(place, false) }, []) // Initial real-data lookup.
  useEffect(() => {
    localStorage.setItem('weatherwise-unit', unit)
  }, [unit])
  useEffect(() => {
    localStorage.setItem('weatherwise-theme', dark ? 'dark' : 'light')
  }, [dark])
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) setSuggestions([])
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])
  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([])
      return
    }
    let active = true
    const timer = window.setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchPlaces(query.trim())
        if (active) setSuggestions(results)
      } catch {
        if (active) setSuggestions([])
      } finally {
        if (active) setSearching(false)
      }
    }, 320)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  const current = weather?.current
  const forecast = weather?.forecast?.list || []
  const offset = current?.timezone ?? 0
  const currentCondition = current?.weather[0]
  const isFavorite = favorites.some((item) => item.lat === place.lat && item.lon === place.lon)
  const hourly = useMemo(() => forecast.slice(0, 8), [forecast])
  const daily = useMemo(() => {
    const days = new Map<string, ForecastItem[]>()
    forecast.forEach((item) => {
      const day = new Date((item.dt + offset) * 1000).toLocaleDateString('en-CA', { timeZone: 'UTC' })
      const rows = days.get(day) || []
      rows.push(item)
      days.set(day, rows)
    })
    return Array.from(days.entries()).slice(0, 5).map(([date, rows]) => {
      const noon = rows.reduce((best, item) => Math.abs(Number(item.dt_txt.slice(11, 13)) - 12) < Math.abs(Number(best.dt_txt.slice(11, 13)) - 12) ? item : best, rows[0])
      return {
        date,
        item: noon,
        min: Math.min(...rows.map((row) => row.main.temp_min)),
        max: Math.max(...rows.map((row) => row.main.temp_max)),
        rain: Math.max(...rows.map((row) => row.pop)),
        rows,
      }
    })
  }, [forecast, offset])
  const chartData = useMemo(() => forecast.slice(0, 8).map((item) => ({
    time: timeAt(item.dt, offset, { hour: 'numeric' }),
    temp: celsius(item.main.temp, unit),
    humidity: item.main.humidity,
    wind: Math.round(item.wind.speed * 3.6),
  })), [forecast, offset, unit])
  const backgroundKind = currentCondition?.main.toLowerCase() || 'clear'

  const choosePlace = (target: Place) => {
    void loadWeather(target)
    setSection('Home')
  }
  const searchCity = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    setError('')
    try {
      const results = await searchPlaces(query.trim())
      if (results.length === 0) {
        setError(`We couldn't find “${query.trim()}”. Try another city or check the spelling.`)
      } else {
        choosePlace(results[0])
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Search is temporarily unavailable.')
    } finally {
      setSearching(false)
    }
  }
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Your browser does not support location services. Search for a city instead.')
      return
    }
    setLoading(true)
    setError('')
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const location = await reverseGeocode(coords.latitude, coords.longitude)
        choosePlace(location)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'We could not identify your location.')
        setLoading(false)
      }
    }, (cause) => {
      setLoading(false)
      setError(cause.code === cause.PERMISSION_DENIED
        ? 'Location access was denied. You can enable it in your browser settings or search for a city.'
        : 'We could not determine your location. Please try again or search for a city.')
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 })
  }
  const toggleFavorite = () => {
    setFavorites((items) => {
      const next = isFavorite
        ? items.filter((item) => item.lat !== place.lat || item.lon !== place.lon)
        : [place, ...items]
      localStorage.setItem('weatherwise-favorites', JSON.stringify(next))
      return next
    })
  }
  const shareReport = async () => {
    const text = current
      ? `${place.name}: ${celsius(current.main.temp, unit)}°${unit}, ${currentCondition?.description || 'current conditions'}. WeatherWise`
      : `Weather in ${place.name} — WeatherWise`
    try {
      if (navigator.share) await navigator.share({ title: `Weather in ${place.name}`, text, url: window.location.href })
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(`${text} ${window.location.href}`)
        window.alert('Weather report copied to clipboard.')
      }
    } catch (cause) {
      if (cause instanceof Error && cause.name !== 'AbortError') setError('The weather report could not be shared.')
    }
  }
  const changeSection = (item: Section) => {
    setSection(item)
    setMobileMenu(false)
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const formatDay = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })

  return (
    <div className={`app-shell ${dark ? 'theme-dark' : ''}`}>
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); changeSection('Home') }}>
          <span className="brand-mark"><CloudSun size={23} /></span>
          <span>weather<span className="brand-light">wise</span><small>WEATHER, WITH CLARITY</small></span>
        </a>
        <div className="sidebar-label">MENU</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${section === label ? 'active' : ''}`} onClick={() => changeSection(label)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Saved locations' && favorites.length > 0 && <span className="nav-count">{favorites.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span className="tip-icon"><Sun size={17} /></span>
            <p>A little sunshine<br />goes a long way.</p>
            <span className="tip-caption">YOUR DAILY WEATHER COMPANION</span>
          </div>
          <div className="sidebar-foot"><span className="live-dot" /> Live weather data <span className="foot-sep">·</span> OpenWeather</div>
        </div>
      </aside>

      <div className="main-column" id="main-content">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open navigation" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={15} /><strong>{section}</strong></div>
          <div className="top-actions">
            <div className="units-switch" aria-label="Temperature unit">
              <button className={unit === 'C' ? 'selected' : ''} onClick={() => setUnit('C')} aria-pressed={unit === 'C'}>°C</button>
              <button className={unit === 'F' ? 'selected' : ''} onClick={() => setUnit('F')} aria-pressed={unit === 'F'}>°F</button>
            </div>
            <span className="top-divider" />
            <button className="icon-button theme-button" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} onClick={() => setDark(!dark)}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="avatar">W</div>
          </div>
        </header>

        <main className="content-area">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><span className="live-dot" /> YOUR PERSONAL WEATHER STATION</div>
              <h1>{section === 'Home' ? 'Good day' : section === 'Forecast' ? 'The forecast' : section === 'Saved locations' ? 'Your places' : 'A clearer forecast'}</h1>
              <p className="welcome-subtitle">{section === 'Home' ? 'Here’s what the sky has in store for you.' : section === 'Forecast' ? 'A little look at the days ahead.' : section === 'Saved locations' ? 'Keep an eye on the places that matter.' : 'Weather, thoughtfully brought together.'}</p>
            </div>
            <div className="welcome-date"><Clock3 size={15} /> {current ? localClock(current.dt, offset) : '—'} <span>LOCAL TIME</span></div>
          </section>

          <section className="search-row">
            <div className="search-wrap" ref={searchRef}>
              <Search className="search-icon" size={18} />
              <form onSubmit={searchCity}>
                <input
                  aria-label="Search city"
                  placeholder="Search for a city..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Escape') setSuggestions([]) }}
                />
                {searching && <span className="search-spinner" />}
                <button type="submit" className="search-submit" aria-label="Search"><Search size={16} /><span>Search</span></button>
              </form>
              {suggestions.length > 0 && (
                <div className="suggestions" role="listbox">
                  {suggestions.map((item) => (
                    <button key={`${item.lat}-${item.lon}`} role="option" aria-selected={false} onClick={() => choosePlace(item)}>
                      <MapPin size={16} /><span>{item.name}<small>{[item.state, countryLabel(item.country)].filter(Boolean).join(', ')}</small></span><ChevronRight size={16} />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="location-button" onClick={useCurrentLocation}><LocateFixed size={17} /><span>Use my location</span></button>
          </section>

          {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss"><X size={17} /></button></div>}

          {section === 'About' ? (
            <section className="about-card">
              <div className="about-icon"><CloudSun size={27} /></div>
              <p className="eyebrow">ABOUT WEATHERWISE</p>
              <h2>Weather, without the noise.</h2>
              <p>WeatherWise brings current conditions and a thoughtful forecast into one calm, easy-to-read space. Search cities around the world, save the places you care about, and get a useful snapshot of the day ahead.</p>
              <div className="about-details"><div><strong>Weather data</strong><span>OpenWeatherMap</span></div><div><strong>Forecast coverage</strong><span>Up to 5 days · updated every 3 hours</span></div><div><strong>Your privacy</strong><span>Your API key stays on the server. Saved places stay in this browser.</span></div></div>
            </section>
          ) : section === 'Saved locations' ? (
            <section className="locations-section">
              <div className="section-heading"><div><p className="eyebrow">YOUR SHORTLIST</p><h2>Saved locations <span className="muted-count">{favorites.length}</span></h2></div><button className="text-action" onClick={() => changeSection('Home')}><Plus size={16} /> Add a location</button></div>
              {favorites.length === 0 ? <div className="empty-state"><span><Bookmark size={24} /></span><h3>No saved places yet</h3><p>Search for a city and tap the bookmark to keep it close.</p><button className="primary-button" onClick={() => changeSection('Home')}>Find a city <ChevronRight size={15} /></button></div> : (
                <div className="location-grid">
                  {favorites.map((favorite) => <FavoriteCard key={`${favorite.lat}-${favorite.lon}`} place={favorite} unit={unit} onSelect={choosePlace} onRemove={(target) => {
                    setFavorites((items) => { const next = items.filter((item) => item.lat !== target.lat || item.lon !== target.lon); localStorage.setItem('weatherwise-favorites', JSON.stringify(next)); return next })
                  }} />)}
                </div>
              )}
              {recents.length > 0 && <div className="recent-block"><h3>Recently viewed</h3><div className="recent-list">{recents.map((recent) => <button key={`${recent.lat}-${recent.lon}`} onClick={() => choosePlace(recent)}><Clock3 size={15} />{recent.name}<span>{[recent.state, recent.country].filter(Boolean).join(', ')}</span><ChevronRight size={15} /></button>)}</div></div>}
            </section>
          ) : (
            <>
              <section className="weather-grid">
                <article className={`current-card weather-${backgroundKind}`}>
                  {loading && !current ? <div className="current-skeleton"><span /><span /><span /><span /></div> : current ? (
                    <>
                      <div className="current-topline"><div className="current-location"><MapPin size={15} /><span>{placeLabel(place)}</span><ChevronDown size={14} /></div><div className="current-tools">
                        <button title="Refresh weather" aria-label="Refresh weather" onClick={() => void loadWeather(place, false)} className={loading ? 'spin' : ''}><span className="refresh-glyph">↻</span></button>
                        <button title={isFavorite ? 'Remove saved location' : 'Save location'} aria-label={isFavorite ? 'Remove saved location' : 'Save location'} className={isFavorite ? 'is-saved' : ''} onClick={toggleFavorite}>{isFavorite ? <Check size={16} /> : <Bookmark size={16} />}</button>
                        <button title="Share weather" aria-label="Share weather" onClick={() => void shareReport()}><Share2 size={16} /></button>
                      </div></div>
                      <div className="current-main">
                        <div><div className="weather-caption">CURRENT WEATHER</div><div className="temperature">{celsius(current.main.temp, unit)}<sup>°{unit}</sup></div><div className="condition-line"><span className="condition-symbol">{conditionIcon(currentCondition?.id, 21)}</span><span className="condition-text">{currentCondition?.description}</span></div></div>
                        <div className="hero-weather-icon">{conditionIcon(currentCondition?.id, 94)}</div>
                      </div>
                      <div className="feels-row"><span>Feels like {celsius(current.main.feels_like, unit)}°{unit}</span><span className="feels-divider" /><span>{currentCondition?.main}</span><span className="feels-divider" /><span>H:{celsius(current.main.temp_max, unit)}° <i>·</i> L:{celsius(current.main.temp_min, unit)}°</span></div>
                      <div className="current-footer"><span><Sunrise size={15} /> Sunrise <strong>{timeAt(current.sys.sunrise, offset)}</strong></span><span><Sunset size={15} /> Sunset <strong>{timeAt(current.sys.sunset, offset)}</strong></span><span className="updated-time">Updated {timeAt(current.dt, offset)}</span></div>
                    </>
                  ) : <div className="current-error"><CloudSun size={34} /><h3>Weather is taking a moment</h3><p>{error || 'Please refresh to try again.'}</p><button onClick={() => void loadWeather(place, false)}>Try again</button></div>}
                </article>
                <article className="details-card">
                  <div className="card-heading"><div><p className="eyebrow">AT A GLANCE</p><h2>Today’s details</h2></div><span className="detail-date">{new Date().toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span></div>
                  {loading && !current ? <div className="detail-skeleton"><span /><span /><span /><span /></div> : current ? <div className="detail-grid">
                    <Detail icon={<Thermometer />} label="Feels like" value={`${celsius(current.main.feels_like, unit)}°${unit}`} note="What it feels like" />
                    <Detail icon={<Droplets />} label="Humidity" value={`${current.main.humidity}%`} note={current.main.humidity > 70 ? 'A little muggy' : 'Comfortable'} />
                    <Detail icon={<Wind />} label="Wind" value={`${Math.round(current.wind.speed * 3.6)} km/h`} note={`${windDirection(current.wind.deg)} direction`} />
                    <Detail icon={<Gauge />} label="Pressure" value={`${current.main.pressure}`} unit="hPa" note="Atmospheric pressure" />
                    <Detail icon={<Cloud />} label="Visibility" value={`${(current.visibility / 1000).toFixed(1)}`} unit="km" note="Across the horizon" />
                    <Detail icon={<Sun />} label="Air quality" value={airLabel(weather?.airQuality ?? null)} note="OpenWeather index" />
                  </div> : <div className="detail-error">Weather details will appear when data is available.</div>}
                </article>
              </section>

              <section className="content-grid">
                <div className="left-stack">
                  <article className="panel hourly-panel">
                    <div className="section-heading compact"><div><p className="eyebrow">THE NEXT FEW HOURS</p><h2>Hourly forecast</h2></div><button className="quiet-button" onClick={() => setSection('Forecast')}>Next 24 hours <ChevronRight size={15} /></button></div>
                    {loading && !weather ? <div className="hourly-skeleton">{Array.from({ length: 6 }, (_, i) => <span key={i} />)}</div> : hourly.length ? <div className="hourly-list">
                      {hourly.map((item, index) => <div className={`hour-item ${index === 0 ? 'hour-now' : ''}`} key={item.dt}><span className="hour-time">{index === 0 ? 'Now' : timeAt(item.dt, offset, { hour: 'numeric' })}</span><span className="hour-icon">{conditionIcon(item.weather[0]?.id, 22)}</span><strong>{celsius(item.main.temp, unit)}°</strong><span className="hour-rain"><Droplets size={12} /> {Math.round(item.pop * 100)}%</span></div>)}
                    </div> : <div className="detail-error">Hourly forecast is currently unavailable.</div>}
                  </article>
                  <article className="panel chart-panel">
                    <div className="section-heading compact"><div><p className="eyebrow">A LITTLE MORE DETAIL</p><h2>Temperature trend</h2></div><span className="chart-unit">°{unit}</span></div>
                    {chartData.length > 0 ? <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 12, right: 5, left: -25, bottom: 0 }}>
                        <defs><linearGradient id="temperatureFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#66a8f5" stopOpacity={0.19} /><stop offset="95%" stopColor="#66a8f5" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} dy={9} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(value) => `${value}°`} />
                        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 12 }} formatter={(value) => [`${value}°${unit}`, 'Temperature']} />
                        <Area type="monotone" dataKey="temp" stroke="#4d9af0" strokeWidth={2.5} fill="url(#temperatureFill)" activeDot={{ r: 5, fill: '#4d9af0', stroke: 'var(--card)', strokeWidth: 2 }} />
                      </AreaChart>
                    </ResponsiveContainer></div> : <div className="detail-error">A temperature chart will appear with the forecast.</div>}
                    <div className="chart-legend"><span><i className="legend-dot temp-dot" />Temperature</span><span><i className="legend-dot humidity-dot" />Humidity: {forecast[0]?.main.humidity ?? '—'}%</span><span><i className="legend-dot wind-dot" />Wind: {forecast[0] ? Math.round(forecast[0].wind.speed * 3.6) : '—'} km/h</span></div>
                  </article>
                </div>
                <article className="panel forecast-panel">
                  <div className="section-heading compact"><div><p className="eyebrow">PLAN AHEAD</p><h2>5-day forecast</h2></div><button className="icon-button small-chevron" onClick={() => setSection('Forecast')} aria-label="View forecast"><ChevronRight size={17} /></button></div>
                  {daily.length ? <div className="daily-list">{daily.map((day, index) => <div key={day.date} className="day-wrap">
                    <button className={`day-row ${expandedDay === index ? 'day-expanded' : ''}`} onClick={() => setExpandedDay(expandedDay === index ? null : index)}>
                      <span className="day-name">{index === 0 ? 'Today' : formatDay(day.date)}</span><span className="day-weather-icon">{conditionIcon(day.item.weather[0]?.id, 21)}</span><span className="day-condition">{day.item.weather[0]?.main}</span><span className="day-rain">{day.rain >= 0.1 && <><Droplets size={12} />{Math.round(day.rain * 100)}%</>}</span><span className="day-temps"><b>{celsius(day.max, unit)}°</b><span>{celsius(day.min, unit)}°</span></span><ChevronDown size={14} className="day-chevron" />
                    </button>
                    {expandedDay === index && <div className="day-details"><span>Humidity <strong>{day.item.main.humidity}%</strong></span><span>Wind <strong>{Math.round(day.item.wind.speed * 3.6)} km/h</strong></span><span>Pressure <strong>{day.item.main.pressure} hPa</strong></span><span>Rain chance <strong>{Math.round(day.rain * 100)}%</strong></span></div>}
                  </div>)}</div> : <div className="detail-error">Forecast data is currently unavailable.</div>}
                  <div className="forecast-note"><span className="note-dot" /> Forecasts are available up to 5 days ahead.</div>
                </article>
              </section>

              <section className="bottom-strip">
                <div className="recommendation"><span className="recommend-icon">{currentCondition && currentCondition.id >= 500 && currentCondition.id < 600 ? <CloudRain size={20} /> : <Sun size={20} />}</span><div><span className="recommend-label">A SMALL SUGGESTION</span><strong>{currentCondition && currentCondition.id >= 500 && currentCondition.id < 600 ? 'An umbrella might come in handy.' : current && current.main.temp > 24 ? 'Light layers should feel just right today.' : 'A light layer is a lovely idea today.'}</strong></div></div>
                <button className="updated-pill" onClick={() => void loadWeather(place, false)}><span className="live-dot" />{loading ? 'Updating…' : `Updated ${current ? timeAt(current.dt, offset) : '—'}`}<span className="refresh-small">↻</span></button>
              </section>

              {section === 'Forecast' && <section className="forecast-extra panel"><p className="eyebrow">MORE FROM THE FORECAST</p><h2>Humidity & wind by hour</h2><div className="mini-charts">
                <MiniChart title="Humidity" data={chartData} dataKey="humidity" color="#55b9ad" unit="%" />
                <MiniChart title="Wind speed" data={chartData} dataKey="wind" color="#a58adb" unit=" km/h" />
              </div></section>}

              {recents.length > 0 && section === 'Home' && <section className="quick-recent"><span>RECENTLY VIEWED</span>{recents.slice(0, 3).map((recent) => <button key={`${recent.lat}-${recent.lon}`} onClick={() => choosePlace(recent)}>{recent.name}<ChevronRight size={13} /></button>)}</section>}
            </>
          )}
          <footer className="page-footer"><span>Made for a little more clarity <span className="footer-sun">✳</span></span><span>Weather data by OpenWeatherMap <span>·</span> Your weather, thoughtfully.</span></footer>
        </main>
      </div>
      {mobileMenu && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
    </div>
  )
}

function Detail({ icon, label, value, unit, note }: { icon: React.ReactNode; label: string; value: string; unit?: string; note: string }) {
  return <div className="detail-item"><span className="detail-icon">{icon}</span><div><span className="detail-label">{label}</span><strong className="detail-value">{value}{unit && <small> {unit}</small>}</strong><span className="detail-note">{note}</span></div></div>
}

function FavoriteCard({ place, unit, onSelect, onRemove }: { place: Place; unit: TemperatureUnit; onSelect: (place: Place) => void; onRemove: (place: Place) => void }) {
  const [data, setData] = useState<WeatherBundle | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    getWeather(place.lat, place.lon).then((result) => { if (active) setData(result) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [place.lat, place.lon])
  const current = data?.current
  return <article className="location-card">  <button className="location-main" onClick={() => onSelect(place)}><span className="location-card-icon">{conditionIcon(current?.weather[0]?.id, 27)}</span><span className="location-card-name"><strong>{place.name}</strong><small>{[place.state, countryLabel(place.country)].filter(Boolean).join(', ')}</small></span><span className="location-temperature">{current ? `${celsius(current.main.temp, unit)}°` : error ? '—' : '…'}<small>{current?.weather[0]?.main || (error ? 'Unavailable' : 'Loading')}</small></span></button><div className="location-card-bottom"><span>{current ? `H:${celsius(current.main.temp_max, unit)}° · L:${celsius(current.main.temp_min, unit)}°` : 'Current conditions'}</span><button aria-label={`Remove ${place.name}`} onClick={() => onRemove(place)}><X size={15} /></button></div></article>
}

function MiniChart({ title, data, dataKey, color, unit }: { title: string; data: Array<Record<string, string | number>>; dataKey: string; color: string; unit: string }) {
  return <div className="mini-chart"><h3>{title}</h3><div><ResponsiveContainer width="100%" height="100%"><AreaChart data={data}><defs><linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.2} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 12 }} formatter={(value) => [`${value}${unit}`, title]} /><Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#fill-${dataKey})`} /></AreaChart></ResponsiveContainer></div></div>
}

export default App
