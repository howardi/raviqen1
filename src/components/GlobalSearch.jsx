import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Search, Loader2, ArrowRight, ShieldAlert, FileSearch, FileText, TrendingUp, Save, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

const ENTITY_CONFIG = [
  { key: "Transaction", label: "Transactions", icon: TrendingUp, path: "/alerts", searchFields: ["transaction_id", "vendor", "description"], displayField: "transaction_id", subField: "vendor" },
  { key: "Alert", label: "Alerts", icon: ShieldAlert, path: "/alerts", searchFields: ["title", "vendor", "description"], displayField: "title", subField: "vendor" },
  { key: "Investigation", label: "Investigations", icon: FileSearch, path: "/investigations", searchFields: ["title", "vendor", "transaction_id"], displayField: "title", subField: "vendor", detailPath: "/investigations/" },
  { key: "DailyReport", label: "Daily Reports", icon: FileText, path: "/daily-reports", searchFields: ["title", "content", "department"], displayField: "title", subField: "department" },
];

const PRESETS_KEY = "raviqen_search_presets";

export default function GlobalSearch({ isOpen, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [presets, setPresets] = useState([]);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PRESETS_KEY) || "[]");
      setPresets(saved);
    } catch (e) { setPresets([]); }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
      setSelectedIndex(0);
      setShowSavePrompt(false);
    }
  }, [isOpen]);

  const performSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const allResults = await Promise.all(
        ENTITY_CONFIG.map(async (cfg) => {
          try {
            const records = await base44.entities[cfg.key].list("-created_date", 20);
            const filtered = (records || []).filter((r) =>
              cfg.searchFields.some((f) => {
                const val = r[f];
                return val && String(val).toLowerCase().includes(q.toLowerCase());
              })
            );
            return filtered.slice(0, 5).map((r) => ({
              ...r,
              _entity: cfg.key,
              _label: cfg.label,
              _icon: cfg.icon,
              _path: cfg.detailPath ? `${cfg.detailPath}${r.id}` : cfg.path,
              _display: r[cfg.displayField] || "Untitled",
              _sub: r[cfg.subField] || "",
            }));
          } catch (e) { return []; }
        })
      );
      setResults(allResults.flat().slice(0, 20));
      setSelectedIndex(0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 250);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIndex((p) => Math.min(p + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIndex((p) => Math.max(p - 1, 0)); }
    else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigate(results[selectedIndex]._path);
      onClose();
    } else if (e.key === "Escape") { onClose(); }
  };

  const handleResultClick = (result) => {
    navigate(result._path);
    onClose();
  };

  const savePreset = () => {
    if (!query || query.length < 2) return;
    const newPresets = [...new Set([...presets, query])].slice(0, 10);
    setPresets(newPresets);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(newPresets));
    setShowSavePrompt(false);
  };

  const grouped = results.reduce((acc, r) => {
    if (!acc[r._entity]) acc[r._entity] = [];
    acc[r._entity].push(r);
    return acc;
  }, {});

  let flatIndex = 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[10vh] px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search transactions, alerts, investigations, entities, reports..."
            className="flex-1 text-sm outline-none placeholder:text-slate-400"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          {query.length >= 2 && !loading && (
            <button onClick={() => setShowSavePrompt(true)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Save search preset">
              <Bookmark className="w-4 h-4 text-slate-400" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200">ESC</kbd>
        </div>

        {/* Save prompt */}
        {showSavePrompt && (
          <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border-b border-amber-100">
            <Save className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs text-amber-700 flex-1">Save "{query}" as a preset?</span>
            <button onClick={savePreset} className="px-2.5 py-1 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700">Save</button>
            <button onClick={() => setShowSavePrompt(false)} className="px-2 py-1 text-xs text-amber-600 hover:text-amber-800">Cancel</button>
          </div>
        )}

        {/* Presets */}
        {query.length === 0 && presets.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Saved Presets</p>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button key={p} onClick={() => setQuery(p)} className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {query.length < 2 ? (
            <div className="px-4 py-12 text-center">
              <Search className="w-8 h-8 mx-auto text-slate-200 mb-2" />
              <p className="text-sm text-slate-400">Type at least 2 characters to search across the platform</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-slate-400">No results found for "{query}"</p>
            </div>
          ) : (
            Object.entries(grouped).map(([entityKey, items]) => {
              const cfg = ENTITY_CONFIG.find((c) => c.key === entityKey);
              const Icon = cfg?.icon || Search;
              return (
                <div key={entityKey}>
                  <div className="px-4 py-1.5 bg-slate-50/80 border-b border-slate-100 sticky top-0">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">{cfg?.label || entityKey}</span>
                  </div>
                  {items.map((item) => {
                    const idx = flatIndex++;
                    const ItemIcon = item._icon;
                    return (
                      <button
                        key={item.id || idx}
                        onClick={() => handleResultClick(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b border-slate-50",
                          selectedIndex === idx ? "bg-slate-100" : "hover:bg-slate-50/60"
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                          <ItemIcon className="w-4 h-4 text-slate-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#231F20] truncate">{item._display}</p>
                          {item._sub && <p className="text-xs text-slate-400 truncate">{item._sub}</p>}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 rounded bg-white border border-slate-200 font-mono">↵</kbd> Open</span>
          </div>
          <span>{results.length} results</span>
        </div>
      </div>
    </div>
  );
}