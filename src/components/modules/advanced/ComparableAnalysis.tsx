import React, { useState, useEffect } from "react";
import { Layers, Search } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, PageHeader, StatRow, LoadingState, EmptyState } from "../../shared";
import { CompsService, CompsResult } from "../../../services/compsService";
import { CompanyDataService, CompanySearchResult } from "../../../services/companyService";
import { useDebounce, useClickOutside } from "../../../hooks";
import { formatSafe } from "../../../lib/utils";

interface CompsProps {
  onSelectTicker: (symbol: string) => void;
  initialSymbol?: string | null;
  onResultChange?: (symbol: string, result: CompsResult) => void;
}

export const ComparableAnalysisModule: React.FC<CompsProps> = ({ onSelectTicker, initialSymbol, onResultChange }) => {
  const [ticker, setTicker] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [result, setResult] = useState<CompsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const debouncedTicker = useDebounce(ticker, 300);
  const clearSearch = () => setSearchResults([]);
  const searchRef = useClickOutside(clearSearch);

  useEffect(() => { if (initialSymbol) loadComps(initialSymbol); }, [initialSymbol]);
  useEffect(() => {
    if (debouncedTicker.length > 0) CompanyDataService.getInstance().searchCompanies(debouncedTicker).then(setSearchResults);
    else setSearchResults([]);
  }, [debouncedTicker]);

  const loadComps = async (sym: string) => {
    setTicker(sym); setSearchResults([]); setLoading(true); onSelectTicker(sym);
    const data = await CompsService.getInstance().runComparableAnalysis(sym);
    setResult(data); if (data) onResultChange?.(sym, data); setLoading(false);
  };

  return (
    <div className="space-y-8">
      <PageHeader title="Comparable Analysis" subtitle="Peer valuation multiples and implied value" icon={<Layers className="w-5 h-5" />} />
      <div className="card p-5" ref={searchRef}>
        <div className="flex items-center gap-2 mb-1.5"><Search className="w-3.5 h-3.5 text-accent" /><label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Load Peers</label></div>
        <div className="relative">
          <input type="text" value={ticker} onChange={(e) => setTicker(e.target.value)} placeholder="Search ticker..." className="input-field" />
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} className="absolute top-full left-0 right-0 mt-1.5 bg-surface-900 border border-white/[0.08] rounded-lg shadow-2xl z-50 overflow-hidden">
                {searchResults.map((r) => (
                  <button key={r.symbol} onClick={() => loadComps(r.symbol)} className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] text-sm group">
                    <span className="font-semibold text-white group-hover:text-accent">{r.symbol}</span><span className="text-xs text-slate-500 ml-2">{r.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {loading && <LoadingState message="Loading peer data..." />}
      {!loading && !result && (
        <EmptyState icon={Layers} title="Load a Company" description="Search for a ticker above to compare against its peers and see implied valuations." />
      )}
      {result && !loading && (
        <div className="space-y-6">
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]"><h3 className="text-sm font-display font-semibold text-white">Peer Comparison ({result.peers.length} peers)</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead><tr className="border-b border-white/[0.04]">
                  {["Ticker","Name","Price","Mkt Cap","PE","EV/EBITDA","EV/Rev","Rev Growth"].map(h=><th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
                </tr></thead>
                <tbody>
                  <tr className="border-b border-accent/20 bg-accent/[0.04]">
                    <td className="px-4 py-2.5 font-semibold text-accent">{result.target.symbol}</td>
                    <td className="px-4 py-2.5 text-white">{result.target.name}</td>
                    <td className="px-4 py-2.5">${formatSafe(result.target.price,2)}</td>
                    <td className="px-4 py-2.5">{result.target.marketCap||"—"}</td>
                    <td className="px-4 py-2.5">{formatSafe(result.target.peRatio,1)}</td>
                    <td className="px-4 py-2.5">{formatSafe(result.target.evEbitda,1)}</td>
                    <td className="px-4 py-2.5">{formatSafe(result.target.evRevenue,1)}</td>
                    <td className="px-4 py-2.5">{result.target.revenueGrowth?`${formatSafe(result.target.revenueGrowth,1)}%`:"—"}</td>
                  </tr>
                  {result.peers.map(p=>(
                    <tr key={p.symbol} className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer" onClick={()=>onSelectTicker(p.symbol)}>
                      <td className="px-4 py-2.5 font-semibold text-white">{p.symbol}</td>
                      <td className="px-4 py-2.5 text-slate-400 truncate max-w-[120px]">{p.name}</td>
                      <td className="px-4 py-2.5">${formatSafe(p.price,2)}</td>
                      <td className="px-4 py-2.5">{p.marketCap||"—"}</td>
                      <td className="px-4 py-2.5">{formatSafe(p.peRatio,1)}</td>
                      <td className="px-4 py-2.5">{formatSafe(p.evEbitda,1)}</td>
                      <td className="px-4 py-2.5">{formatSafe(p.evRevenue,1)}</td>
                      <td className="px-4 py-2.5">{p.revenueGrowth?`${formatSafe(p.revenueGrowth,1)}%`:"—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Median Peer Multiples">
              <StatRow label="PE Ratio" value={formatSafe(result.medians.peRatio,1)} highlight />
              <StatRow label="EV/EBITDA" value={formatSafe(result.medians.evEbitda,1)} highlight />
              <StatRow label="EV/Revenue" value={formatSafe(result.medians.evRevenue,1)} highlight />
            </Card>
            <Card title="Implied Valuation">
              {result.impliedValuations.map(iv=><StatRow key={iv.metric} label={`Via ${iv.metric}`} value={`$${formatSafe(iv.impliedPrice,2)}`} highlight />)}
              <div className="mt-4 p-3 bg-accent/[0.06] rounded-lg border border-accent/20 text-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Avg Implied Price</div>
                <div className="text-xl font-mono font-bold text-accent">${formatSafe(result.impliedValuations.reduce((s,v)=>s+(v.impliedPrice||0),0)/(result.impliedValuations.length||1),2)}</div>
              </div>
            </Card>
          </div>
          <Card title="PE Ratio Comparison">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[result.target,...result.peers].filter(p=>p.peRatio).map(p=>({name:p.symbol,pe:p.peRatio}))} margin={{top:10,right:20,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false}/>
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false}/>
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false}/>
                  <Tooltip contentStyle={{backgroundColor:"#0f1423",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"8px",fontSize:"11px"}}/>
                  <Bar dataKey="pe" fill="#22c55e" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
