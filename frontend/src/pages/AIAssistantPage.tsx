import React, { useState } from "react";
import { queryGenAI, GenAIResponse } from "../services/api";
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  Database,
  CheckCircle2,
  HelpCircle,
  Clock,
  Building2,
  CloudRain
} from "lucide-react";
import { Markdown } from "../components/Markdown";

interface AIAssistantPageProps {
  currentRole: string;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  responseMeta?: GenAIResponse;
  timestamp: string;
}

export const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ currentRole }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-1",
      sender: "assistant",
      text:
        "Hello, I'm **AquaSense Intelligence**. I answer from the live model output: each zone's current risk, its 48-hour " +
        "forecast, the SHAP drivers behind it, and active alerts. Ask about a zone, the outlook, infrastructure at risk, or a what-if storm.",
      timestamp: "Just now"
    }
  ]);
  const [inputQuery, setInputQuery] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const samplePrompts = currentRole === "Citizen" ? [
    "Is Koramangala safe right now?",
    "Will it rain heavily in the next 6 hours?",
    "Which areas should I avoid today?",
    "Is Silk Board flooding?",
  ] : [
    "Which areas are currently at high flood risk?",
    "Why is Bellandur at high risk?",
    "What is the forecast for Bengaluru over the next 24 hours?",
    "What if a 60 mm/h storm hits now?",
    "Which hospitals or metro stations are in at-risk zones?"
  ];

  const handleSend = async (queryText?: string) => {
    const q = queryText || inputQuery;
    if (!q.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: "user",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setIsLoading(true);

    try {
      const res = await queryGenAI(q, currentRole);
      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        text: res.answer,
        responseMeta: res,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error(e);
      const errMsg: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        sender: "assistant",
        text: "I encountered an issue querying the AquaSense live intelligence service. Please ensure the backend is connected.",
        timestamp: "Just now"
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 flex flex-col h-[calc(100vh-6rem)]">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <h1 className="text-2xl font-bold text-white tracking-wide">AquaSense Intelligence</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Grounded GenAI Decision Support • Contextual RAG over Live Telemetry &amp; GIS Infrastructure
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-300 bg-white/5 border border-white/10 px-3 py-1.5 rounded-lg font-mono">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Role: {currentRole}</span>
        </div>
      </div>

      {/* Suggested Prompt Chips */}
      <div className="flex flex-wrap items-center gap-2 pb-1 flex-shrink-0">
        <span className="text-[11px] uppercase tracking-wider text-zinc-400 font-semibold whitespace-nowrap">
          Quick Queries:
        </span>
        {samplePrompts.map((p, i) => (
          <button
            key={i}
            onClick={() => handleSend(p)}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-zinc-300 hover:text-white border border-white/5 hover:border-cyan-500/30 text-xs whitespace-nowrap transition-colors"
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 glass-panel rounded-2xl border border-white/10 p-6 overflow-y-auto space-y-4">
        {messages.map((m) => {
          const isUser = m.sender === "user";
          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-glow-cyan-sm">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}

              <div
                className={`max-w-2xl rounded-2xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? "bg-cyan-600/80 text-white rounded-br-none"
                    : "glass-card border border-white/10 text-zinc-200 rounded-bl-none space-y-2.5"
                }`}
              >
                {/* Message Body */}
                <div className="font-sans">{isUser ? m.text : <Markdown text={m.text} />}</div>

                {/* Grounding & Metadata Badge for Assistant */}
                {!isUser && m.responseMeta && (
                  <div className="pt-2 border-t border-white/10 space-y-1.5 font-mono text-[10px] text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" /> Grounded Confidence: {m.responseMeta.confidence_level}
                      </span>
                      <span>{m.timestamp}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <Database className="w-3 h-3 text-cyan-400" />
                      <span>Sources: {m.responseMeta.data_sources_consulted.join(" • ")}</span>
                    </div>

                    {m.responseMeta.relevant_zones.length > 0 && (
                      <div className="flex items-center gap-1 text-zinc-400 pt-0.5">
                        <span>Zones: </span>
                        {m.responseMeta.relevant_zones.map((z, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.2 rounded bg-white/10 text-white font-mono text-[9px]"
                          >
                            {z}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center text-xs text-zinc-400">
            <div className="w-8 h-8 rounded-lg bg-cyan-600/30 flex items-center justify-center animate-pulse">
              <Bot className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
              <span>Analyzing live telemetry &amp; generating grounded hydrological synthesis...</span>
            </div>
          </div>
        )}
      </div>

      {/* Query Input Bar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <input
          type="text"
          placeholder="Ask AquaSense Intelligence (e.g. 'Why is Bellandur at high risk?', 'What is the 24h forecast?')..."
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="flex-1 glass-input px-4 py-3.5 rounded-xl text-xs text-white placeholder-zinc-500"
        />
        <button
          onClick={() => handleSend()}
          disabled={isLoading || !inputQuery.trim()}
          className="px-5 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-[#04121f] disabled:opacity-50 text-xs font-bold flex items-center gap-2 shadow-glow-cyan transition-all"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
