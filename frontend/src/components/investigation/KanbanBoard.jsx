import React from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import RiskBadge from "@/components/RiskBadge";
import { Calendar } from "lucide-react";

const COLUMNS = [
  { id: "open", title: "Open", accent: "border-t-slate-400", bg: "bg-slate-50" },
  { id: "in_progress", title: "In Progress", accent: "border-t-blue-500", bg: "bg-blue-50/50" },
  { id: "concluded", title: "Concluded", accent: "border-t-emerald-500", bg: "bg-emerald-50/50" },
];

export default function KanbanBoard({ investigations, onDragEnd }) {
  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map((col) => {
          const items = investigations.filter((i) => i.status === col.id);
          return (
            <Droppable key={col.id} droppableId={col.id}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`rounded-xl border border-slate-200 ${col.bg} border-t-4 ${col.accent} p-3 min-h-[300px] transition-shadow ${snapshot.isDraggingOver ? "ring-2 ring-slate-400" : ""}`}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="text-sm font-semibold text-slate-700">{col.title}</h3>
                    <span className="text-xs text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 && (
                      <div className="text-center py-8 text-xs text-slate-400">Drop items here</div>
                    )}
                    {items.map((inv, index) => (
                      <Draggable key={inv.id} draggableId={inv.id} index={index}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={`bg-white rounded-lg border border-slate-200 p-3 shadow-sm cursor-grab active:cursor-grabbing ${snap.isDragging ? "shadow-md ring-2 ring-slate-300" : "hover:shadow-sm"}`}
                          >
                            <div className="flex items-center gap-2 mb-1.5">
                              <RiskBadge level={inv.risk_level} size="sm" />
                              {inv.investigator && (
                                <span className="text-[10px] text-slate-400 ml-auto truncate max-w-[80px]">{inv.investigator}</span>
                              )}
                            </div>
                            <h4 className="text-sm font-semibold text-[#231F20] mb-1 line-clamp-2">{inv.title}</h4>
                            <p className="text-xs text-slate-500 font-mono truncate">{inv.transaction_id}</p>
                            <p className="text-xs text-slate-400 truncate mt-0.5">{inv.vendor}</p>
                            {inv.follow_up_date && (
                              <p className="text-[10px] text-blue-600 mt-1.5 flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {new Date(inv.follow_up_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}
      </div>
    </DragDropContext>
  );
}