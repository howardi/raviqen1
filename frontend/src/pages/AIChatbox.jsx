import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, Database, BarChart3 } from "lucide-react";
import { processConversationalQuery } from "@/lib/conversationalAnalytics";
import { replyFromPlatform } from "@/lib/chatReply";
import { invokeLiveLLM } from "@/lib/liveAI";
import MarkdownContent from "@/components/MarkdownContent";

const SYSTEM_CONTEXT = `You are RAVIQEN AI Assistant. Answer questions about this app and general questions on any other topic. RAVIQEN helps organizations monitor financial transactions, detect anomalies, manage investigations, and ensure compliance. You can explain:
- Investigations and the 5-step wizard (Evidence, AI Summary, Cross-Reference, AI Analyst, Decision)
- Alerts and risk scoring
- Data ingestion and supported file formats (CSV, Excel, PDF, Word, images)
- Compliance analysis and financial impact estimation
- POS system connectors (QuickBooks, eZee Burrp) with cloud sync or manual upload
- The Super Admin Command Center and department reporting
Be concise, professional, friendly, and warm. Do NOT use markdown formatting — no bold markers (**), no headers, no markdown bullets. Write in clean, readable plain text. Use simple dashes (-) for lists if needed. For the user's own business records, use only figures that were supplied to you. Do not invent their transactions or amounts. For general knowledge, answer directly.`;

const stripBold = (text) => (text || "").replace(/\*\*/g, "");

const SUGGESTED_QUERIES = [
  "Show all critical risk transactions over $50,000",
  "How many high-risk vendors in procurement this quarter?",
  "List all flagged alerts",
  "Summarize open investigations",
];

export default function AIChatbox() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hello! I'm the RAVIQEN AI Assistant. Ask me about this app, or ask a general question." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    const newMessages = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      // First, try conversational analytics (data query against live data)
      const dataResult = await processConversationalQuery(userMsg);
      let answer;
      if (dataResult.isDataQuery) {
        answer = stripBold(dataResult.narrative || dataResult.summary);
        // Append data table if records exist
        if (dataResult.data && dataResult.data.length > 0) {
          const tableRows = dataResult.data.slice(0, 10).map((d) => {
            const parts = Object.entries(d).map(([k, v]) => {
              if (k === "amount" && v) return `${k}: $${Number(v).toLocaleString()}`;
              return `${k}: ${v ?? "—"}`;
            });
            return `- ${parts.join(" · ")}`;
          });
          answer += `\n\n${dataResult.data.length} ${dataResult.entityLabel} found:\n${tableRows.join("\n")}`;
        }
        setMessages((prev) => [...prev, { role: "assistant", content: answer, isDataQuery: true }]);
      } else {
        // Fall back to general LLM conversation
        const conversation = newMessages
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
          .join("\n");
        try {
          const res = await invokeLiveLLM({
            prompt: `${SYSTEM_CONTEXT}\n\nConversation so far:\n${conversation}\n\nAssistant:`,
          });
          answer = stripBold(typeof res === "string" ? res : (res?.answer || res?.response || replyFromPlatform(userMsg)));
        } catch (error) {
          const message = String(error?.message || "The model did not respond.");
          answer = /credit|billing/i.test(message)
            ? "Your OpenAI account has no credits remaining. Add OpenAI credits, or add a Cursor API key in the server settings, then ask again."
            : message;
        }
        setMessages((prev) => [...prev, { role: "assistant", content: answer }]);
      }
    } catch (error) {
      setMessages((prev) => [...prev, { role: "assistant", content: String(error?.message || "The model did not respond.") }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-[#231F20]">AI Chatbox</h1>
            <p className="text-xs text-slate-500">Ask about RAVIQEN, investigations, alerts, and compliance</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
        {/* Data query indicator */}
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 border border-violet-100">
          <Database className="w-4 h-4 text-violet-600" />
          <span className="text-xs text-violet-700">Answers use loaded records. Counts and amounts appear only when those records are available.</span>
        </div>
        {/* Suggested queries */}
        {messages.length <= 1 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map((q, i) => (
              <button
                key={i}
                onClick={() => { setInput(q); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <BarChart3 className="w-3 h-3 text-slate-400" />
                {q}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                msg.role === "user" ? "bg-slate-200" : "bg-gradient-to-br from-violet-500 to-indigo-600"
              }`}>
                {msg.role === "user" ? <User className="w-4 h-4 text-slate-600" /> : <Bot className="w-4 h-4 text-white" />}
              </div>
              <div className={`max-w-[75%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === "user" ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"
              }`}>
                {msg.isDataQuery ? (
                  <div className="leading-relaxed">
                    <MarkdownContent content={msg.content} />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Thinking...
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white p-4 sticky bottom-0">
        <div className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask in plain language — e.g. 'Show all critical risk transactions over $50,000'"
            className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:ring-1 focus:ring-slate-300 outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
            Send
          </button>
        </div>
      </div>
    </div>
  );
}