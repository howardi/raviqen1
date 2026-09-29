import React, { useRef, useState } from "react";
import { Upload, Loader2, FileText, Image as ImageIcon, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED = ".csv,.xlsx,.xls,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.txt";

const formatIcons = [
  { icon: FileSpreadsheet, label: "CSV / Excel", color: "text-emerald-600" },
  { icon: FileText, label: "PDF / Word", color: "text-red-600" },
  { icon: ImageIcon, label: "OCR Images", color: "text-blue-600" },
];

export default function ScreeningUploadZone({ onFile, processing }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && !processing) onFile(file);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-sm font-semibold text-[#231F20] mb-1">Upload Transaction Data</h3>
      <p className="text-xs text-slate-500 mb-4">
        Structured spreadsheets or unstructured invoices/receipts — the engine auto-extracts and screens every record.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !processing && inputRef.current?.click()}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 md:p-10 text-center cursor-pointer transition-colors",
          dragOver ? "border-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400 hover:bg-slate-50/50",
          processing && "opacity-60 cursor-wait"
        )}
      >
        <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => e.target.files[0] && onFile(e.target.files[0])} />
        {processing ? (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-slate-400 mb-3 animate-spin" />
            <p className="text-sm font-medium text-slate-700">Screening engine running…</p>
            <p className="text-xs text-slate-400 mt-1">Extracting · Verifying · Screening · Scoring</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-100 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6 text-slate-500" />
            </div>
            <p className="text-sm font-medium text-slate-700">Drop file here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">CSV · Excel · PDF · Word · Images · Max 25MB</p>
          </>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {formatIcons.map((f) => {
          const Icon = f.icon;
          return (
            <div key={f.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-100">
              <Icon className={cn("w-3.5 h-3.5", f.color)} />
              <span className="text-xs font-medium text-slate-600">{f.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}