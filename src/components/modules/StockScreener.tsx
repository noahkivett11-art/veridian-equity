import React, { useState, useEffect } from "react";
import { Search, ArrowUp, ArrowDown, Download, Filter } from "lucide-react";
import { Card, PageHeader, RangeInput, LivePriceDisplay } from "../shared";
import { ScreenerService, ScreenerFilters, ScreenerResult } from "../../services/screenerService";
import { LiveQuoteService } from "../../services/liveQuoteService";
import { useLiveQuote } from "../../hooks";
import { formatCurrency } from "../../lib/utils";

const PriceCell = ({ symbol, initialPrice }: { symbol: string; initialPrice: number | null }) => {
  const quote = useLiveQuote(symbol);
  return <LivePriceDisplay value={quote ? quote.price : initialPrice} stale={quote?.stale} />;
};

interface StockScreenerProps {
  onSelectTicker: (symbol: string) => void;
}

const INITIAL_FILTERS: ScreenerFilters = {
  marketCapMin: null, marketCapMax: null,
  peMin: null, peMax: null,
  sector: "All",
  perfMin: null, perfMax: null,
  revGrowthMin: null, revGrowthMax: null,
  roeMin: null, roeMax: null,
  betaMin: null, betaMax: null,
};

const PREBUILT_SCREENS: { label: string; desc: string; filters: Partial<ScreenerFilters> }[] = [
  { label: "Value Stocks",     desc: "Low P/E, high ROE",       filters: { peMin: 5, peMax: 20, roeMin: 10 } },
  { label: "High Dividend",    desc: "Stable, low-beta earners", filters: { marketCapMin: 50, peMin: 8, peMax: 22, betaMax: 1.0 } },
  { label: "Growth Leaders",   desc: "High revenue growth",      filters: { revGrowthMin: 15, perfMin: 15 } },
  { label: "Momentum Picks",   desc: "Strong 52-week trend",     filters: { perfMin: 30, betaMin: 1.0 } },
];

const exportToCSV = (results: ScreenerResult[]) => {
  const headers = ['Symbol','Company','Price','Mkt Cap ($B)','P/E','Rev Growth (%)','ROE (%)','Beta','52W Perf (%)','Sector'];
  const rows = results.map(r => [
    r.symbol, `"${r.name}"`,
    r.price?.toFixed(2) ?? '',
    r.marketCap?.toFixed(1) ?? '',
    r.pe?.toFixed(1) ?? '',
    r.revGrowth?.toFixed(1) ?? '',
    r.roe?.toFixed(1) ?? '',
    r.beta?.toFixed(2) ?? '',
    r.perf52w?.toFixed(1) ?? '',
    r.sector,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `veridian_screen_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
};

export const StockScreenerModule: React.FC<StockScreenerProps> = ({ onSelectTicker }) => {
  const [filters, setFilters] = useState<ScreenerFilters>(INITIAL_FILTERS);
  const [results, setResults] = useState<ScreenerResult[]>([]);
  const [sectors, setSectors] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof ScreenerResult; direction: "asc" | "desc" } | null>(null);
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    ScreenerService.getInstance().getSectors().then(setSectors);
  }, []);

  const runScreen = async () => {
    setLoading(true);
    const data = await ScreenerService.getInstance().runScreen(filters);
    data.forEach((s) => {
      if (s.price !== null) LiveQuoteService.getInstance().updateQuote(s.symbol, s.price);
    });
    setResults(data);
    setLoading(false);
    setPage(1);
  };

  const reset = () => { setFilters(INITIAL_FILTERS); setResults([]); };

  const handleSort = (key: keyof ScreenerResult) => {
    setSortConfig((prev) =>
      prev?.key === key && prev.direction === "asc"
        ? { key, direction: "desc" }
        : { key, direction: "asc" }
    );
  };

  const sorted = [...results].sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const va = a[key], vb = b[key];
    if (va === null) return 1;
    if (vb === null) return -1;
    return direction === "asc" ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
  });

  const paginated = sorted.slice((page - 1) * perPage, page * perPage);
  const totalPages = Math.ceil(results.length / perPage);

  const f = (key: keyof ScreenerFilters) => (v: number | null) =>
    setFilters((p) => ({ ...p, [key]: v }));

  const columns = [
    { label: "Ticker", key: "symbol" },
    { label: "Company", key: "name" },
    { label: "Price", key: "price" },
    { label: "Mkt Cap", key: "marketCap" },
    { label: "PE", key: "pe" },
    { label: "Rev Growth", key: "revGrowth" },
    { label: "ROE", key: "roe" },
    { label: "Beta", key: "beta" },
    { label: "52W Chg", key: "perf52w" },
    { label: "Sector", key: "sector" },
  ] as const;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stock Screener"
        subtitle="Filter the equity universe with institutional-grade criteria"
        icon={<Search className="w-5 h-5" />}
        rightContent={
          <div className="flex gap-2">
            {results.length > 0 && (
              <button onClick={() => exportToCSV(results)} className="btn-secondary text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" />Export CSV
              </button>
            )}
            <button onClick={reset} className="btn-secondary text-xs">Reset</button>
            <button onClick={runScreen} disabled={loading} className="btn-primary text-xs">
              {loading ? "Scanning..." : "Run Screen"}
            </button>
          </div>
        }
      />

      {/* Pre-built Screens */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <Filter className="w-3 h-3" />Quick Screens
        </p>
        <div className="flex flex-wrap gap-2">
          {PREBUILT_SCREENS.map(screen => (
            <button
              key={screen.label}
              onClick={() => { setFilters({ ...INITIAL_FILTERS, ...screen.filters }); }}
              className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] hover:border-accent/30 hover:bg-accent/[0.06] text-sm text-slate-300 hover:text-white transition-all"
              title={screen.desc}
            >
              {screen.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Valuation">
          <div className="space-y-4">
            <RangeInput label="Market Cap ($B)" minVal={filters.marketCapMin} maxVal={filters.marketCapMax} onMinChange={f("marketCapMin")} onMaxChange={f("marketCapMax")} />
            <RangeInput label="PE Ratio" minVal={filters.peMin} maxVal={filters.peMax} onMinChange={f("peMin")} onMaxChange={f("peMax")} step={0.1} />
            <div className="space-y-1.5">
              <label className="stat-label">Sector</label>
              <select value={filters.sector} onChange={(e) => setFilters({ ...filters, sector: e.target.value })} className="input-field text-xs">
                {sectors.map((s) => <option key={s} value={s} className="bg-surface-900">{s}</option>)}
              </select>
            </div>
          </div>
        </Card>

        <Card title="Growth">
          <div className="space-y-4">
            <RangeInput label="Revenue Growth (%)" minVal={filters.revGrowthMin} maxVal={filters.revGrowthMax} onMinChange={f("revGrowthMin")} onMaxChange={f("revGrowthMax")} step={0.1} />
            <RangeInput label="52W Performance (%)" minVal={filters.perfMin} maxVal={filters.perfMax} onMinChange={f("perfMin")} onMaxChange={f("perfMax")} step={0.1} />
          </div>
        </Card>

        <Card title="Quality">
          <div className="space-y-4">
            <RangeInput label="ROE (%)" minVal={filters.roeMin} maxVal={filters.roeMax} onMinChange={f("roeMin")} onMaxChange={f("roeMax")} step={0.1} />
          </div>
        </Card>

        <Card title="Risk">
          <div className="space-y-4">
            <RangeInput label="Beta" minVal={filters.betaMin} maxVal={filters.betaMax} onMinChange={f("betaMin")} onMaxChange={f("betaMax")} step={0.01} />
          </div>
        </Card>
      </div>

      {/* Results Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.03] border-b border-white/[0.06]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key as keyof ScreenerResult)}
                    className="px-4 py-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      {col.label}
                      {sortConfig?.key === col.key && (sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-7 h-7 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                    <span className="text-xs text-slate-500">Scanning equity universe...</span>
                  </div>
                </td></tr>
              ) : paginated.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-16 text-center text-sm text-slate-500">
                  {results.length === 0 ? "Configure filters and run screen." : "No matches."}
                </td></tr>
              ) : (
                paginated.map((s) => (
                  <tr key={s.symbol} onClick={() => onSelectTicker(s.symbol)} className="border-b border-white/[0.03] hover:bg-white/[0.03] transition-colors cursor-pointer">
                    <td className="px-4 py-3 font-mono font-semibold text-accent text-sm">{s.symbol}</td>
                    <td className="px-4 py-3 text-sm text-white truncate max-w-[140px]">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-sm"><PriceCell symbol={s.symbol} initialPrice={s.price} /></td>
                    <td className="px-4 py-3 font-mono text-sm">{s.marketCap !== null ? `$${s.marketCap.toFixed(1)}B` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-sm">{s.pe !== null ? s.pe.toFixed(1) : "—"}</td>
                    <td className={`px-4 py-3 font-mono text-sm ${s.revGrowth !== null ? (s.revGrowth >= 0 ? "positive" : "negative") : "text-slate-600"}`}>
                      {s.revGrowth !== null ? `${s.revGrowth > 0 ? "+" : ""}${s.revGrowth.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{s.roe !== null ? `${s.roe.toFixed(1)}%` : "—"}</td>
                    <td className="px-4 py-3 font-mono text-sm">{s.beta !== null ? s.beta.toFixed(2) : "—"}</td>
                    <td className={`px-4 py-3 font-mono text-sm ${s.perf52w !== null ? (s.perf52w >= 0 ? "positive" : "negative") : "text-slate-600"}`}>
                      {s.perf52w !== null ? `${s.perf52w > 0 ? "+" : ""}${s.perf52w.toFixed(1)}%` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{s.sector}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 bg-white/[0.02] flex items-center justify-between border-t border-white/[0.04]">
            <span className="text-xs text-slate-500">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, results.length)} of {results.length}
            </span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs py-1.5 px-3">Prev</button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs py-1.5 px-3">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
