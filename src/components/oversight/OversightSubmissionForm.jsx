import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES, formSchemaFor } from "@/lib/oversight";

function emptyPurchases() {
  return [{ item: "", quantity: "", unit_price: "", supplier: "", receipt_url: "" }];
}

export default function OversightSubmissionForm({ department, schema, onSubmitted }) {
  const form = formSchemaFor(department, schema);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [priority, setPriority] = useState("normal");
  const [metrics, setMetrics] = useState({});
  const [purchases, setPurchases] = useState(emptyPurchases);
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [weekly, setWeekly] = useState(null);

  const uploadFiles = async () => {
    const urls = [];
    for (const file of files) {
      if (!ALLOWED_UPLOAD_TYPES.includes(file.type) || file.size > MAX_UPLOAD_BYTES) {
        throw new Error("Attachments must be images, PDF or spreadsheet files under 8MB.");
      }
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res?.file_url) urls.push(res.file_url);
    }
    return urls;
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const file_urls = await uploadFiles();
      const notes = metrics.notes ? String(metrics.notes) : "";
      const payload = {
        department,
        title,
        content: [content, notes].filter(Boolean).join("\n\n"),
        report_date: date,
        priority,
        metrics,
        file_urls,
        purchases: form.purchases ? purchases.filter((line) => line.item.trim()) : [],
      };
      const result = await base44.functions.invoke("submitDepartmentReport", payload);
      setTitle("");
      setContent("");
      setMetrics({});
      setPurchases(emptyPurchases());
      setFiles([]);
      setWeekly(result.weekly_purchases);
      setMessage(result.correction
        ? `Submitted as a correction on ${result.report_date}. Status: submitted.`
        : `Submitted on ${result.report_date}. Status: submitted.`);
      onSubmitted?.(result);
    } catch (e) {
      setError(e.response?.data?.error || e.message || "Unable to submit report.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 md:p-7">
      <h2 className="text-lg font-semibold text-slate-900">Submit daily report</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">Report date
          <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" />
        </label>
        <label className="block text-sm font-medium text-slate-700">Priority
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5">
            <option value="normal">Normal</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">Report title
        <input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" placeholder="Today's report" />
      </label>
      {form.fields.filter((field) => field.key !== "notes").map((field) => (
        <label key={field.key} className="block text-sm font-medium text-slate-700">{field.label}
          <input
            type={field.type === "number" ? "number" : "text"}
            step="any"
            value={metrics[field.key] ?? ""}
            onChange={(e) => setMetrics((prev) => ({ ...prev, [field.key]: e.target.value }))}
            className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5"
          />
        </label>
      ))}
      <label className="block text-sm font-medium text-slate-700">Report content
        <textarea required maxLength={20000} rows={6} value={content} onChange={(e) => setContent(e.target.value)} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" placeholder="Summarise activities, outcomes, and issues…" />
      </label>
      <label className="block text-sm font-medium text-slate-700">Notes
        <textarea rows={3} value={metrics.notes ?? ""} onChange={(e) => setMetrics((prev) => ({ ...prev, notes: e.target.value }))} className="mt-1 block w-full rounded-lg border border-slate-200 p-2.5" />
      </label>
      {form.purchases && (
        <fieldset className="space-y-3 rounded-lg border border-slate-100 p-4">
          <legend className="text-sm font-semibold text-slate-800">Purchases</legend>
          {purchases.map((line, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-2">
              <input placeholder="Item" value={line.item} onChange={(e) => setPurchases((rows) => rows.map((row, i) => i === index ? { ...row, item: e.target.value } : row))} className="rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input placeholder="Supplier" value={line.supplier} onChange={(e) => setPurchases((rows) => rows.map((row, i) => i === index ? { ...row, supplier: e.target.value } : row))} className="rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input type="number" step="any" placeholder="Quantity" value={line.quantity} onChange={(e) => setPurchases((rows) => rows.map((row, i) => i === index ? { ...row, quantity: e.target.value } : row))} className="rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input type="number" step="any" placeholder="Unit price" value={line.unit_price} onChange={(e) => setPurchases((rows) => rows.map((row, i) => i === index ? { ...row, unit_price: e.target.value } : row))} className="rounded-lg border border-slate-200 p-2.5 text-sm" />
            </div>
          ))}
          <button type="button" className="text-sm font-medium text-slate-700" onClick={() => setPurchases((rows) => [...rows, ...emptyPurchases()])}>Add purchase line</button>
        </fieldset>
      )}
      <label className="block text-sm font-medium text-slate-700">Attachments
        <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf,.csv,.xls,.xlsx" onChange={(e) => setFiles([...e.target.files])} className="mt-1 block w-full text-sm" />
        <span className="mt-1 block text-xs text-slate-500">Photos, PDF or spreadsheet · 8MB each</span>
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm font-medium text-emerald-700">{message}</p>}
      {weekly && <p className="text-sm text-slate-600">Weekly purchases so far: {weekly.lines} lines · {Number(weekly.total).toLocaleString()}</p>}
      <button disabled={busy || !title.trim() || !content.trim()} className="w-full rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50 sm:w-auto">
        {busy ? "Submitting…" : "Submit report"}
      </button>
    </form>
  );
}
