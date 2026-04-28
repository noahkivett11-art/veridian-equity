import React, { useState, useEffect } from "react";
import { Activity, ArrowUp, ArrowDown, Globe, FileText, Newspaper, Zap, ExternalLink, Users, TrendingUp, BarChart3 } from "lucide-react";
import { Card, PageHeader, Skeleton, StatRow, LoadingState, ChangeBadge, TabBar } from "../shared";
import { CompanyChart } from "./CompanyChart";
import { KeyStatisticsPanel } from "./KeyStatistics";
import { CompanyDataService, CompanyData, CompanyNews, KeyStatistics } from "../../services/companyService";
import { AIService } from "../../services/aiService";
import { FinnhubClient } from "../../services/api/finnhubClient";
import { LiveQuoteService } from "../../services/liveQuoteService";
import { useLiveQuote } from "../../hooks";
import { parseNumber, formatPercent, formatCurrency } from "../../lib/utils";

const fmtB = (v: string | undefined) => {
  if (!v) return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(2)}`;
};

// Transforms Finnhub stock/financials-reported XBRL data into the annualReports
// shape the financial tables expect, matching the keys used in the render below.
function transformFinnhubFinancials(reports: any[]) {
  const ts = (v: any) => (v != null ? String(v) : undefined);
  const byConceptMap = (items: any[]) =>
    Object.fromEntries((items ?? []).map((x: any) => [x.concept, x.value]));

  // API returns newest-first; quarter === 0 means full-year filing
  const annuals = reports.filter((r: any) => r.quarter === 0).slice(0, 3);
  if (!annuals.length) return null;

  const incomeReports = annuals.map((r: any) => {
    const date = r.endDate?.split(' ')[0] ?? `${r.year}-09-30`;
    const ic = byConceptMap(r.report?.ic);
    const cf = byConceptMap(r.report?.cf);
    const opIncome = ic['us-gaap_OperatingIncomeLoss'] ?? 0;
    const da = cf['us-gaap_DepreciationDepletionAndAmortization'] ?? 0;
    return {
      fiscalDateEnding: date,
      totalRevenue:    ts(ic['us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax'] ?? ic['us-gaap_Revenues']),
      grossProfit:     ts(ic['us-gaap_GrossProfit']),
      operatingIncome: ts(opIncome),
      netIncome:       ts(ic['us-gaap_NetIncomeLoss']),
      ebitda:          ts(opIncome + da),
    };
  });

  const balanceReports = annuals.map((r: any) => {
    const date = r.endDate?.split(' ')[0] ?? `${r.year}-09-30`;
    const bs = byConceptMap(r.report?.bs);
    return {
      fiscalDateEnding:        date,
      totalAssets:             ts(bs['us-gaap_Assets']),
      totalCurrentAssets:      ts(bs['us-gaap_AssetsCurrent']),
      totalLiabilities:        ts(bs['us-gaap_Liabilities']),
      totalCurrentLiabilities: ts(bs['us-gaap_LiabilitiesCurrent']),
      totalShareholderEquity:  ts(bs['us-gaap_StockholdersEquity']),
      longTermDebt:            ts(bs['us-gaap_LongTermDebtNoncurrent'] ?? bs['us-gaap_LongTermDebt']),
    };
  });

  const cashflowReports = annuals.map((r: any) => {
    const date = r.endDate?.split(' ')[0] ?? `${r.year}-09-30`;
    const cf = byConceptMap(r.report?.cf);
    return {
      fiscalDateEnding:           date,
      operatingCashflow:          ts(cf['us-gaap_NetCashProvidedByUsedInOperatingActivities']),
      capitalExpenditures:        ts(cf['us-gaap_PaymentsToAcquirePropertyPlantAndEquipment']),
      dividendPayout:             ts(cf['us-gaap_PaymentsOfDividends']),
      proceedsFromIssuanceOfDebt: ts(cf['us-gaap_ProceedsFromIssuanceOfLongTermDebt']),
    };
  });

  return {
    income:    { annualReports: incomeReports },
    balance:   { annualReports: balanceReports },
    cashflow:  { annualReports: cashflowReports },
  };
}

interface CompanyResearchProps {
  symbol: string;
  onNavigate?: (module: string) => void;
}

export const CompanyResearchModule: React.FC<CompanyResearchProps> = ({ symbol, onNavigate }) => {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [news, setNews] = useState<CompanyNews[]>([]);
  const [stats, setStats] = useState<KeyStatistics | null>(null);
  const [aiOverview, setAiOverview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  // New state for added sections
  const [analystRatings, setAnalystRatings] = useState<any[]>([]);
  const [peers, setPeers] = useState<string[]>([]);
  const [peerStats, setPeerStats] = useState<Record<string, any>>({});
  const [financials, setFinancials] = useState<{ income: any; balance: any; cashflow: any } | null>(null);
  const [finLoading, setFinLoading] = useState(false);
  const [finTab, setFinTab] = useState('Income');
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const liveQuote = useLiveQuote(symbol);

  useEffect(() => {
    // Fetch analyst ratings, peers, financials independently
    const loadExtra = async () => {
      setSectionsLoading(true);
      try {
        const [ratings, peerList] = await Promise.all([
          FinnhubClient.getInstance().getAnalystRecommendations(symbol),
          FinnhubClient.getInstance().getPeers(symbol),
        ]);
        setAnalystRatings(ratings);
        const filteredPeers = peerList.filter((p: string) => p !== symbol).slice(0, 5);
        setPeers(filteredPeers);

        if (filteredPeers.length > 0) {
          const peerData = await Promise.all(
            filteredPeers.map(async (p: string) => {
              const [profile, quote] = await Promise.all([
                FinnhubClient.getInstance().getCompanyProfile(p).catch(() => null),
                FinnhubClient.getInstance().getQuote(p).catch(() => null),
              ]);
              return { symbol: p, profile, quote };
            })
          );
          const map: Record<string, any> = {};
          peerData.forEach(({ symbol: s, profile, quote }) => { map[s] = { profile, quote }; });
          setPeerStats(map);
        }
      } catch {}
      setSectionsLoading(false);
    };

    const loadFinancials = async () => {
      setFinLoading(true);
      try {
        const raw = await FinnhubClient.getInstance().getFinancialsReported(symbol);
        if (raw?.data?.length) {
          const transformed = transformFinnhubFinancials(raw.data);
          if (transformed) setFinancials(transformed);
        }
      } catch {}
      setFinLoading(false);
    };

    loadExtra();
    loadFinancials();
  }, [symbol]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setAiOverview(null);
      setStats(null);
      setNews([]);

      // Fetch company data, news, and stats all in parallel
      const [data, newsData, statsData] = await Promise.all([
        CompanyDataService.getInstance().fetchCompanyData(symbol),
        CompanyDataService.getInstance().fetchCompanyNews(symbol),
        CompanyDataService.getInstance().fetchKeyStatistics(symbol),
      ]);

      if (data) {
        const price = typeof data.price === "string" ? parseFloat(data.price) : (data.price ?? 0);
        const change = typeof data.change === "string" ? parseFloat(data.change) : (data.change ?? 0);
        const changePct = typeof data.percentChange === "string" ? parseFloat(data.percentChange) : (data.percentChange ?? 0);
        LiveQuoteService.getInstance().updateQuote(data.symbol, price, change, changePct);
      }

      setCompany(data);
      setNews(newsData);
      setStats(statsData);
      setLoading(false);

      if (data && statsData) {
        setAiLoading(true);
        try {
          const overview = await AIService.getInstance().generateCompanyOverview(data, statsData, newsData);
          setAiOverview(overview);
        } catch (err) {
          console.error("Error loading AI overview:", err);
        } finally {
          setAiLoading(false);
        }
      }
    };
    load();
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-6">
        {/* Skeleton header card */}
        <div className="card p-6 border-l-2 border-accent/30">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-8 w-48" />
            </div>
            <div className="space-y-2 text-right">
              <Skeleton className="h-8 w-28 ml-auto" />
              <Skeleton className="h-4 w-20 ml-auto" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6 pt-5 border-t border-white/[0.04]">
            {[1,2,3,4].map(i => <div key={i} className="space-y-1.5"><Skeleton className="h-3 w-16" /><Skeleton className="h-4 w-20" /></div>)}
          </div>
        </div>
        {/* Skeleton AI card */}
        <div className="card p-5 space-y-3">
          <Skeleton className="h-3 w-32 mb-4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
        {/* Skeleton chart */}
        <div className="card p-5">
          <Skeleton className="h-[380px] w-full" />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center h-64 card">
        <h3 className="text-lg font-semibold text-white mb-2">Ticker Not Found</h3>
        <p className="text-sm text-slate-500">No data available for "{symbol}".</p>
      </div>
    );
  }

  const displayPrice = liveQuote ? liveQuote.price : company.price;
  const displayChange = liveQuote ? liveQuote.change : parseNumber(company.change);
  const displayPct = liveQuote ? liveQuote.changePercent : parseNumber(company.percentChange);
  const isPositive = displayChange >= 0;

  // Derive revenue TTM from financials statements if the metric endpoint didn't return it
  const revenueTTM = (() => {
    const fromStats = stats?.revenueTTM;
    if (fromStats && fromStats !== "Data unavailable") return fromStats;
    const raw = financials?.income?.annualReports?.[0]?.totalRevenue;
    return raw ? fmtB(raw) : null;
  })();

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="card p-6 border-l-2 border-accent">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="badge-live text-[9px]">{company.exchange}</span>
              <span className="text-slate-500 text-sm font-mono">{company.symbol}</span>
            </div>
            <h2 className="text-3xl font-display font-bold text-white">{company.name}</h2>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono font-bold text-white mb-1">
              {formatCurrency(displayPrice)}
            </div>
            <div className="flex items-center justify-end gap-2">
              <span className={`flex items-center gap-1 text-sm font-mono font-semibold ${isPositive ? "positive" : "negative"}`}>
                {isPositive ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                {Math.abs(displayChange).toFixed(2)}
              </span>
              <ChangeBadge value={displayPct} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-5 border-t border-white/[0.04]">
          {[
            { label: "Market Cap", value: company.marketCap },
            { label: "Sector", value: company.sector },
            { label: "Industry", value: company.industry },
            { label: "Status", value: company.marketStatus },
          ].map((item) => (
            <div key={item.label}>
              <div className="stat-label mb-1">{item.label}</div>
              <div className="text-sm font-mono text-white">{item.value || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Overview */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-accent" />
            AI Intelligence Summary
          </h3>
          <div className="badge bg-accent/10 text-accent border-accent/20">
            <Zap className="w-3 h-3" /> AI-Generated
          </div>
        </div>

        {aiLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        ) : aiOverview ? (
          <div className="space-y-5">
            <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap">{aiOverview}</p>
            {stats && (
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.04]">
                {[
                  { label: "Revenue (TTM)", val: revenueTTM },
                  { label: "Op. Margin", val: stats.operatingMarginTTM ? `${stats.operatingMarginTTM}%` : null },
                  { label: "Market Cap", val: company.marketCap },
                ].map((m) => (
                  <div key={m.label} className="p-3 bg-white/[0.03] rounded-lg">
                    <div className="text-[9px] text-slate-500 uppercase tracking-wider mb-1">{m.label}</div>
                    <div className="text-sm font-mono font-semibold text-white">{m.val || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500 italic">AI overview unavailable.</p>
        )}
      </Card>

      {/* Description */}
      {company.description && (
        <Card title="Company Profile">
          <p className="text-sm text-slate-400 leading-relaxed">{company.description}</p>
        </Card>
      )}

      {/* Chart */}
      <CompanyChart symbol={symbol} />

      {/* Key Statistics */}
      <KeyStatisticsPanel symbol={symbol} preloadedStats={stats} />

      {/* Financials */}
      <Card title="Financial Statements"
        rightContent={<TabBar tabs={['Income', 'Balance Sheet', 'Cash Flow']} active={finTab} onChange={setFinTab} />}>
        {finLoading ? (
          <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : !financials ? (
          <p className="text-xs text-slate-500 text-center py-6">Financial statements unavailable for this symbol.</p>
        ) : (
          <div className="overflow-x-auto">
            {finTab === 'Income' && (() => {
              const rpts = financials.income?.annualReports?.slice(0, 3) ?? [];
              if (!rpts.length) return <p className="text-xs text-slate-500 py-4">No data</p>;
              return (
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-2 text-[10px] text-slate-500 uppercase">Metric</th>
                      {rpts.map((r: any) => <th key={r.fiscalDateEnding} className="text-right py-2 text-[10px] text-slate-500">{r.fiscalDateEnding?.split('-')[0]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Revenue',        key: 'totalRevenue' },
                      { label: 'Gross Profit',   key: 'grossProfit' },
                      { label: 'Op. Income',     key: 'operatingIncome' },
                      { label: 'Net Income',     key: 'netIncome' },
                      { label: 'EBITDA',         key: 'ebitda' },
                    ].map(row => (
                      <tr key={row.key} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 text-slate-400 text-xs">{row.label}</td>
                        {rpts.map((r: any) => <td key={r.fiscalDateEnding} className="py-2.5 text-right text-white">{fmtB(r[row.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            {finTab === 'Balance Sheet' && (() => {
              const rpts = financials.balance?.annualReports?.slice(0, 3) ?? [];
              if (!rpts.length) return <p className="text-xs text-slate-500 py-4">No data</p>;
              return (
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-2 text-[10px] text-slate-500 uppercase">Metric</th>
                      {rpts.map((r: any) => <th key={r.fiscalDateEnding} className="text-right py-2 text-[10px] text-slate-500">{r.fiscalDateEnding?.split('-')[0]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Total Assets',       key: 'totalAssets' },
                      { label: 'Current Assets',     key: 'totalCurrentAssets' },
                      { label: 'Total Liabilities',  key: 'totalLiabilities' },
                      { label: 'Current Liabilities',key: 'totalCurrentLiabilities' },
                      { label: 'Shareholders Equity',key: 'totalShareholderEquity' },
                      { label: 'Long-Term Debt',     key: 'longTermDebt' },
                    ].map(row => (
                      <tr key={row.key} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 text-slate-400 text-xs">{row.label}</td>
                        {rpts.map((r: any) => <td key={r.fiscalDateEnding} className="py-2.5 text-right text-white">{fmtB(r[row.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
            {finTab === 'Cash Flow' && (() => {
              const rpts = financials.cashflow?.annualReports?.slice(0, 3) ?? [];
              if (!rpts.length) return <p className="text-xs text-slate-500 py-4">No data</p>;
              return (
                <table className="w-full text-sm font-mono">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left py-2 text-[10px] text-slate-500 uppercase">Metric</th>
                      {rpts.map((r: any) => <th key={r.fiscalDateEnding} className="text-right py-2 text-[10px] text-slate-500">{r.fiscalDateEnding?.split('-')[0]}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Operating CF',    key: 'operatingCashflow' },
                      { label: 'Capex',           key: 'capitalExpenditures' },
                      { label: 'Free Cash Flow',  key: 'operatingCashflow' },
                      { label: 'Dividends Paid',  key: 'dividendPayout' },
                      { label: 'Net Borrowings',  key: 'proceedsFromIssuanceOfDebt' },
                    ].map(row => (
                      <tr key={row.key} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                        <td className="py-2.5 text-slate-400 text-xs">{row.label}</td>
                        {rpts.map((r: any) => <td key={r.fiscalDateEnding} className="py-2.5 text-right text-white">{fmtB(r[row.key])}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
        )}
      </Card>

      {/* Analyst Ratings */}
      <Card title="Analyst Recommendations"
        rightContent={<BarChart3 className="w-3.5 h-3.5 text-accent" />}>
        {sectionsLoading ? (
          <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : analystRatings.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-6">No analyst data available. Add a Finnhub API key to enable this section.</p>
        ) : (
          <div className="space-y-4">
            {analystRatings.slice(0, 3).map((rec: any) => {
              const total = (rec.strongBuy || 0) + (rec.buy || 0) + (rec.hold || 0) + (rec.sell || 0) + (rec.strongSell || 0);
              const bullish = ((rec.strongBuy || 0) + (rec.buy || 0)) / total * 100;
              return (
                <div key={rec.period} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-slate-400">{rec.period}</span>
                    <span className="text-xs font-semibold text-white">{total} analysts</span>
                  </div>
                  <div className="flex gap-1.5 mb-3">
                    {(['strongBuy','buy','hold','sell','strongSell'] as const).map(k => {
                      const count = rec[k] || 0;
                      const pct = total > 0 ? (count / total * 100) : 0;
                      const colors: Record<string, string> = { strongBuy: 'bg-emerald-500', buy: 'bg-accent', hold: 'bg-amber-400', sell: 'bg-red-400', strongSell: 'bg-red-600' };
                      return pct > 0 ? <div key={k} className={`h-2 rounded-full ${colors[k]}`} style={{ width: `${pct}%` }} title={`${k}: ${count}`} /> : null;
                    })}
                  </div>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {[
                      { k: 'strongBuy', label: 'Str Buy', color: 'text-emerald-400' },
                      { k: 'buy', label: 'Buy', color: 'text-accent' },
                      { k: 'hold', label: 'Hold', color: 'text-amber-400' },
                      { k: 'sell', label: 'Sell', color: 'text-red-400' },
                      { k: 'strongSell', label: 'Str Sell', color: 'text-red-600' },
                    ].map(({ k, label, color }) => (
                      <div key={k}>
                        <p className={`text-sm font-mono font-bold ${color}`}>{rec[k] || 0}</p>
                        <p className="text-[9px] text-slate-600">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Peers Comparison */}
      {(peers.length > 0 || sectionsLoading) && (
        <Card title="Peer Comparison"
          rightContent={<Users className="w-3.5 h-3.5 text-accent" />}>
          {sectionsLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Symbol','Company','Price','Mkt Cap','P/E','Beta'].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Current company row */}
                  <tr className="border-b border-white/[0.06] bg-accent/[0.04]">
                    <td className="px-3 py-2.5 font-mono font-semibold text-accent">{symbol}</td>
                    <td className="px-3 py-2.5 text-white truncate max-w-[120px]">{company?.name ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-white">{company?.price ? formatCurrency(parseFloat(String(company.price))) : '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-white">{company?.marketCap ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-white">{stats?.peRatio ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-white">{stats?.beta ?? '—'}</td>
                  </tr>
                  {peers.map(p => {
                    const d = peerStats[p];
                    const profile = d?.profile;
                    const quote = d?.quote;
                    return (
                      <tr key={p} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                        <td className="px-3 py-2.5 font-mono font-semibold text-slate-400">{p}</td>
                        <td className="px-3 py-2.5 text-slate-400 truncate max-w-[120px]">{profile?.name ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">{quote?.price ? `$${quote.price.toFixed(2)}` : '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">{profile?.marketCap ?? '—'}</td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">—</td>
                        <td className="px-3 py-2.5 font-mono text-slate-400">—</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* SEC Filings */}
      <Card title="SEC Filings"
        rightContent={<a href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=&dateb=&owner=include&count=40`} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" />View All on EDGAR</a>}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { type: '10-K', label: 'Annual Report', desc: 'Full-year financial statements and business overview' },
            { type: '10-Q', label: 'Quarterly Report', desc: 'Quarterly financial results and management discussion' },
            { type: '8-K',  label: 'Current Report', desc: 'Material events, earnings releases, management changes' },
          ].map(f => (
            <a key={f.type}
              href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=${f.type}&dateb=&owner=include&count=10`}
              target="_blank" rel="noopener noreferrer"
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-accent/20 hover:bg-accent/[0.03] transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold text-accent">{f.type}</span>
                <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-accent transition-colors" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">{f.label}</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
            </a>
          ))}
        </div>
      </Card>

      {/* News */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="card-header flex items-center gap-2">
            <Newspaper className="w-3.5 h-3.5 text-accent" />
            Recent News
          </h3>
          {news.length > 0 && <span className="text-[10px] text-slate-500 font-mono">{news.length} articles</span>}
        </div>

        {news.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {news.slice(0, 8).map((item) => (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 group block"
              >
                <div className="flex justify-between items-start gap-3 mb-2">
                  <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">{item.source}</span>
                  <span className="text-[9px] text-slate-600 font-mono shrink-0">
                    {new Date(item.datetime * 1000).toLocaleDateString()}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-accent transition-colors leading-snug mb-1.5">
                  {item.headline}
                </h4>
                {item.summary && (
                  <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{item.summary}</p>
                )}
              </a>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center">
            <p className="text-xs text-slate-600">No recent news found.</p>
          </div>
        )}
      </div>
    </div>
  );
};
