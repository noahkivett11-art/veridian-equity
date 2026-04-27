import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Send, Sparkles } from "lucide-react";
import { AIService } from "../../services/aiService";

interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
}

interface AICopilotProps {
  isOpen: boolean;
  onClose: () => void;
  context: { activeTab: string; selectedSymbol: string };
}

export const AICopilot: React.FC<AICopilotProps> = ({ isOpen, onClose, context }) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: CopilotMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const response = await AIService.getInstance().generateCopilotResponse(
        userMsg.content,
        context,
        messages.slice(-10) // last 10 messages for context
      );
      setMessages((prev) => [...prev, { role: "assistant", content: response }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed right-0 top-0 bottom-0 w-[380px] bg-surface-900 border-l border-white/[0.06] z-50 flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06] shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-accent rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-surface-950" />
              </div>
              <div>
                <div className="text-sm font-semibold text-white">AI Copilot</div>
                <div className="text-[9px] text-slate-500">
                  {context.selectedSymbol ? `Analyzing ${context.selectedSymbol}` : context.activeTab}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center pt-12">
                <Sparkles className="w-10 h-10 text-slate-700 mx-auto mb-4" />
                <p className="text-sm text-slate-500 mb-2">Ask about companies, valuation, markets, or financial concepts.</p>
                <div className="space-y-2 mt-6">
                  {[
                    "What's a good PE ratio for tech stocks?",
                    "Explain the DCF model",
                    context.selectedSymbol ? `Analyze ${context.selectedSymbol}` : "Compare AAPL vs MSFT",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="w-full text-left px-3 py-2 bg-white/[0.03] border border-white/[0.06] rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-surface-950 rounded-br-sm"
                      : "bg-white/[0.05] text-slate-300 rounded-bl-sm border border-white/[0.06]"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/[0.05] border border-white/[0.06] px-4 py-3 rounded-xl rounded-bl-sm">
                  <div className="flex gap-1.5">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/[0.06] shrink-0">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask anything..."
                className="input-field flex-1 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="btn-primary px-3"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[9px] text-slate-600 mt-2 text-center">For educational purposes only. Not financial advice.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
