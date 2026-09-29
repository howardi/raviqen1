import React, { useState } from "react";
import {
  CheckCircle2, MessageSquare, Flag, Paperclip,
  Building2, Calendar, AlertCircle, User,
} from "lucide-react";
import { cn } from "@/lib/utils";

const DEPT_CONFIG = {
  restaurant: { label: "Restaurant / F&B", icon: Building2, color: "text-orange-600 bg-orange-50" },
  operations: { label: "Operations", icon: Building2, color: "text-blue-600 bg-blue-50" },
  front_desk: { label: "Front Desk", icon: Building2, color: "text-teal-600 bg-teal-50" },
  hr: { label: "Human Resources", icon: Building2, color: "text-violet-600 bg-violet-50" },
  finance: { label: "Finance", icon: Building2, color: "text-emerald-600 bg-emerald-50" },
  general: { label: "General", icon: Building2, color: "text-slate-600 bg-slate-50" },
};

const STATUS_CONFIG = {
  submitted: { label: "New", color: "text-blue-600 bg-blue-50 border-blue-200" },
  read: { label: "Read", color: "text-slate-600 bg-slate-50 border-slate-200" },
  commented: { label: "Commented", color: "text-amber-600 bg-amber-50 border-amber-200" },
  flagged: { label: "Flagged", color: "text-red-600 bg-red-50 border-red-200" },
  archived: { label: "Archived", color: "text-slate-400 bg-slate-50 border-slate-200" },
};

export default function DailyReportCard({ report, user, onMarkRead, onComment, onFlag }) {
  const [expanded, setExpanded] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [showFlagInput, setShowFlagInput] = useState(false);

  const dept = DEPT_CONFIG[report.department] || DEPT_CONFIG.general;
  const status = STATUS_CONFIG[report.status] || STATUS_CONFIG.submitted;
  const DIcon = dept.icon;

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment(report, commentText.trim());
    setCommentText("");
  };

  const handleFlag = () => {
    if (!flagReason.trim()) return;
    onFlag(report, flagReason.trim());
    setFlagReason("");
    setShowFlagInput(false);
  };

  return (
    <div className={cn(
      "bg-white rounded-xl border p-4 transition-colors",
      report.status === "flagged" ? "border-red-200 bg-red-50/30" : "border-slate-200"
    )}>
      <div className="flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", dept.color)}>
          <DIcon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-[#231F20] truncate">{report.title}</p>
            {report.priority === "urgent" && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700">
                <AlertCircle className="w-2.5 h-2.5" /> URGENT
              </span>
            )}
            <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium border", status.color)}>
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1"><User className="w-3 h-3" />{report.submitted_by}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{report.report_date}</span>
            <span>{dept.label}</span>
          </div>
        </div>
        <button
          onClick={() => { setExpanded(!expanded); if (!report.read_by?.includes(user?.id)) onMarkRead(report); }}
          className="text-xs text-slate-500 hover:text-slate-900 shrink-0"
        >
          {expanded ? "Collapse" : "View"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-4">
          {/* Content */}
          <div className="p-3 rounded-lg bg-slate-50/60 border border-slate-100">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{report.content}</p>
          </div>

          {/* Metrics */}
          {report.metrics && Object.keys(report.metrics).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(report.metrics).map(([k, v]) => (
                <div key={k} className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wide">{k}</p>
                  <p className="text-sm font-semibold text-slate-700">{v}</p>
                </div>
              ))}
            </div>
          )}

          {/* Attachment */}
          {report.file_url && (
            <a href={report.file_url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50">
              <Paperclip className="w-3.5 h-3.5" /> View attachment
            </a>
          )}

          {/* Comments */}
          {report.comments?.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500">Comments</p>
              {report.comments.map((c, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-amber-50/50 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-700">{c.author}</span>
                    <span className="text-[10px] text-slate-400">{c.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-600">{c.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Flag reason */}
          {report.flagged_reason && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200">
              <p className="text-xs text-red-700"><span className="font-medium">Flagged:</span> {report.flagged_reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
            <button
              onClick={() => { onMarkRead(report); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Mark Read
            </button>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add comment..."
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none focus:border-slate-400 w-48"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim()}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-50"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Comment
              </button>
            </div>
            <button
              onClick={() => setShowFlagInput(!showFlagInput)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" /> Flag
            </button>
          </div>

          {showFlagInput && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Reason for flagging..."
                className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 outline-none focus:border-red-400"
              />
              <button
                onClick={handleFlag}
                disabled={!flagReason.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                Confirm Flag
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}