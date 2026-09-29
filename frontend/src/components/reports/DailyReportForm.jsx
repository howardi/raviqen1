import React, { useState } from "react";
import { Loader2, Send, Paperclip } from "lucide-react";

const DEPARTMENTS = [
  { value: "restaurant", label: "Restaurant / F&B" },
  { value: "operations", label: "Operations" },
  { value: "front_desk", label: "Front Desk" },
  { value: "hr", label: "Human Resources" },
  { value: "finance", label: "Finance" },
  { value: "general", label: "General" },
];

export default function DailyReportForm({ user, onSubmit }) {
  const [department, setDepartment] = useState("restaurant");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [priority, setPriority] = useState("normal");
  const [metrics, setMetrics] = useState({ revenue: "", covers: "", incidents: "", notes: "" });
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    let file_url = null;
    if (file) {
      try {
        const res = await import("@/api/base44Client").then((m) => m.base44.integrations.Core.UploadFile({ file }));
        file_url = res.file_url;
      } catch (e) {}
    }
    await onSubmit({
      department,
      title: title.trim(),
      content: content.trim(),
      report_date: reportDate,
      priority,
      metrics: Object.fromEntries(Object.entries(metrics).filter(([, v]) => v)),
      file_url,
    });
    setTitle("");
    setContent("");
    setMetrics({ revenue: "", covers: "", incidents: "", notes: "" });
    setFile(null);
    setPriority("normal");
    setSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <h3 className="text-sm font-semibold text-[#231F20]">Submit Daily Report</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Department</label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none bg-white"
          >
            {DEPARTMENTS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1.5 block">Report Date</label>
          <input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Report Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Daily Operations Summary — Sept 6"
          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 mb-1.5 block">Report Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={5}
          placeholder="Enter your daily operational report — activities, issues, highlights, staffing notes..."
          className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none resize-y"
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Revenue</label>
          <input type="text" value={metrics.revenue} onChange={(e) => setMetrics({ ...metrics, revenue: e.target.value })} placeholder="$0" className="w-full text-sm px-2 py-1.5 rounded-lg border border-slate-200 outline-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Covers/Guests</label>
          <input type="text" value={metrics.covers} onChange={(e) => setMetrics({ ...metrics, covers: e.target.value })} placeholder="0" className="w-full text-sm px-2 py-1.5 rounded-lg border border-slate-200 outline-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Incidents</label>
          <input type="text" value={metrics.incidents} onChange={(e) => setMetrics({ ...metrics, incidents: e.target.value })} placeholder="0" className="w-full text-sm px-2 py-1.5 rounded-lg border border-slate-200 outline-none" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full text-sm px-2 py-1.5 rounded-lg border border-slate-200 outline-none bg-white">
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors text-xs text-slate-600">
          <Paperclip className="w-3.5 h-3.5" />
          {file ? file.name : "Attach file"}
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
        </label>
        {file && (
          <button type="button" onClick={() => setFile(null)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || !title.trim() || !content.trim()}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        Submit Report
      </button>
    </form>
  );
}