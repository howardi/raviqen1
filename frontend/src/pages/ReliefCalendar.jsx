import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import {
  Calendar as CalendarIcon, Plus, ChevronLeft, ChevronRight, X, Loader2,
  Globe, Users, AlertTriangle, Clock, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import BackToTop from "@/components/BackToTop";
import { stampTenant } from "@/lib/tenantScope";

const EVENT_TYPES = {
  relief_effort: { label: "Relief Effort", color: "bg-emerald-500", bg: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  volunteer_dispatch: { label: "Volunteer Dispatch", color: "bg-blue-500", bg: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  crisis_response: { label: "Crisis Response", color: "bg-red-500", bg: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  supply_delivery: { label: "Supply Delivery", color: "bg-amber-500", bg: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  coordination_meeting: { label: "Coordination Meeting", color: "bg-violet-500", bg: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  other: { label: "Other", color: "bg-slate-500", bg: "bg-slate-50 text-slate-700 border-slate-200", dot: "bg-slate-500" },
};

const PRIORITY_COLORS = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

const COMMON_TIMEZONES = [
  "UTC", "Africa/Lagos", "Africa/Nairobi", "Africa/Cairo", "Europe/London",
  "Europe/Paris", "America/New_York", "America/Los_Angeles", "Asia/Tokyo",
  "Asia/Kolkata", "Australia/Sydney", "Pacific/Auckland",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function formatDateKey(date) {
  return date.toISOString().split("T")[0];
}

function getEventsForDate(events, dateKey) {
  return events.filter((e) => {
    if (!e.start_time) return false;
    const eventDate = new Date(e.start_time).toISOString().split("T")[0];
    return eventDate === dateKey;
  });
}

export default function ReliefCalendar() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [displayTimezone, setDisplayTimezone] = useState("UTC");

  const [formData, setFormData] = useState({
    title: "",
    event_type: "relief_effort",
    description: "",
    start_time: "",
    end_time: "",
    timezone: "UTC",
    location: "",
    status: "planned",
    priority: "medium",
    assigned_team: "",
    volunteer_count: 0,
    population_affected: 0,
    contact_person: "",
  });

  const loadEvents = useCallback(async () => {
    try {
      const data = await base44.entities.CalendarEvent.list("-start_time", 200);
      setEvents(data || []);
    } catch (e) {
      console.error(e);
      toast({ title: "Error", description: "Failed to load events", variant: "destructive" });
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  // Calendar grid generation
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days = [];
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    // Next month padding to fill 6 rows
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }
    return days;
  }, [currentDate]);

  const filteredEvents = useMemo(() => {
    if (filterType === "all") return events;
    return events.filter((e) => e.event_type === filterType);
  }, [events, filterType]);

  const eventsByDate = useMemo(() => {
    const map = {};
    filteredEvents.forEach((e) => {
      if (!e.start_time) return;
      const key = new Date(e.start_time).toISOString().split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [filteredEvents]);

  const todayKey = formatDateKey(new Date());

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(formatDateKey(new Date())); };

  const openNewEvent = (dateKey) => {
    const dt = dateKey ? new Date(dateKey + "T09:00") : new Date();
    const dtEnd = new Date(dt.getTime() + 60 * 60 * 1000);
    const toLocalInput = (d) => {
      const tz = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
      return tz.toISOString().slice(0, 16);
    };
    setFormData({
      ...formData,
      start_time: toLocalInput(dt),
      end_time: toLocalInput(dtEnd),
    });
    setSelectedDate(dateKey);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formData.title || !formData.start_time) {
      toast({ title: "Missing fields", description: "Title and start time are required", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        ...formData,
        start_time: new Date(formData.start_time).toISOString(),
        end_time: formData.end_time ? new Date(formData.end_time).toISOString() : undefined,
        volunteer_count: Number(formData.volunteer_count) || 0,
        population_affected: Number(formData.population_affected) || 0,
      };
      const created = await base44.entities.CalendarEvent.create(stampTenant(payload, user));
      setEvents((prev) => [created, ...prev]);
      setShowForm(false);
      setFormData({ title: "", event_type: "relief_effort", description: "", start_time: "", end_time: "", timezone: "UTC", location: "", status: "planned", priority: "medium", assigned_team: "", volunteer_count: 0, population_affected: 0, contact_person: "" });
      toast({ title: "Event scheduled", description: "Calendar event created successfully." });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.CalendarEvent.delete(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      toast({ title: "Event deleted" });
    } catch (e) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const formatInTimezone = (isoStr, tz) => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "2-digit", minute: "2-digit", hour12: true,
        month: "short", day: "numeric",
      }).format(new Date(isoStr));
    } catch {
      return new Date(isoStr).toLocaleString();
    }
  };

  const selectedDateEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold text-[#231F20] flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              Relief Operations Calendar
            </h1>
            <p className="text-xs text-slate-500">
              Coordinate relief efforts · volunteer dispatches · crisis response timelines across time zones
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={displayTimezone}
              onChange={(e) => setDisplayTimezone(e.target.value)}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white outline-none"
            >
              {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="text-xs px-2.5 py-2 rounded-lg border border-slate-200 bg-white outline-none"
            >
              <option value="all">All Types</option>
              {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button
              onClick={() => openNewEvent(null)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> New Event
            </button>
          </div>
        </div>
      </header>

      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <ChevronLeft className="w-4 h-4 text-slate-600" />
                </button>
                <h2 className="text-base font-bold text-[#231F20] min-w-[140px] text-center">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
                  <ChevronRight className="w-4 h-4 text-slate-600" />
                </button>
              </div>
              <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                Today
              </button>
            </div>

            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase py-1">{d}</div>
              ))}
            </div>

            {/* Calendar days */}
            {loading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
            ) : (
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                  const dateKey = formatDateKey(day.date);
                  const dayEvents = eventsByDate[dateKey] || [];
                  const isToday = dateKey === todayKey;
                  const isSelected = dateKey === selectedDate;
                  return (
                    <div
                      key={i}
                      onClick={() => { setSelectedDate(dateKey); }}
                      className={cn(
                        "min-h-[70px] md:min-h-[90px] p-1.5 rounded-lg border cursor-pointer transition-colors",
                        day.isCurrentMonth ? "bg-white border-slate-100 hover:border-slate-300" : "bg-slate-50/50 border-slate-50 text-slate-300",
                        isSelected && "ring-2 ring-blue-400 border-blue-400",
                        isToday && !isSelected && "border-blue-200 bg-blue-50/30"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-medium mb-1",
                        isToday ? "text-blue-600 font-bold" : day.isCurrentMonth ? "text-slate-700" : "text-slate-300"
                      )}>
                        {day.date.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => {
                          const typeInfo = EVENT_TYPES[e.event_type] || EVENT_TYPES.other;
                          return (
                          <div key={e.id} className={cn("text-[10px] px-1 py-0.5 rounded truncate font-medium", typeInfo.bg)} title={e.title}>
                            <span className={cn("inline-block w-1.5 h-1.5 rounded-full mr-1", typeInfo.dot)} />
                            {e.title}
                          </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 3} more</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <span className="text-xs text-slate-400 font-medium">Legend:</span>
            {Object.entries(EVENT_TYPES).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1">
                <span className={cn("w-2 h-2 rounded-full", v.dot)} />
                <span className="text-xs text-slate-500">{v.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar: selected day events */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-slate-200 p-5 sticky top-24">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#231F20]">
                {selectedDate ? new Date(selectedDate + "T00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }) : "Select a day"}
              </h3>
              {selectedDate && (
                <button onClick={() => openNewEvent(selectedDate)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {selectedDateEvents.length === 0 ? (
              <div className="text-center py-8">
                <CalendarIcon className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                <p className="text-xs text-slate-400">No events scheduled</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {selectedDateEvents.map((e) => {
                  const typeInfo = EVENT_TYPES[e.event_type] || EVENT_TYPES.other;
                  return (
                    <div key={e.id} className={cn("rounded-lg border p-3", typeInfo.bg)}>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm font-semibold text-[#231F20]">{e.title}</p>
                        <button onClick={() => handleDelete(e.id)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-white/50 shrink-0">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="space-y-1 text-[10px] text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{formatInTimezone(e.start_time, displayTimezone)} ({e.timezone || "UTC"})</span>
                        </div>
                        {e.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            <span>{e.location}</span>
                          </div>
                        )}
                        {e.volunteer_count > 0 && (
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            <span>{e.volunteer_count} volunteers</span>
                          </div>
                        )}
                        {e.population_affected > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            <span>{e.population_affected.toLocaleString()} affected</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <span className="capitalize">{e.status}</span>
                          <span className={cn("ml-1 px-1.5 py-0.5 rounded-full font-medium", PRIORITY_COLORS[e.priority])}>
                            {e.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <h3 className="text-base font-bold text-[#231F20]">Schedule New Event</h3>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Event Title *</label>
                <input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. Food distribution — Sector 7"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Event Type</label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-white"
                  >
                    {Object.entries(EVENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-white"
                  >
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Start Time *</label>
                  <input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">End Time</label>
                  <input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Timezone</label>
                  <select
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-white"
                  >
                    {COMMON_TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none bg-white"
                  >
                    <option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Location / Crisis Zone</label>
                <input
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Gaza Strip — Northern Sector"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Volunteers</label>
                  <input
                    type="number"
                    value={formData.volunteer_count}
                    onChange={(e) => setFormData({ ...formData, volunteer_count: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 mb-1 block">Population Affected</label>
                  <input
                    type="number"
                    value={formData.population_affected}
                    onChange={(e) => setFormData({ ...formData, population_affected: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Assigned Team / Contact</label>
                <input
                  value={formData.assigned_team}
                  onChange={(e) => setFormData({ ...formData, assigned_team: e.target.value })}
                  placeholder="e.g. Red Cross Team Alpha"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Operation details, objectives, notes..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-slate-400 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                Schedule Event
              </button>
            </div>
          </div>
        </div>
      )}

      <BackToTop />
    </div>
  );
}