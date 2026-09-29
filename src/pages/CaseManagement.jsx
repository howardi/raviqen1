import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import RiskBadge from "@/components/RiskBadge";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { scoreCasePriority } from "@/lib/advancedAI";
import { cn } from "@/lib/utils";

const COLUMNS = [
  { id: "open", label: "Open", accent: "border-t-slate-400" },
  { id: "in_review", label: "In Review", accent: "border-t-blue-400" },
  { id: "escalated", label: "Escalated", accent: "border-t-orange-400" },
  { id: "closed", label: "Closed", accent: "border-t-emerald-400" },
];

function mapColumn(inv) {
  if (inv.status === "concluded") return "closed";
  if (inv.outcome === "escalated") return "escalated";
  if (inv.status === "in_progress") return "in_review";
  return "open";
}

export default function CaseManagement() {
  const navigate = useNavigate();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [priorityScores, setPriorityScores] = useState({});

  useEffect(() => {
    base44.entities.Investigation.list("-created_date", 50)
      .then((data) => {
        setCases((data || []).map((inv) => ({ ...inv, column: mapColumn(inv) })));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const onDragEnd = async (result) => {
    if (!result.destination || result.source.droppableId === result.destination.droppableId) return;
    const { draggableId, destination } = result;
    setCases((prev) => prev.map((c) => (c.id === draggableId ? { ...c, column: destination.droppableId } : c)));
    const statusMap = { open: "open", in_review: "in_progress", escalated: "in_progress", closed: "concluded" };
    const updates = { status: statusMap[destination.droppableId] };
    if (destination.droppableId === "escalated") updates.outcome = "escalated";
    try { await base44.entities.Investigation.update(draggableId, updates); } catch (e) { console.error(e); }
  };

  const handleScore = async () => {
    setScoring(true);
    try {
      const result = await scoreCasePriority(cases);
      const scoreMap = {};
      (result.scores || []).forEach((s) => { scoreMap[s.id] = s; });
      setPriorityScores(scoreMap);
    } catch (e) { console.error(e); }
    setScoring(false);
  };

  const getInitials = (name) => (name || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-[#231F20]">Case Management</h1>
          <p className="text-xs text-slate-500">Investigation workflow board · Drag cases between stages</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleScore} disabled={scoring} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 text-indigo-700 text-xs font-medium hover:bg-indigo-50 disabled:opacity-50 transition-colors">
            {scoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            AI Score Priorities
          </button>
          <button onClick={() => navigate("/investigations")} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors">
            <Plus className="w-3.5 h-3.5" /> New Case
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : (
        <div className="p-4 md:p-6">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {COLUMNS.map((col) => {
                const items = cases.filter((c) => c.column === col.id);
                return (
                  <Droppable droppableId={col.id} key={col.id}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className={cn("bg-slate-50/60 rounded-xl border-t-4 border-x border-b border-slate-200 flex flex-col", col.accent)}>
                        <div className="px-4 py-3 flex items-center justify-between">
                          <span className="text-sm font-semibold text-[#231F20]">{col.label}</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 text-xs font-medium">{items.length}</span>
                        </div>
                        <div className="px-2 pb-2 space-y-2 min-h-[100px] flex-1">
                          {items.map((item, idx) => {
                            const score = priorityScores[item.id];
                            return (
                              <Draggable draggableId={item.id} index={idx} key={item.id}>
                                {(p) => (
                                  <div ref={p.innerRef} {...p.draggableProps} {...p.dragHandleProps} onClick={() => navigate(`/investigations/${item.id}`)} className="bg-white rounded-lg border border-slate-200 p-3 cursor-pointer hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-1">
                                      <p className="text-sm font-semibold text-[#231F20] line-clamp-2 flex-1">{item.title}</p>
                                      {score && (
                                        <span className={cn("ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0", score.priority_score > 70 ? "bg-red-50 text-red-700" : score.priority_score > 40 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600")}>
                                          {score.priority_score}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2 font-mono">{item.transaction_id}</p>
                                    {score?.rationale && <p className="text-[10px] text-indigo-600 mb-2 line-clamp-2">{score.rationale}</p>}
                                    <div className="flex items-center justify-between">
                                      <RiskBadge level={item.risk_level || "medium"} size="sm" />
                                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center text-white text-[10px] font-semibold">
                                        {getInitials(item.investigator || "U")}
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                          {provided.placeholder}
                          {items.length === 0 && <p className="text-xs text-slate-400 text-center py-4">No cases</p>}
                        </div>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </DragDropContext>
        </div>
      )}
    </div>
  );
}