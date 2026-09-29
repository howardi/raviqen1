import React, { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { Plus, CheckCircle2, XCircle, Settings, Loader2, Plug, Sparkles, X, Lightbulb } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { suggestIntegrations } from "@/lib/advancedAI";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "raviqen_integrations";

const defaultIntegrations = [
  { id: "ezee_burrp", name: "eZee Burrp POS", category: "Point of Sale", connected: true, desc: "Restaurant POS transaction sync" },
  { id: "quickbooks", name: "QuickBooks", category: "Accounting", connected: false, desc: "Financial data and vendor payments" },
  { id: "xero", name: "Xero", category: "Accounting", connected: false, desc: "Cloud accounting integration" },
  { id: "stripe", name: "Stripe", category: "Payments", connected: true, desc: "Payment processing and payouts" },
  { id: "sap", name: "SAP ERP", category: "ERP", connected: false, desc: "Enterprise resource planning" },
  { id: "oracle", name: "Oracle NetSuite", category: "ERP", connected: false, desc: "Cloud ERP and financials" },
  { id: "slack", name: "Slack", category: "Notifications", connected: false, desc: "Alert notifications and approvals" },
  { id: "gmail", name: "Gmail", category: "Email", connected: true, desc: "Report delivery and alerts" },
];

function loadIntegrations() {
  try { const s = localStorage.getItem(STORAGE_KEY); return s ? JSON.parse(s) : defaultIntegrations; } catch { return defaultIntegrations; }
}
function saveIntegrations(items) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch {} }

export default function Integrations() {
  const { toast } = useToast();
  const [items, setItems] = useState(loadIntegrations);
  const [connecting, setConnecting] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("Accounting");
  const [newDesc, setNewDesc] = useState("");
  const [recommendations, setRecommendations] = useState(null);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => { saveIntegrations(items); }, [items]);

  const handleToggle = (id) => {
    const item = items.find((i) => i.id === id);
    if (item.connected) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, connected: false } : i)));
      toast({ title: "Disconnected", description: `${item.name} has been disconnected.` });
    } else {
      setConnecting(id);
      setTimeout(() => {
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, connected: true } : i)));
        setConnecting(null);
        toast({ title: "Connected", description: `${item.name} is now connected and syncing.` });
      }, 800);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newName) return;
    const id = newName.toLowerCase().replace(/\s+/g, "_");
    setItems((prev) => [...prev, { id, name: newName, category: newCategory, connected: false, desc: newDesc || "Custom integration" }]);
    setShowAddModal(false); setNewName(""); setNewDesc("");
    toast({ title: "Integration added", description: `${newName} is now available to connect.` });
  };

  const handleRecommend = async () => {
    setRecLoading(true);
    try {
      const transactions = await base44.entities.Transaction.list("-created_date", 100);
      const result = await suggestIntegrations(transactions);
      setRecommendations(result.recommendations || []);
    } catch (e) { console.error(e); }
    setRecLoading(false);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">Integrations</h1>
            <p className="text-xs text-slate-500">Connected data sources and API integrations</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={handleRecommend} disabled={recLoading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors">
              {recLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Recommend
            </button>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Integration
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-4">
        {/* AI Recommendations */}
        {recommendations && (
          <div className="bg-gradient-to-br from-indigo-50 to-white rounded-xl border border-indigo-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-[#231F20]">AI Integration Recommendations</h3>
            </div>
            <div className="space-y-2">
              {recommendations.map((r, i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-200 bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-[#231F20]">{r.name}</p>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", r.priority === "high" ? "bg-red-50 text-red-700" : r.priority === "medium" ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600")}>{r.priority}</span>
                  </div>
                  <p className="text-xs text-slate-600">{r.reason}</p>
                  <p className="text-xs text-indigo-600 mt-1">Provides: {r.data_provided}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.id} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Plug className="w-5 h-5 text-slate-600" />
                </div>
                {item.connected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[11px] font-medium border border-slate-200">
                    <XCircle className="w-3 h-3" /> Available
                  </span>
                )}
              </div>
              <h3 className="text-sm font-semibold text-[#231F20]">{item.name}</h3>
              <p className="text-xs text-slate-400 mb-1">{item.category}</p>
              <p className="text-xs text-slate-500 mb-4">{item.desc}</p>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(item.id)} disabled={connecting === item.id} className={cn("flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50", item.connected ? "border border-slate-200 text-slate-600 hover:bg-slate-50" : "bg-slate-900 text-white hover:bg-slate-800")}>
                  {connecting === item.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {item.connected ? "Disconnect" : connecting === item.id ? "Connecting..." : "Connect"}
                </button>
                {item.connected && (
                  <button onClick={() => toast({ title: "Settings", description: `Configure ${item.name} connection settings.` })} className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Integration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#231F20]">Add Custom Integration</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Name</label>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} required placeholder="Integration name" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none bg-white">
                  <option>Accounting</option><option>Payments</option><option>ERP</option><option>Point of Sale</option><option>Notifications</option><option>Email</option><option>Other</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">Description</label>
                <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="What does this integration provide?" className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-slate-400" />
              </div>
              <button type="submit" className="w-full px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors">Add Integration</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}