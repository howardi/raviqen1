import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { LifeBuoy, Send, Loader2, CheckCircle2, Clock, MessageSquare } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { stampTenant } from "@/lib/tenantScope";

const categoryConfig = {
  bug: { label: "Bug Report", color: "text-red-600 bg-red-50" },
  question: { label: "Question", color: "text-blue-600 bg-blue-50" },
  feature_request: { label: "Feature Request", color: "text-purple-600 bg-purple-50" },
  account: { label: "Account Issue", color: "text-amber-600 bg-amber-50" },
  data_ingestion: { label: "Data Ingestion", color: "text-teal-600 bg-teal-50" },
  other: { label: "Other", color: "text-slate-600 bg-slate-100" },
};

const priorityConfig = {
  low: { label: "Low", color: "text-slate-600" },
  medium: { label: "Medium", color: "text-amber-600" },
  high: { label: "High", color: "text-orange-600" },
  urgent: { label: "Urgent", color: "text-red-600" },
};

const statusConfig = {
  open: { label: "Open", color: "text-blue-600 bg-blue-50", icon: Clock },
  in_progress: { label: "In Progress", color: "text-amber-600 bg-amber-50", icon: Loader2 },
  resolved: { label: "Resolved", color: "text-emerald-600 bg-emerald-50", icon: CheckCircle2 },
  closed: { label: "Closed", color: "text-slate-500 bg-slate-100", icon: CheckCircle2 },
};

export default function TechnicalSupport() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ subject: "", category: "question", priority: "medium", description: "" });

  useEffect(() => { loadTickets(); }, []);

  const loadTickets = async () => {
    try {
      const data = await base44.entities.SupportTicket.list("-created_date", 20);
      setTickets(data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await base44.entities.SupportTicket.create(stampTenant({ ...form, status: "open" }, user));
      // Notify support team
      try {
        await base44.integrations.Core.SendEmail({
          to: "support@raviqen.com",
          subject: `[${form.priority.toUpperCase()}] ${form.subject}`,
          body: `New support ticket submitted.\n\nCategory: ${form.category}\nPriority: ${form.priority}\nSubject: ${form.subject}\n\nDescription:\n${form.description}\n\n---\nSubmitted via RAVIQEN Technical Support`,
        });
      } catch (e) { /* email notification non-critical */ }
      setForm({ subject: "", category: "question", priority: "medium", description: "" });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
      await loadTickets();
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-[#231F20]">Technical Support</h1>
        <p className="text-xs text-slate-500">Submit a support request and track its status · <a href="mailto:support@raviqen.com" className="text-blue-600 hover:underline font-medium">support@raviqen.com</a></p>
      </header>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <LifeBuoy className="w-5 h-5 text-slate-600" />
            <h3 className="text-sm font-semibold text-[#231F20]">New Support Request</h3>
          </div>
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <p className="text-sm text-emerald-700">Support request submitted. Our team will get back to you shortly.</p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Subject</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Brief description of the issue"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 outline-none bg-white"
                >
                  {Object.entries(categoryConfig).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 outline-none bg-white"
                >
                  {Object.entries(priorityConfig).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Description</label>
              <textarea
                required
                rows={5}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe the issue in detail. What were you trying to do? What error did you see?"
                className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none resize-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Submit Support Request
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-[#231F20] mb-4">Your Support Requests</h3>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg bg-slate-100 animate-pulse" />)}</div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No support requests yet</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {tickets.map((t) => {
                const cat = categoryConfig[t.category] || categoryConfig.other;
                const pri = priorityConfig[t.priority] || priorityConfig.medium;
                const st = statusConfig[t.status] || statusConfig.open;
                const SIcon = st.icon;
                return (
                  <div key={t.id} className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-[#231F20]">{t.subject}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${st.color} inline-flex items-center gap-1 shrink-0`}>
                        <SIcon className="w-3 h-3" /> {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-2">{t.description}</p>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className={`px-2 py-0.5 rounded-full ${cat.color} font-medium`}>{cat.label}</span>
                      <span className={`${pri.color} font-medium`}>{pri.label} priority</span>
                      <span className="text-slate-400 ml-auto">{new Date(t.created_date).toLocaleDateString()}</span>
                    </div>
                    {t.response && (
                      <div className="mt-2 p-2 rounded-lg bg-slate-50 text-xs text-slate-600">
                        <span className="font-medium text-slate-700">Support: </span>{t.response}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}