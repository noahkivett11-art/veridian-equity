import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Sparkles, Home, Sun, Moon } from "lucide-react";
import { useDebounce, useClickOutside } from "../../hooks";
import { CompanyDataService, CompanySearchResult } from "../../services/companyService";

interface HeaderProps {
  onSelectCompany: (symbol: string) => void;
  onToggleCopilot: () => void;
  isCopilotOpen: boolean;
  onGoHome: () => void;
  isLightMode: boolean;
  onToggleLightMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onSelectCompany,
  onToggleCopilot,
  isCopilotOpen,
  onGoHome,
  isLightMode,
  onToggleLightMode,
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const clearResults = useCallback(() => setResults([]), []);
  const searchRef = useClickOutside(clearResults);

  useEffect(() => {
    const search = async () => {
      if (debouncedQuery.length > 0) {
        setIsSearching(true);
        const data = await CompanyDataService.getInstance().searchCompanies(debouncedQuery);
        setResults(data);
        setIsSearching(false);
      } else {
        setResults([]);
      }
    };
    search();
  }, [debouncedQuery]);

  const handleSelect = (symbol: string) => {
    onSelectCompany(symbol);
    setQuery("");
    setResults([]);
  };

  return (
    <header className="h-14 border-b border-white/[0.04] flex items-center justify-between px-6 bg-surface-950/80 backdrop-blur-md z-40 no-print shrink-0">
      {/* Search */}
      <div className="relative max-w-md w-full" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker or company..."
          className="w-full bg-white/[0.04] border border-white/[0.06] rounded-lg py-2 pl-10 pr-4 text-sm focus:outline-none focus:border-accent/40 transition-all placeholder-slate-600"
        />

        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute top-full left-0 right-0 mt-1.5 bg-surface-900 border border-white/[0.08] rounded-lg shadow-2xl overflow-hidden z-50"
            >
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => handleSelect(r.symbol)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] transition-colors group"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-semibold text-white group-hover:text-accent transition-colors">
                      {r.symbol}
                    </span>
                    <span className="text-xs text-slate-500 truncate max-w-[250px]">{r.name}</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600">{r.exchange}</span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={onGoHome}
          title="Back to landing page"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all"
        >
          <Home className="w-3.5 h-3.5" />
          Home
        </button>
        <button
          onClick={onToggleLightMode}
          title={isLightMode ? "Switch to dark mode" : "Switch to light mode"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all"
        >
          {isLightMode ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          {isLightMode ? "Dark" : "Light"}
        </button>
        <div className="badge-live">
          <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Live
        </div>
        <button
          onClick={onToggleCopilot}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            isCopilotOpen
              ? "bg-accent text-surface-950"
              : "bg-white/[0.06] text-slate-400 hover:text-white hover:bg-white/[0.1]"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          AI Copilot
        </button>
      </div>
    </header>
  );
};
