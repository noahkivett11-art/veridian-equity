import React, { useState, useEffect, useRef } from "react";
import { LayoutDashboard, Clock, AlertCircle, Plus, X, Newspaper, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card, PageHeader, Skeleton, ChangeBadge } from "../shared";
import { MarketDataService, MarketIndicator, INDICATORS_CONFIG } from "../../services/marketService";
import { MarketDataService as APIMarketDataService } from "../../services/api/marketDataService";
import { FixedIncomeService } from "../../services/fixedIncomeService";
import { formatNumber, parseNumber } from "../../lib/utils";

const STORAGE_KEY = 'veridian_custom_tickers';

const TREASURY_MATURITIES = ['2Y', '5Y', '10Y', '30Y'];

const fetchCustomIndicator = async (symbol: string): Promise<MarketIndicator> => {
  try {
    const items = await APIMarketDataService.getInstance().getMarketOverview([symbol]);
    const item = items[0];
    if (item) {
      const price = typeof item.price === 'number' ? item.price : parseFloat(String(item.price));
      if (!isNaN(price) && price > 0) {
        return {
          id: symbol, name: item.name || symbol, symbol,
          value: price,
          change: typeof item.change === 'number' ? item.change : parseFloat(String(item.change)),
          percentChange: item.changePercent,
          lastUpdated: item.lastUpdated,
          status: 'success',
          provider: item.provider,
        };
      }
    }
  } catch {}
  return {
    id: symbol, name: symbol, symbol,
    value: null, change: null, percentChange: null, lastUpdated: null,
    status: 'error',
  };
};

export const MarketOverviewModule: React.FC = () => {
  const [indicators, setIndicators] = useState<MarketIndicator[]>(
    INDICATORS_CONFIG.map((config) => ({ ...config, value: null, change: null, percentChange: null, lastUpdated: null, status: "loading" as const }))
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [customTickers, setCustomTickers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [customIndicators, setCustomIndicators] = useState<MarketIndicator[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Treasury yields (static from service)
  const yieldCurve = FixedIncomeService.getInstance().getTreasuryYieldCurve();
  const treasuryYields = TREASURY_MATURITIES.map(m => yieldCurve.find(p => p.maturity === m)).filter(Boolean) as typeof yieldCurve;
  const y2 = treasuryYields.find(p => p.maturity === '2Y')?.yield ?? null;
  const y10 = treasuryYields.find(p => p.maturity === '10Y')?.yield ?? null;
  const spread = y2 !== null && y10 !== null ? parseFloat((y10 - y2).toFixed(2)) : null;

  // VIX (static representative value)
  const [vix] = useState({ value: 18.43, change: -0.82, pct: -4.26 });

  // Market news
  const [news, setNews] = useState<any[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  // Top movers
  const [gainers, setGainers] = useState<any[]>([]);
  const [losers, setLosers] = useState<any[]>([]);
  const [moversLoading, setMoversLoading] = useState(true);

  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const data = await MarketDataService.getInstance().fetchMarketOverview();
        setIndicators(data);
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (error) {
        console.error("Market fetch error:", error);
      }
    };
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    MarketDataService.getInstance().fetchMarketNews().then(data => {
      setNews(data.slice(0, 10));
      setNewsLoading(false);
    });
  }, []);

  useEffect(() => {
    MarketDataService.getInstance().fetchTopMovers().then(({ gainers: g, losers: l }) => {
      setGainers(g);
      setLosers(l);
      setMoversLoading(false);
    });
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customTickers));
    if (customTickers.length === 0) { setCustomIndicators([]); return; }
    setCustomIndicators(prev => {
      const prevMap = new Map(prev.map(i => [i.id, i]));
      return customTickers.map(sym => prevMap.get(sym) ?? {
        id: sym, name: sym, symbol: sym,
        value: null, change: null, percentChange: null, lastUpdated: null, status: 'loading' as const,
      });
    });
    let active = true;
    const fetchAll = async () => {
      const results = await Promise.all(customTickers.map(fetchCustomIndicator));
      if (active) setCustomIndicators(results);
    };
    fetchAll();
    const interval = setInterval(fetchAll, 60000);
    return () => { active = false; clearInterval(interval); };
  }, [customTickers]);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  const handleAdd = () => {
    const sym = inputValue.trim().toUpperCase();
    if (!sym) return;
    if (customTickers.includes(sym)) { setInputError(`${sym} is already added`); return; }
    setCustomTickers(prev => [...prev, sym]);
    setInputValue(''); setShowInput(false); setInputError('');
  };
  const handleRemove = (symbol: string) => setCustomTickers(prev => prev.filter(s => s !== symbol));
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') { setShowInput(false); setInputValue(''); setInputError(''); }
  };

  const renderCardBody = (ind: MarketIndicator) => {
    if (ind.status === "loading") return (
      <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-4 w-1/2" /></div>
    );
    if (ind.status === "error" || ind.value === null) return (
      <div className="flex flex-col items-center justify-center h-20 text-slate-500">
        <AlertCircle className="w-5 h-5 mb-2 text-danger/50" /><span className="text-xs">Unavailable</span>
      </div>
    );
    const isIndex = ind.isIndex ?? false;
    const valueDecimals = isIndex ? 2 : 2;
    const changeDecimals = isIndex ? 2 : 2;
    return (
      <div className="space-y-3">
        <div className="text-2xl font-mono font-bold text-white tracking-tighter">
          {!isIndex && <span className="text-slate-500 text-sm mr-0.5">$</span>}
          {formatNumber(ind.value, { minimumFractionDigits: valueDecimals, maximumFractionDigits: valueDecimals })}
          {isIndex && <span className="text-slate-500 text-sm ml-1">pts</span>}
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
          <span className={`text-xs font-mono font-semibold ${parseNumber(ind.change) >= 0 ? "positive" : "negative"}`}>
            {parseNumber(ind.change) >= 0 ? "+" : ""}
            {formatNumber(ind.change, { minimumFractionDigits: changeDecimals, maximumFractionDigits: changeDecimals })}
          </span>
          <ChangeBadge value={parseNumber(ind.percentChange)} />
        </div>
        {ind.lastUpdated && (
          <div className="flex items-center gap-1 text-[10px] text-slate-600 font-mono">
            <Clock className="w-3 h-3" />{new Date(ind.lastUpdated).toLocaleTimeString()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Market Overview"
        subtitle="Live market indices and asset prices"
        icon={<LayoutDashboard className="w-5 h-5" />}
        rightContent={
          <div className="flex items-center gap-3">
            {lastUpdated && <div className="badge-live">Live · {lastUpdated}</div>}
            <button
              onClick={() => { setShowInput(v => !v); setInputError(''); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />Add Ticker
            </button>
          </div>
        }
      />

      {showInput && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <input ref={inputRef} value={inputValue}
            onChange={e => { setInputValue(e.target.value.toUpperCase()); setInputError(''); }}
            onKeyDown={handleKeyDown} placeholder="Ticker symbol, e.g. AAPL"
            className="flex-1 bg-transparent text-sm font-mono text-white placeholder-slate-600 outline-none" maxLength={10} />
          {inputError && <span className="text-xs text-danger shrink-0">{inputError}</span>}
          <button onClick={handleAdd} disabled={!inputValue.trim()} className="px-3 py-1.5 rounded-lg bg-accent text-white text-xs font-semibold disabled:opacity-40 hover:bg-accent/80 transition-colors shrink-0">Add</button>
          <button onClick={() => { setShowInput(false); setInputValue(''); setInputError(''); }} className="text-slate-500 hover:text-slate-300 transition-colors shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Indicators Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {indicators.map((ind) => (
          <Card key={ind.id} title={ind.name}>{renderCardBody(ind)}</Card>
        ))}
        {customIndicators.map((ind) => (
          <Card key={ind.id} title={ind.name !== ind.symbol ? ind.name : ind.symbol}
            rightContent={
              <button onClick={() => handleRemove(ind.symbol)} className="text-slate-600 hover:text-danger transition-colors -mr-1" title={`Remove ${ind.symbol}`}>
                <X className="w-3.5 h-3.5" />
              </button>
            }>
            {renderCardBody(ind)}
          </Card>
        ))}
      </div>

      {/* Treasury Yields Row */}
      <div>
        <h3 className="card-header mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-accent" />U.S. Treasury Yields
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {treasuryYields.map(p => (
            <div key={p.maturity} className="card p-4 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">{p.maturity} Yield</p>
              <p className="text-xl font-mono font-bold text-white">{p.yield.toFixed(2)}%</p>
            </div>
          ))}
          {spread !== null && (
            <div className="card p-4 text-center border-info/20">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">10Y–2Y Spread</p>
              <p className={`text-xl font-mono font-bold ${spread >= 0 ? 'text-accent' : 'text-danger'}`}>
                {spread >= 0 ? '+' : ''}{spread.toFixed(2)}%
              </p>
            </div>
          )}
        </div>
      </div>

      {/* VIX */}
      <div>
        <h3 className="card-header mb-3 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-warning" />Volatility Index
        </h3>
        <div className="card p-5 max-w-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-wider">CBOE VIX</span>
            <span className="text-[10px] font-mono text-slate-600">Fear Gauge</span>
          </div>
          <div className="text-3xl font-mono font-bold text-white mb-1">{vix.value.toFixed(2)}</div>
          <div className="flex items-center gap-3 pt-2 border-t border-white/[0.04]">
            <span className={`text-xs font-mono font-semibold ${vix.change >= 0 ? 'positive' : 'negative'}`}>
              {vix.change >= 0 ? '+' : ''}{vix.change.toFixed(2)}
            </span>
            <ChangeBadge value={vix.pct} />
            <span className="ml-auto text-[10px] text-slate-600 font-mono">
              {vix.value < 15 ? 'Low Volatility' : vix.value < 25 ? 'Normal' : vix.value < 35 ? 'Elevated' : 'Extreme Fear'}
            </span>
          </div>
        </div>
      </div>

      {/* Top Gainers / Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Top Gainers"
          rightContent={<TrendingUp className="w-3.5 h-3.5 text-accent" />}>
          {moversLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : gainers.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No data available</p>
          ) : (
            <div className="space-y-0">
              {gainers.map((q, i) => (
                <div key={q.symbol} className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-600 font-mono w-4">{i + 1}</span>
                    <span className="text-sm font-mono font-semibold text-accent">{q.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-white">${q.price?.toFixed(2) ?? '—'}</span>
                    <ChangeBadge value={q.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top Losers"
          rightContent={<TrendingDown className="w-3.5 h-3.5 text-danger" />}>
          {moversLoading ? (
            <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : losers.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-6">No data available</p>
          ) : (
            <div className="space-y-0">
              {losers.map((q, i) => (
                <div key={q.symbol} className="flex items-center justify-between py-2.5 border-b border-white/[0.03] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-slate-600 font-mono w-4">{i + 1}</span>
                    <span className="text-sm font-mono font-semibold text-accent">{q.symbol}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono text-white">${q.price?.toFixed(2) ?? '—'}</span>
                    <ChangeBadge value={q.changePercent} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Market News Feed */}
      <div>
        <h3 className="card-header mb-4 flex items-center gap-2">
          <Newspaper className="w-3.5 h-3.5 text-accent" />Market News
        </h3>
        {newsLoading ? (
          <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}</div>
        ) : news.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-xs text-slate-600">No news available. Add a Finnhub API key to enable the news feed.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {news.map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="card p-4 group block hover:border-white/10 transition-all">
                <div className="flex justify-between items-start gap-3 mb-2">
                  <span className="text-[10px] font-semibold text-accent uppercase tracking-wider truncate">{item.source || 'News'}</span>
                  <span className="text-[9px] text-slate-600 font-mono shrink-0">
                    {item.datetime ? new Date(item.datetime * 1000).toLocaleDateString() : ''}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-white group-hover:text-accent transition-colors leading-snug line-clamp-2">
                  {item.headline}
                </h4>
                {item.summary && (
                  <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed mt-1">{item.summary}</p>
                )}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
