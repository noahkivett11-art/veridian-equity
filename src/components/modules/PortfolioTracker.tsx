import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Briefcase, Plus, Trash2, Search, ArrowUp, ArrowDown, X, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, PageHeader, LoadingState, EmptyState, ChangeBadge, LivePriceDisplay } from "../shared";
import { PortfolioService, Portfolio, Position, PortfolioSummary } from "../../services/portfolioService";
import { CompanyDataService, CompanySearchResult } from "../../services/companyService";
import { LiveQuoteService } from "../../services/liveQuoteService";
import { LiveQuote } from "../../services/api/types";
import { useDebounce, useClickOutside } from "../../hooks";
import { formatCurrency, formatPercent, formatSafe } from "../../lib/utils";

const COLORS = ["#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];

// Static beta lookup from screener data
const BETA_LOOKUP: Record<string, number> = {
  AAPL: 1.24, MSFT: 0.90, NVDA: 1.66, GOOGL: 1.05, AMZN: 1.42, META: 1.22,
  TSLA: 2.31, 'BRK.B': 0.88, JPM: 1.10, V: 0.93, UNH: 0.53, LLY: 0.44,
  XOM: 0.82, CVX: 0.82, PG: 0.54, COST: 0.74, HD: 1.02, WMT: 0.59, KO: 0.57,
  PEP: 0.54, ABBV: 0.65, BAC: 1.35, ADBE: 1.41, CRM: 1.30, AVGO: 1.33,
  ORCL: 1.00, ACN: 1.10, NFLX: 1.52, DIS: 1.20, TMO: 0.78, AMD: 1.95, INTC: 0.90,
};

function calcRiskMetrics(positions: any[], liveQuotes: Record<string, any>, summary: any) {
  if (!positions.length || !summary) return null;
  const RF_RATE = 0.05;
  const MARKET_VOL = 0.15;

  let weightedBeta = 0;
  let totalValue = 0;
  positions.forEach(p => {
    const live = liveQuotes[p.symbol];
    const price = live ? live.price : p.currentPrice;
    const mv = price * p.shares;
    totalValue += mv;
  });

  positions.forEach(p => {
    const live = liveQuotes[p.symbol];
    const price = live ? live.price : p.currentPrice;
    const mv = price * p.shares;
    const weight = totalValue > 0 ? mv / totalValue : 0;
    const beta = BETA_LOOKUP[p.symbol] ?? 1.0;
    weightedBeta += weight * beta;
  });

  const portfolioBeta = parseFloat(weightedBeta.toFixed(3));
  const annualStdDev = parseFloat((portfolioBeta * MARKET_VOL * 100).toFixed(2));
  const portfolioReturn = summary.totalGainLossPercent / 100;
  const sharpe = annualStdDev > 0
    ? parseFloat(((portfolioReturn - RF_RATE) / (annualStdDev / 100)).toFixed(3))
    : null;

  return { portfolioBeta, annualStdDev, sharpe };
}

interface PortfolioTrackerProps {
  onSelectTicker: (symbol: string) => void;
}

export const PortfolioTrackerModule: React.FC<PortfolioTrackerProps> = ({ onSelectTicker }) => {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [newPosition, setNewPosition] = useState({ shares: "", cost: "", date: new Date().toISOString().split("T")[0] });
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({});

  const debouncedSearch = useDebounce(searchQuery, 300);
  const clearSearch = useCallback(() => setSearchResults([]), []);
  const searchRef = useClickOutside(clearSearch);

  // Load portfolio on mount
  useEffect(() => {
    const portfolios = PortfolioService.getInstance().getPortfolios();
    if (portfolios.length === 0) {
      setPortfolio(PortfolioService.getInstance().createPortfolio("My Portfolio"));
    } else {
      setPortfolio(portfolios[0]);
    }
  }, []);

  // Subscribe to live quotes
  useEffect(() => {
    if (!portfolio || portfolio.positions.length === 0) return;
    const unsubs = portfolio.positions.map((p) =>
      LiveQuoteService.getInstance().subscribe(p.symbol, (q) => {
        setLiveQuotes((prev) => ({ ...prev, [p.symbol]: q }));
      })
    );
    return () => unsubs.forEach((u) => u());
  }, [portfolio?.id, portfolio?.positions.length]);

  // Search
  useEffect(() => {
    if (debouncedSearch.length > 0) {
      CompanyDataService.getInstance().searchCompanies(debouncedSearch).then(setSearchResults);
    } else {
      setSearchResults([]);
    }
  }, [debouncedSearch]);

  const addPosition = async (symbol: string) => {
    if (!portfolio) return;
    const shares = parseFloat(newPosition.shares);
    const cost = parseFloat(newPosition.cost);
    if (isNaN(shares) || isNaN(cost)) return;

    setLoading(true);
    const updated = await PortfolioService.getInstance().addPosition(portfolio.id, symbol, shares, cost, newPosition.date);
    if (updated) {
      setPortfolio({ ...updated });
      setSearchQuery("");
      setSearchResults([]);
      setNewPosition({ shares: "", cost: "", date: new Date().toISOString().split("T")[0] });
      setIsAdding(false);
    }
    setLoading(false);
  };

  const removePosition = (positionId: string) => {
    if (!portfolio) return;
    const updated = PortfolioService.getInstance().deletePosition(portfolio.id, positionId);
    if (updated) setPortfolio({ ...updated });
  };

  const refreshPrices = async () => {
    if (!portfolio) return;
    setLoading(true);
    const updated = await PortfolioService.getInstance().refreshPortfolioPrices(portfolio.id);
    if (updated) setPortfolio({ ...updated });
    setLoading(false);
  };

  const summary = portfolio ? PortfolioService.getInstance().calculateSummary(portfolio) : null;

  const positions = portfolio?.positions || [];

  const riskMetrics = useMemo(
    () => calcRiskMetrics(positions, liveQuotes, summary),
    [positions, liveQuotes, summary]
  );

  // Sector allocation for pie chart
  const sectorMap = new Map<string, number>();
  positions.forEach((p) => {
    const current = sectorMap.get(p.sector) || 0;
    sectorMap.set(p.sector, current + p.marketValue);
  });
  const sectorData = Array.from(sectorMap.entries()).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolio Tracker"
        subtitle="Track positions with live pricing and P&L"
        icon={<Briefcase className="w-5 h-5" />}
        rightContent={
          <div className="flex gap-2">
            <button onClick={refreshPrices} disabled={loading} className="btn-secondary text-xs">
              {loading ? "Refreshing..." : "Refresh Prices"}
            </button>
            <button onClick={() => setIsAdding(true)} className="btn-primary text-xs flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Position
            </button>
          </div>
        }
      />

      {/* Summary Cards */}
      {summary && positions.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Value", value: formatCurrency(summary.totalMarketValue) },
            { label: "Total Cost", value: formatCurrency(summary.totalCostBasis) },
            { label: "Total P&L", value: formatCurrency(summary.totalGainLoss), color: summary.totalGainLoss >= 0 ? "positive" : "negative" },
            { label: "Return", value: `${summary.totalGainLossPercent >= 0 ? "+" : ""}${summary.totalGainLossPercent.toFixed(2)}%`, color: summary.totalGainLossPercent >= 0 ? "positive" : "negative" },
          ].map((s) => (
            <Card key={s.label}>
              <div className="stat-label mb-1">{s.label}</div>
              <div className={`stat-value ${s.color || ""}`}>{s.value}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Position Modal */}
      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Card title="Add New Position">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative" ref={searchRef}>
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search ticker..." className="input-field" />
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface-900 border border-white/[0.08] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
                      {searchResults.map((r) => (
                        <button key={r.symbol} onClick={() => { setSearchQuery(r.symbol); setSearchResults([]); }}
                          className="w-full text-left px-3 py-2 hover:bg-white/[0.04] text-sm">
                          <span className="font-semibold text-accent">{r.symbol}</span>
                          <span className="text-slate-500 ml-2 text-xs">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="number" placeholder="Shares" value={newPosition.shares} onChange={(e) => setNewPosition({ ...newPosition, shares: e.target.value })} className="input-field" />
                <input type="number" placeholder="Cost basis per share" value={newPosition.cost} onChange={(e) => setNewPosition({ ...newPosition, cost: e.target.value })} className="input-field" />
                <div className="flex gap-2">
                  <button onClick={() => addPosition(searchQuery)} disabled={loading || !searchQuery} className="btn-primary flex-1 text-xs">
                    {loading ? "Adding..." : "Add"}
                  </button>
                  <button onClick={() => setIsAdding(false)} className="btn-secondary text-xs"><X className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Risk Metrics Panel */}
      {riskMetrics && positions.length >= 2 && (
        <Card title="Portfolio Risk Metrics"
          rightContent={<Activity className="w-3.5 h-3.5 text-accent" />}>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Portfolio Beta</p>
              <p className={`text-2xl font-mono font-bold ${riskMetrics.portfolioBeta > 1.2 ? 'text-warning' : riskMetrics.portfolioBeta < 0.8 ? 'text-info' : 'text-white'}`}>
                {riskMetrics.portfolioBeta.toFixed(2)}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">vs S&P 500 = 1.0</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Est. Std Dev</p>
              <p className="text-2xl font-mono font-bold text-white">{riskMetrics.annualStdDev.toFixed(1)}%</p>
              <p className="text-[10px] text-slate-600 mt-1">Ann. volatility est.</p>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.04] text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Sharpe Ratio</p>
              <p className={`text-2xl font-mono font-bold ${riskMetrics.sharpe === null ? 'text-slate-600' : riskMetrics.sharpe >= 1 ? 'text-accent' : riskMetrics.sharpe >= 0 ? 'text-white' : 'text-danger'}`}>
                {riskMetrics.sharpe !== null ? riskMetrics.sharpe.toFixed(2) : '—'}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">Rf = 5.0% assumed</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-600 mt-3">
            Beta is weighted average of individual position betas. Std Dev estimated as β × 15% market volatility. Sharpe = (return – rf) / std dev.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Positions Table */}
        <div className="lg:col-span-2">
          {positions.length === 0 ? (
            <EmptyState icon={Briefcase} title="No Positions" description="Add your first position to start tracking." action={
              <button onClick={() => setIsAdding(true)} className="btn-primary text-xs flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /> Add Position</button>
            } />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.06]">
                      {["Ticker", "Shares", "Avg Cost", "Price", "Mkt Value", "P&L", "P&L %", "Weight", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => {
                      const live = liveQuotes[p.symbol];
                      const price = live ? live.price : p.currentPrice;
                      const mv = price * p.shares;
                      const pl = mv - p.costBasis * p.shares;
                      const plPct = p.costBasis > 0 ? ((price - p.costBasis) / p.costBasis) * 100 : 0;
                      return (
                        <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-2.5 font-mono font-semibold text-accent text-sm cursor-pointer hover:underline" onClick={() => onSelectTicker(p.symbol)}>{p.symbol}</td>
                          <td className="px-4 py-2.5 font-mono text-sm">{p.shares}</td>
                          <td className="px-4 py-2.5 font-mono text-sm">{formatCurrency(p.costBasis)}</td>
                          <td className="px-4 py-2.5 font-mono text-sm"><LivePriceDisplay value={price} stale={live?.stale} /></td>
                          <td className="px-4 py-2.5 font-mono text-sm">{formatCurrency(mv)}</td>
                          <td className={`px-4 py-2.5 font-mono text-sm ${pl >= 0 ? "positive" : "negative"}`}>{pl >= 0 ? "+" : ""}{formatCurrency(pl)}</td>
                          <td className="px-4 py-2.5"><ChangeBadge value={plPct} /></td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{p.weight ? `${(p.weight * 100).toFixed(1)}%` : "—"}</td>
                          <td className="px-4 py-2.5">
                            <button onClick={() => removePosition(p.id)} className="text-slate-600 hover:text-danger transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Sector Allocation Pie */}
        {sectorData.length > 0 && (
          <Card title="Sector Allocation">
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} strokeWidth={0}>
                    {sectorData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "#0f1423", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "11px" }}
                    formatter={(value: number) => [formatCurrency(value), "Value"]} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 mt-2">
              {sectorData.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-slate-400">{s.name}</span>
                  </div>
                  <span className="font-mono text-white">{formatCurrency(s.value)}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};
