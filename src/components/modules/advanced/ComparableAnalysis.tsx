import React, { useState, useEffect } from "react";
import { Layers, Search, Printer } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell,
} from "recharts";
import { Card, PageHeader, LoadingState, EmptyState } from "../../shared";
import { CompsService, CompsResult } from "../../../services/compsService";
import { CompanyDataService, CompanySearchResult } from "../../../services/companyService";
import { useDebounce, useClickOutside } from "../../../hooks";
import { formatSafe } from "../../../lib/utils";

interface CompsProps {
  onSelectTicker: (symbol: string) => void;
  initialSymbol?: string | null;
  onResultChange?: (symbol: string, result: CompsResult) => void;
}

// Multiples: null/zero/negative → "N/A", otherwise "X.Xx"
const fmtX = (v: number | null | undefined, dec = 1): string => {
  if (v === null || v === undefined || isNaN(v) || v <= 0) return "N/A";
  return v.toFixed(dec) + "x";
};

// Growth percentages
const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(1) + "%";
};

// Ordinal labels: 1 → "1st", etc.
const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Scatter chart dot with ticker label
const CustomDot = (props: any) => {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle
        cx={cx} cy={cy}
        r={payload.isTarget ? 7 : 5}
        fill={payload.isTarget ? "#22c55e" : "#475569"}
        stroke={payload.isTarget ? "#16a34a" : "#334155"}
        strokeWidth={1.5}
      />
      <text
        x={cx} y={cy - 11}
        fill={payload.isTarget ? "#22c55e" : "#94a3b8"}
        fontSize={9} textAnchor="middle"
        fontFamily="JetBrains Mono, monospace"
      >
        {payload.name}
      </text>
    </g>
  );
};

export const ComparableAnalysisModule: React.FC<CompsProps> = ({
  onSelectTicker, initialSymbol, onResultChange,
}) => {
  const [ticker, setTicker] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [result, setResult] = useState<CompsResult | null>(null);
  const [loading, setLoading] = useState(false);

  const debouncedTicker = useDebounce(ticker, 300);
  const clearSearch = () => setSearchResults([]);
  const searchRef = useClickOutside(clearSearch);

  useEffect(() => { if (initialSymbol) loadComps(initialSymbol); }, [initialSymbol]);
  useEffect(() => {
    if (debouncedTicker.length > 0)
      CompanyDataService.getInstance().searchCompanies(debouncedTicker).then(setSearchResults);
    else setSearchResults([]);
  }, [debouncedTicker]);

  const loadComps = async (sym: string) => {
    setTicker(sym); setSearchResults([]); setLoading(true);
    const data = await CompsService.getInstance().runComparableAnalysis(sym);
    setResult(data); if (data) onResultChange?.(sym, data); setLoading(false);
  };

  const handleGenerateReport = () => {
    if (!result) return;
    const w = window.open("", "_blank", "width=900,height=750");
    if (!w) return;
    const rows = [result.target, ...result.peers]
      .map((p, i) => `<tr class="${i === 0 ? "hl" : ""}">
        <td>${p.symbol}</td>
        <td>$${formatSafe(p.price, 2)}</td>
        <td>${p.marketCap}</td>
        <td>${fmtX(p.peRatio)}</td>
        <td>${fmtX(p.evEbitda)}</td>
        <td>${fmtX(p.evRevenue)}</td>
        <td>${p.revenueGrowth != null ? p.revenueGrowth.toFixed(1) + "%" : "—"}</td>
        <td>${p.roe != null ? p.roe.toFixed(1) + "%" : "—"}</td>
        <td>${p.dividendYield != null ? p.dividendYield.toFixed(2) + "%" : "—"}</td>
      </tr>`)
      .join("");
    const ivCards = result.impliedValuations
      .map(iv => `<div class="stat">
        <div class="sl">${iv.metric}</div>
        <div class="sv">$${formatSafe(iv.impliedPrice, 2)}</div>
        <div style="font-size:11px;color:${iv.upside >= 0 ? "#16a34a" : "#dc2626"};margin-top:3px">
          ${iv.upside >= 0 ? "+" : ""}${formatSafe(iv.upside, 1)}% upside
        </div>
      </div>`)
      .join("");
    const stats = [
      { l: "Current Price", v: `$${formatSafe(result.target.price, 2)}` },
      { l: "P/E Ratio", v: fmtX(result.target.peRatio) },
      { l: "Market Cap", v: result.target.marketCap },
      { l: "Peer Median P/E", v: fmtX(result.medians.peRatio as number) },
      { l: "EV/EBITDA", v: fmtX(result.target.evEbitda) },
      { l: "EV/Revenue", v: fmtX(result.target.evRevenue) },
    ].map(s => `<div class="stat"><div class="sl">${s.l}</div><div class="sv">${s.v}</div></div>`).join("");

    w.document.write(`<!DOCTYPE html><html><head>
      <title>${result.target.symbol} — Comparable Analysis</title>
      <style>
        body{font-family:sans-serif;padding:24px 32px;color:#111;max-width:900px;margin:0 auto}
        h1{font-size:22px;margin:0 0 4px}
        h2{font-size:13px;margin:18px 0 8px;text-transform:uppercase;letter-spacing:.05em;border-bottom:1px solid #e5e7eb;padding-bottom:5px;color:#374151}
        .sub{color:#6b7280;font-size:12px;margin-bottom:16px}
        .summary{background:#f0fdf4;border-left:4px solid #22c55e;padding:10px 14px;margin:14px 0;border-radius:0 6px 6px 0;font-size:13px;color:#15803d;font-weight:500}
        .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:10px 0}
        .stat{background:#f9fafb;padding:9px 11px;border-radius:6px;border:1px solid #e5e7eb}
        .sl{font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
        .sv{font-size:15px;font-weight:700;font-family:monospace}
        table{border-collapse:collapse;width:100%;font-size:11px;margin-top:4px}
        th,td{border:1px solid #e5e7eb;padding:6px 8px;text-align:left}
        th{background:#f3f4f6;font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}
        tr.hl td{background:#f0fdf4;font-weight:600;color:#15803d}
        .footer{font-size:10px;color:#9ca3af;margin-top:22px;padding-top:10px;border-top:1px solid #e5e7eb}
        @media print{body{padding:0}.no-print{display:none}}
      </style>
    </head><body>
      <h1>${result.target.symbol} — Comparable Analysis</h1>
      <div class="sub">${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · Veridian Equity</div>
      <div class="summary">${result.summaryText}</div>
      <h2>Key Metrics</h2>
      <div class="grid">${stats}</div>
      <h2>Peer Comparison</h2>
      <table>
        <thead><tr><th>Ticker</th><th>Price</th><th>Mkt Cap</th><th>P/E</th><th>EV/EBITDA</th><th>EV/Rev</th><th>Rev Growth</th><th>ROE</th><th>Div Yield</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <h2>Implied Valuations</h2>
      <div class="grid">${ivCards}</div>
      <div class="footer">For educational purposes only. Not investment advice. Generated ${new Date().toISOString().split("T")[0]}.</div>
      <script>window.print();</script>
    </body></html>`);
    w.document.close();
  };

  const allCompanies = result ? [result.target, ...result.peers] : [];

  const scatterData = allCompanies
    .filter(p => p.peRatio !== null && p.revenueGrowth !== null)
    .map(p => ({
      name: p.symbol,
      pe: p.peRatio,
      growth: p.revenueGrowth,
      isTarget: p.symbol === result?.target.symbol,
    }));

  const mktCapData = allCompanies
    .filter(p => p.marketCapValue > 0)
    .sort((a, b) => b.marketCapValue - a.marketCapValue)
    .map(p => ({
      name: p.symbol,
      mktCap: parseFloat((p.marketCapValue / 1000).toFixed(1)),
      isTarget: p.symbol === result?.target.symbol,
    }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Comparable Analysis"
        subtitle="Peer valuation multiples and implied value"
        icon={<Layers className="w-5 h-5" />}
        rightContent={
          result ? (
            <button
              onClick={handleGenerateReport}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Generate Report
            </button>
          ) : undefined
        }
      />

      {/* Search */}
      <div className="card p-5" ref={searchRef}>
        <div className="flex items-center gap-2 mb-1.5">
          <Search className="w-3.5 h-3.5 text-accent" />
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Load Peers</label>
        </div>
        <div className="relative">
          <input
            type="text" value={ticker}
            onChange={e => setTicker(e.target.value)}
            placeholder="Search ticker..."
            className="input-field"
          />
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                className="absolute top-full left-0 right-0 mt-1.5 bg-surface-900 border border-white/[0.08] rounded-lg shadow-2xl z-50 overflow-hidden"
              >
                {searchResults.map(r => (
                  <button key={r.symbol} onClick={() => loadComps(r.symbol)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] text-sm group">
                    <span className="font-semibold text-white group-hover:text-accent">{r.symbol}</span>
                    <span className="text-xs text-slate-500 ml-2">{r.name}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {loading && <LoadingState message="Loading peer data & financials…" />}
      {!loading && !result && (
        <EmptyState icon={Layers} title="Load a Company" description="Search for a ticker above to compare against its peers and see implied valuations." />
      )}

      {result && !loading && (
        <div className="space-y-6">

          {/* Summary Banner */}
          <div className="p-4 rounded-xl border-l-4 border-accent bg-accent/[0.06] border border-accent/20">
            <p className="text-sm text-white font-medium leading-relaxed">{result.summaryText}</p>
          </div>

          {/* Peer Table */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-white/[0.04] bg-white/[0.02]">
              <h3 className="text-sm font-display font-semibold text-white">
                Peer Comparison ({result.peers.length} peers)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm font-mono">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    {["Ticker","Name","Price","Mkt Cap","P/E","EV/EBITDA","EV/Rev","Rev Growth","ROE","Div Yield"].map(h => (
                      <th key={h} className="px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Target row */}
                  <tr className="border-b border-accent/20 bg-accent/[0.04]">
                    <td className="px-3 py-2.5 font-semibold text-accent">{result.target.symbol}</td>
                    <td className="px-3 py-2.5 text-white truncate max-w-[90px]">{result.target.name}</td>
                    <td className="px-3 py-2.5 text-white">${formatSafe(result.target.price, 2)}</td>
                    <td className="px-3 py-2.5 text-white">{result.target.marketCap || "—"}</td>
                    <td className="px-3 py-2.5 text-white">{fmtX(result.target.peRatio)}</td>
                    <td className="px-3 py-2.5 text-white">{fmtX(result.target.evEbitda)}</td>
                    <td className="px-3 py-2.5 text-white">{fmtX(result.target.evRevenue)}</td>
                    <td className="px-3 py-2.5 text-white">{fmtPct(result.target.revenueGrowth)}</td>
                    <td className="px-3 py-2.5 text-white">{result.target.roe != null ? result.target.roe.toFixed(1) + "%" : "—"}</td>
                    <td className="px-3 py-2.5 text-white">{result.target.dividendYield != null ? result.target.dividendYield.toFixed(2) + "%" : "—"}</td>
                  </tr>
                  {/* Peer rows */}
                  {result.peers.map(p => (
                    <tr key={p.symbol}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] cursor-pointer"
                      onClick={() => onSelectTicker(p.symbol)}>
                      <td className="px-3 py-2.5 font-semibold text-white">{p.symbol}</td>
                      <td className="px-3 py-2.5 text-slate-400 truncate max-w-[90px]">{p.name}</td>
                      <td className="px-3 py-2.5 text-slate-400">${formatSafe(p.price, 2)}</td>
                      <td className="px-3 py-2.5 text-slate-400">{p.marketCap || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-300">{fmtX(p.peRatio)}</td>
                      <td className="px-3 py-2.5 text-slate-300">{fmtX(p.evEbitda)}</td>
                      <td className="px-3 py-2.5 text-slate-300">{fmtX(p.evRevenue)}</td>
                      <td className="px-3 py-2.5 text-slate-400">{fmtPct(p.revenueGrowth)}</td>
                      <td className="px-3 py-2.5 text-slate-400">{p.roe != null ? p.roe.toFixed(1) + "%" : "—"}</td>
                      <td className="px-3 py-2.5 text-slate-400">{p.dividendYield != null ? p.dividendYield.toFixed(2) + "%" : "—"}</td>
                    </tr>
                  ))}
                  {/* Median row */}
                  <tr className="border-t border-white/[0.08] bg-white/[0.01]">
                    <td className="px-3 py-2 text-[10px] text-slate-600 uppercase tracking-wider font-semibold" colSpan={4}>Peer Median</td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">{fmtX(result.medians.peRatio as number)}</td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">{fmtX(result.medians.evEbitda as number)}</td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">{fmtX(result.medians.evRevenue as number)}</td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">{result.medians.revenueGrowth != null ? fmtPct(result.medians.revenueGrowth as number) : "—"}</td>
                    <td colSpan={2} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Rank + Implied Valuation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Target Ranking vs Peers">
              {Object.entries(result.targetRanks).length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Insufficient data for ranking.</p>
              ) : (
                Object.entries(result.targetRanks).map(([metric, { rank, total }]) => {
                  const labels: Record<string, string> = {
                    peRatio: "P/E Ratio", evEbitda: "EV/EBITDA",
                    evRevenue: "EV/Revenue", revenueGrowth: "Rev Growth",
                  };
                  const pct = ((total - rank + 1) / total) * 100;
                  return (
                    <div key={metric} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                      <span className="text-xs text-slate-400">{labels[metric] ?? metric}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono font-semibold text-white">
                          {ordinal(rank)} of {total}
                        </span>
                        <div className="w-16 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </Card>

            <Card title="Implied Valuation">
              {result.impliedValuations.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">Insufficient multiples data for implied valuation.</p>
              ) : (
                <>
                  {result.impliedValuations.map(iv => (
                    <div key={iv.metric} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0">
                      <span className="text-xs text-slate-400">Via {iv.metric}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-white">
                          ${formatSafe(iv.impliedPrice, 2)}
                        </span>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${iv.upside >= 0 ? "text-accent bg-accent/10" : "text-red-400 bg-red-400/10"}`}>
                          {iv.upside >= 0 ? "+" : ""}{formatSafe(iv.upside, 1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 p-3 bg-accent/[0.06] rounded-lg border border-accent/20 text-center">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-0.5">Avg Implied Price</div>
                    <div className="text-xl font-mono font-bold text-accent">
                      ${formatSafe(
                        result.impliedValuations.reduce((s, v) => s + (v.impliedPrice || 0), 0) /
                        (result.impliedValuations.length || 1), 2
                      )}
                    </div>
                  </div>
                </>
              )}
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* P/E vs Revenue Growth Scatter */}
            <Card title="P/E vs Revenue Growth">
              <div className="h-[260px]">
                {scatterData.length < 2 ? (
                  <div className="flex items-center justify-center h-full text-xs text-slate-500">
                    Insufficient data for scatter plot
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis
                        type="number" dataKey="pe" name="P/E Ratio"
                        stroke="#475569" fontSize={10} tickLine={false} axisLine={false}
                        label={{ value: "P/E Ratio", position: "insideBottom", offset: -10, fill: "#475569", fontSize: 9 }}
                      />
                      <YAxis
                        type="number" dataKey="growth" name="Rev Growth %"
                        stroke="#475569" fontSize={10} tickLine={false} axisLine={false}
                        label={{ value: "Rev Growth %", angle: -90, position: "insideLeft", offset: 10, fill: "#475569", fontSize: 9 }}
                      />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }}
                        formatter={(val: any, name: string) => [typeof val === "number" ? val.toFixed(1) : val, name]}
                      />
                      <Scatter data={scatterData} shape={<CustomDot />} />
                    </ScatterChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Market Cap Comparison */}
            <Card title="Market Cap Comparison ($B)">
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={mktCapData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                    <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis
                      stroke="#475569" fontSize={10} tickLine={false} axisLine={false}
                      tickFormatter={(v: number) => `$${v}B`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }}
                      formatter={(v: number) => [`$${v.toFixed(1)}B`, "Market Cap"]}
                    />
                    <Bar dataKey="mktCap" radius={[4, 4, 0, 0]}>
                      {mktCapData.map((entry, idx) => (
                        <Cell key={`cell-${idx}`} fill={entry.isTarget ? "#22c55e" : "#334155"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* P/E Bar Chart */}
          <Card title="P/E Ratio Comparison">
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={allCompanies.filter(p => p.peRatio).map(p => ({
                    name: p.symbol, pe: p.peRatio, isTarget: p.symbol === result.target.symbol,
                  }))}
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                  <XAxis dataKey="name" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(v: any) => [typeof v === "number" ? v.toFixed(1) + "x" : v, "P/E Ratio"]}
                  />
                  <Bar dataKey="pe" radius={[4, 4, 0, 0]}>
                    {allCompanies.filter(p => p.peRatio).map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={entry.symbol === result.target.symbol ? "#22c55e" : "#334155"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

        </div>
      )}
    </div>
  );
};
