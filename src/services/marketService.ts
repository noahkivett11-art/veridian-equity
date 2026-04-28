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

// ETF prices are multiplied to derive the underlying index level.
// Multipliers supplied by user based on current market levels:
//   SPY × 10  → S&P 500   (~5,000–7,000 range)
//   DIA × 100 → Dow Jones  (~40,000–50,000 range)
//   QQQ × 37.5→ NASDAQ 100 (~20,000–25,000 range)
//   IWM × 10  → Russell 2000(~2,000–3,000 range)
// isIndex=true suppresses the "$" prefix and uses integer formatting.
export const INDICATORS_CONFIG = [
  { id: 'sp500',   name: 'S&P 500',       symbol: 'SPY',     indexMultiplier: 10,   isIndex: true  },
  { id: 'dow',     name: 'Dow Jones',      symbol: 'DIA',     indexMultiplier: 100,  isIndex: true  },
  { id: 'nasdaq',  name: 'NASDAQ 100',     symbol: 'QQQ',     indexMultiplier: 37.5, isIndex: true  },
  { id: 'russell', name: 'Russell 2000',   symbol: 'IWM',     indexMultiplier: 10,   isIndex: true  },
  { id: 'gold',    name: 'Gold',           symbol: 'GLD',     indexMultiplier: 10,   isIndex: false },
  { id: 'bitcoin', name: 'Bitcoin',        symbol: 'BTC/USD', indexMultiplier: 1,    isIndex: false },
];

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
    const symbols = INDICATORS_CONFIG.map(c => c.symbol);
    
    console.log('[REBUILD] Fetching indicators for:', symbols);

    try {
      const dataItems = await api.getMarketOverview(symbols);
      console.log('[REBUILD STAGE 1] Raw API Response:', dataItems);
      
      const mapped = INDICATORS_CONFIG.map(config => {
        const item = dataItems.find(d => d.symbol.toUpperCase() === config.symbol.toUpperCase());

        if (item) {
          const rawPrice = typeof item.price === 'number' ? item.price : parseFloat(String(item.price));
          const rawChange = typeof item.change === 'number' ? item.change : parseFloat(String(item.change));
          const multiplier = config.indexMultiplier ?? 1;

          const mappedItem = {
            ...config,
            value: rawPrice * multiplier,
            change: rawChange * multiplier,
            percentChange: item.changePercent ?? null,
            lastUpdated: item.lastUpdated || new Date().toISOString(),
            status: 'success' as const,
            provider: item.provider
          };

          console.log(`[REBUILD STAGE 2] Mapped ${config.id}:`, mappedItem);
          return mappedItem;
        }

        console.warn(`[REBUILD STAGE 2 ERROR] Item not found for ${config.id}`);

        return {
          ...config,
          value: null,
          change: null,
          percentChange: null,
          lastUpdated: null,
          status: 'error' as const
        };
      });
      return mapped as MarketIndicator[];
    } catch (error) {
      console.error('[REBUILD] Fetch Error:', error);
      return INDICATORS_CONFIG.map(config => ({
        ...config,
        value: null,
        change: null,
        percentChange: null,
        lastUpdated: null,
        status: 'error' as const
      }));
    }
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
