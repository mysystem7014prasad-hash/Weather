# WeatherWise

WeatherWise is a responsive weather dashboard built with React, TypeScript, Tailwind CSS, Express, and OpenWeatherMap. It uses live weather data and does not include mock weather responses.

## Requirements

- Node.js 20 or newer
- An OpenWeatherMap API key with access to Current Weather, 5 Day / 3 Hour Forecast, Geocoding, and Air Pollution APIs

## Run locally

1. Install packages:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and add your API key:

   ```env
   OPENWEATHER_API_KEY=your_openweathermap_api_key
   PORT=3001
   ```

3. Start the API server and Vite development server:

   ```sh
   npm run dev
   ```

4. Open the local address printed by Vite (usually `http://localhost:5173`).

The Express server keeps the OpenWeatherMap key out of the frontend bundle. In production, deploy the frontend and API behind the same origin or configure your reverse proxy to forward `/api` to the Express server. The Vite proxy is only for local development.

## Features

- Search cities worldwide with live geocoding suggestions, or use browser location.
- Current conditions, sunrise/sunset, feels-like temperature, humidity, wind, pressure, visibility, and air quality when the API provides it.
- Hourly and up-to-5-day forecasts with temperature, humidity, and wind charts.
- Expandable daily details, weather recommendations, and shareable reports.
- Saved locations, recent searches, light/dark mode, and Celsius/Fahrenheit preferences stored in this browser.
- Responsive layouts, loading states, and explicit error messages.

OpenWeatherMap's standard forecast endpoint provides up to five days in three-hour intervals, not a seven-day forecast or dedicated 24-hour hourly forecast. WeatherWise presents the actual available range rather than inventing data. Air-quality data is optional and may be unavailable for some locations or API plans.
