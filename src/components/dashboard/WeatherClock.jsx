import React, { useState, useEffect } from "react";
import { MapPin, Loader2, Wind, Droplets, CloudOff } from "lucide-react";

// WMO weather code → { label, emoji }
const WEATHER_CODES = {
  0: { label: "Clear sky", emoji: "☀️" },
  1: { label: "Mainly clear", emoji: "🌤️" },
  2: { label: "Partly cloudy", emoji: "⛅" },
  3: { label: "Overcast", emoji: "☁️" },
  45: { label: "Fog", emoji: "🌫️" },
  48: { label: "Rime fog", emoji: "🌫️" },
  51: { label: "Light drizzle", emoji: "🌦️" },
  53: { label: "Drizzle", emoji: "🌦️" },
  55: { label: "Heavy drizzle", emoji: "🌧️" },
  56: { label: "Freezing drizzle", emoji: "🌧️" },
  57: { label: "Freezing drizzle", emoji: "🌧️" },
  61: { label: "Light rain", emoji: "🌦️" },
  63: { label: "Rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  66: { label: "Freezing rain", emoji: "🌧️" },
  67: { label: "Freezing rain", emoji: "🌧️" },
  71: { label: "Light snow", emoji: "🌨️" },
  73: { label: "Snow", emoji: "🌨️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  77: { label: "Snow grains", emoji: "🌨️" },
  80: { label: "Rain showers", emoji: "🌦️" },
  81: { label: "Rain showers", emoji: "🌧️" },
  82: { label: "Violent showers", emoji: "⛈️" },
  85: { label: "Snow showers", emoji: "🌨️" },
  86: { label: "Snow showers", emoji: "🌨️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm", emoji: "⛈️" },
  99: { label: "Thunderstorm", emoji: "⛈️" },
};

export default function WeatherClock({ className = "" }) {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Live clock — ticks every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Resolve location (city + coords) then fetch current weather.
  // Primary: IP-based geolocation (no permission prompt). Fallback: browser geolocation.
  // City name is confirmed via reverse-geocoding when the IP source omits it.
  useEffect(() => {
    let cancelled = false;

    const reverseGeocode = async (lat, lon) => {
      try {
        const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
        const res = await fetch(url);
        if (!res.ok) return "";
        const d = await res.json();
        if (cancelled) return "";
        return d.city || d.locality || d.principalSubdivision || d.countryName || "";
      } catch (e) {
        return "";
      }
    };

    const fetchWeather = async (lat, lon, cityName) => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("weather fetch failed");
        const data = await res.json();
        if (cancelled) return;
        const cur = data.current;
        const code = WEATHER_CODES[cur.weather_code] || { label: "—", emoji: "🌡️" };
        setWeather({
          temp: Math.round(cur.temperature_2m),
          humidity: cur.relative_humidity_2m,
          wind: Math.round(cur.wind_speed_10m),
          label: code.label,
          emoji: code.emoji,
        });
        let finalCity = cityName;
        if (!finalCity) finalCity = await reverseGeocode(lat, lon);
        if (cancelled) return;
        setCity(finalCity || "");
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      }
    };

    const viaIp = async () => {
      try {
        const res = await fetch("https://ipwho.is/");
        if (!res.ok) throw new Error("ip lookup failed");
        const d = await res.json();
        if (cancelled) return;
        if (d && d.success !== false && d.latitude && d.longitude) {
          await fetchWeather(d.latitude, d.longitude, d.city || d.region || "");
          return;
        }
        throw new Error("no coords");
      } catch (e) {
        if (cancelled) return;
        // Fallback to browser geolocation
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              if (cancelled) return;
              await fetchWeather(pos.coords.latitude, pos.coords.longitude, "");
            },
            () => {
              if (cancelled) return;
              setError(true);
              setLoading(false);
            },
            { timeout: 8000 }
          );
        } else {
          setError(true);
          setLoading(false);
        }
      }
    };

    viaIp();
    return () => { cancelled = true; };
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className={`inline-flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm ${className}`}>
      {/* Weather */}
      <div className="flex items-center gap-2">
        {loading ? (
          <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
        ) : error || !weather ? (
          <CloudOff className="w-4 h-4 text-slate-400" />
        ) : (
          <>
            <span className="text-lg leading-none">{weather.emoji}</span>
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold text-[#231F20] tabular-nums">{weather.temp}°C</span>
              <span className="text-[10px] text-slate-400">{weather.label}</span>
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-slate-200" />

      {/* City + conditions */}
      <div className="flex flex-col leading-tight min-w-0">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 truncate">
          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
          {city || (loading ? "Locating…" : "Unavailable")}
        </span>
        {weather && !error && (
          <span className="inline-flex items-center gap-2 text-[10px] text-slate-400">
            <span className="inline-flex items-center gap-0.5"><Droplets className="w-2.5 h-2.5" />{weather.humidity}%</span>
            <span className="inline-flex items-center gap-0.5"><Wind className="w-2.5 h-2.5" />{weather.wind}km/h</span>
          </span>
        )}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-slate-200" />

      {/* Live clock + date */}
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-semibold text-[#231F20] tabular-nums">{timeStr}</span>
        <span className="text-[10px] text-slate-400">{dateStr}</span>
      </div>
    </div>
  );
}