import React, { useEffect, useState } from "react";
import { MapPin, Droplets, Wind } from "lucide-react";

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
  61: { label: "Light rain", emoji: "🌦️" },
  63: { label: "Rain", emoji: "🌧️" },
  65: { label: "Heavy rain", emoji: "🌧️" },
  71: { label: "Light snow", emoji: "🌨️" },
  73: { label: "Snow", emoji: "🌨️" },
  75: { label: "Heavy snow", emoji: "❄️" },
  77: { label: "Snow grains", emoji: "🌨️" },
  80: { label: "Rain showers", emoji: "🌦️" },
  81: { label: "Rain showers", emoji: "🌧️" },
  82: { label: "Violent showers", emoji: "⛈️" },
  85: { label: "Snow showers", emoji: "🌨️" },
  86: { label: "Snow showers", emoji: "❄️" },
  95: { label: "Thunderstorm", emoji: "⛈️" },
  96: { label: "Thunderstorm", emoji: "⛈️" },
  99: { label: "Severe storm", emoji: "⛈️" },
};

function greetingFor(hour) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function LiveInfoBar() {
  const [now, setNow] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

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
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              if (cancelled) return;
              await fetchWeather(pos.coords.latitude, pos.coords.longitude, "");
            },
            () => { if (!cancelled) setLoading(false); },
            { timeout: 8000 }
          );
        } else {
          setLoading(false);
        }
      }
    };

    viaIp();
    return () => { cancelled = true; };
  }, []);

  const hour = now.getHours();
  const greeting = greetingFor(hour);
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="w-full border-b border-slate-800/60 bg-gradient-to-r from-emerald-950/30 via-slate-900/40 to-slate-950/30 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-2.5 sm:py-3 flex items-center justify-between flex-wrap gap-2 sm:gap-3">
        {/* Greeting */}
        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
          <span className="text-base sm:text-lg shrink-0">{greeting === "Good morning" ? "☀️" : greeting === "Good afternoon" ? "🌤️" : "🌙"}</span>
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold text-white">{greeting}.</p>
            <p className="text-[11px] text-slate-400 truncate">Welcome to RAVIQEN — your live risk intelligence briefing</p>
          </div>
        </div>

        {/* Live weather + clock */}
        <div className="flex items-center gap-2 sm:gap-3 text-slate-300">
          {weather && (
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-700/60 bg-slate-900/40">
              <span className="text-sm sm:text-base">{weather.emoji}</span>
              <span className="text-sm font-semibold text-white">{weather.temp}°C</span>
              <span className="hidden sm:inline text-[11px] text-slate-400">{weather.label}</span>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Droplets className="w-3 h-3" />{weather.humidity}%
              </span>
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400">
                <Wind className="w-3 h-3" />{weather.wind}km/h
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-700/60 bg-slate-900/40">
            <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium text-white truncate max-w-[90px] sm:max-w-[120px]">
              {loading && !city ? "Locating…" : (city || "Unavailable")}
            </span>
          </div>
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-slate-700/60 bg-slate-900/40">
            <div className="leading-tight text-right">
              <p className="text-xs sm:text-sm font-semibold text-white tabular-nums">{timeStr}</p>
              <p className="text-[10px] sm:text-[11px] text-slate-400">{dateStr}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}