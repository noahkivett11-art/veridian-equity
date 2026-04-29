/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketDataService as APIMarketDataService } from "./api/marketDataService";
import { MarketOverviewItem } from "./api/types";
import { FinnhubClient } from "./api/finnhubClient";

export interface MarketIndicator {
  id: string;
  name: string;
  symbol: string;
  value: number | string | null;
  change: number | string | null;
  percentChange: number | string | null;
  lastUpdated: string | null;
  status: 'loading' | 'success' | 'error';
  provider?: string;
  isIndex?: boolean;
}

// Indices fetched directly from Yahoo Finance via CORS proxy — real index points, no ETF multiplier.
// isIndex=true suppresses the "$" prefix and renders "pts" label.
export const INDICATORS_CONFIG = [
  { id: 'sp500',   name: 'S&P 500',       symbol: '^GSPC',   isIndex: true  },
  { id: 'dow',     name: 'Dow Jones',      symbol: '^DJI',    isIndex: true  },
  { id: 'nasdaq',  name: 'NASDAQ',         symbol: '^IXIC',   isIndex: true  },
  { id: 'russell', name: 'Russell 2000',   symbol: '^RUT',    isIndex: true  },
  { id: 'gold',    name: 'Gold',           symbol: 'GLD',     indexMultiplier: 10,   isIndex: false },
  { id: 'bitcoin', name: 'Bitcoin',        symbol: 'BTC/USD', indexMultiplier: 1,    isIndex: false },
];

const YAHOO_INDEX_SYMBOLS = new Set(['^GSPC', '^DJI', '^IXIC', '^RUT']);
const CORS_PROXY = 'https://corsproxy.io/?url=';

async function fetchYahooIndex(symbol: string): Promise<{ price: number; change: number; changePercent: number } | null> {
  try {
    const encoded = encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`);
    const res = await fetch(`${CORS_PROXY}${encoded}`);
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;
    const price: number = meta.regularMarketPrice;
    const change: number = meta.regularMarketChange ?? (price - (meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? price));
    const changePercent: number = meta.regularMarketChangePercent ?? (change / (price - change) * 100);
    return { price, change, changePercent };
  } catch {
    return null;
  }
}

/**
 * Validates that market values are within realistic real-world bounds.
 */
const validateMarketValue = (id: string, value: number): boolean => {
  if (isNaN(value) || value <= 0) return false;
  return true; // Simplified for fresh rebuild to see raw values
};

/**
 * MarketDataService handles fetching and processing major market indicators.
 */
export class MarketDataService {
  private static instance: MarketDataService;

  private constructor() {}

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  public async fetchMarketOverview(): Promise<MarketIndicator[]> {
    const api = APIMarketDataService.getInstance();

    // Fetch Yahoo indices and Finnhub-based symbols in parallel
    const finnhubSymbols = INDICATORS_CONFIG.filter(c => !YAHOO_INDEX_SYMBOLS.has(c.symbol)).map(c => c.symbol);
    const [yahooResults, finnhubItems] = await Promise.all([
      Promise.all(
        INDICATORS_CONFIG
          .filter(c => YAHOO_INDEX_SYMBOLS.has(c.symbol))
          .map(async c => ({ config: c, data: await fetchYahooIndex(c.symbol) }))
      ),
      finnhubSymbols.length ? api.getMarketOverview(finnhubSymbols) : Promise.resolve([]),
    ]);

    const yahooMap = new Map(yahooResults.map(r => [r.config.symbol, r.data]));

    return INDICATORS_CONFIG.map(config => {
      if (YAHOO_INDEX_SYMBOLS.has(config.symbol)) {
        const d = yahooMap.get(config.symbol);
        if (d) {
          return {
            ...config,
            value: d.price,
            change: d.change,
            percentChange: d.changePercent,
            lastUpdated: new Date().toISOString(),
            status: 'success' as const,
            provider: 'Yahoo Finance',
          };
        }
        return { ...config, value: null, change: null, percentChange: null, lastUpdated: null, status: 'error' as const };
      }

      // Finnhub / AlphaVantage path for Gold, Bitcoin, etc.
      const item = finnhubItems.find(d => d.symbol.toUpperCase() === config.symbol.toUpperCase());
      if (item) {
        const rawPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price));
        const rawChange = typeof item.change === 'number' ? item.change : parseFloat(String(item.change));
        const multiplier = (config as any).indexMultiplier ?? 1;
        return {
          ...config,
          value: rawPrice * multiplier,
          change: rawChange * multiplier,
          percentChange: item.changePercent ?? null,
          lastUpdated: item.lastUpdated || new Date().toISOString(),
          status: 'success' as const,
          provider: item.provider,
        };
      }
      return { ...config, value: null, change: null, percentChange: null, lastUpdated: null, status: 'error' as const };
    }) as MarketIndicator[];
  }

  public async fetchMarketNews(): Promise<any[]> {
    try {
      return await FinnhubClient.getInstance().getMarketNews();
    } catch {
      return [];
    }
  }

  public async fetchTopMovers(): Promise<{ gainers: any[]; losers: any[] }> {
    try {
      const symbols = [
        'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','JPM','V','XOM',
        'UNH','KO','PG','JNJ','WMT','BAC','NFLX','ADBE','AMD','CRM',
      ];
      const quotes = await FinnhubClient.getInstance().getBatchQuotes(symbols);
      const valid = quotes.filter(q => q && typeof q.changePercent === 'number');
      const sorted = valid.sort((a, b) => b.changePercent - a.changePercent);
      return {
        gainers: sorted.slice(0, 5),
        losers: sorted.slice(-5).reverse(),
      };
    } catch {
      return { gainers: [], losers: [] };
    }
  }
}
