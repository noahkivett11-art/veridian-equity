/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  AssetClass, 
  MarketOverviewItem, 
  CompanyHeaderData, 
  CompanyHistoricalSeries, 
  CompanyKeyStats,
  ResearchReportInputData
} from "./types";
import { AlphaVantageClient } from "./alphaVantageClient";
import { FinnhubClient } from "./finnhubClient";
import { TwelveDataClient } from "./twelveDataClient";

export class MarketDataService {
  private static instance: MarketDataService;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_TTL = 1000 * 60 * 5; // 5 minutes cache

  private constructor() {}

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  private classifyAsset(symbol: string): AssetClass {
    const s = symbol.toUpperCase();
    
    // Macro/Indices
    if (["SPY", "QQQ", "DIA", "IWM", "VIX", "TNX", "DXY"].includes(s)) return 'macro';
    
    // Crypto
    if (s.includes("BTC") || s.includes("ETH") || s.includes("SOL") || s.endsWith("USD")) return 'crypto';
    
    // Commodities (usually ETFs or specific AV functions)
    if (["GLD", "SLV", "USO", "UNG", "WTI", "GOLD"].includes(s)) return 'commodity';
    
    // Equity (Default for standard tickers)
    if (/^[A-Z]{1,5}$/.test(s)) return 'equity';
    
    return 'unknown';
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log(`[Cache] Hit for ${key}`);
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  public async getMarketOverview(symbols: string[]): Promise<MarketOverviewItem[]> {
    const fetchOne = async (symbol: string): Promise<MarketOverviewItem | null> => {
      const assetClass = this.classifyAsset(symbol);
      if (assetClass === 'unknown') return null;

      const cacheKey = `market_overview_${symbol}`;
      const cached = this.getFromCache<MarketOverviewItem>(cacheKey);
      if (cached) return cached;

      try {
        let data: MarketOverviewItem | null = null;
        if (assetClass === 'macro' || assetClass === 'commodity' || assetClass === 'crypto') {
          data = await AlphaVantageClient.getInstance().getMacroIndicator(symbol);
          if (!data || !data.price || data.price === 0) {
            data = await TwelveDataClient.getInstance().getQuote(symbol, assetClass);
          }
        } else {
          const profile = await FinnhubClient.getInstance().getCompanyProfile(symbol);
          if (profile) {
            data = {
              symbol: profile.symbol,
              name: profile.name,
              price: profile.price,
              change: profile.change,
              changePercent: profile.changePercent,
              assetClass: 'equity',
              provider: profile.provider,
              lastUpdated: new Date().toISOString()
            };
          }
        }
        if (data) this.setCache(cacheKey, data);
        return data;
      } catch (error) {
        console.error(`Error fetching overview for ${symbol}:`, error);
        return null;
      }
    };

    const settled = await Promise.all(symbols.map(fetchOne));
    return settled.filter((d): d is MarketOverviewItem => d !== null);
  }

  public async getCompanyHeader(symbol: string): Promise<CompanyHeaderData | null> {
    const assetClass = this.classifyAsset(symbol);
    if (assetClass !== 'equity') {
      console.warn(`[Routing] Symbol ${symbol} is not classified as equity. Skipping company profile.`);
      return null;
    }

    const cacheKey = `company_header_${symbol}`;
    const cached = this.getFromCache<CompanyHeaderData>(cacheKey);
    if (cached) return cached;

    const data = await FinnhubClient.getInstance().getCompanyProfile(symbol);
    if (data) this.setCache(cacheKey, data);
    return data;
  }

  public async getCompanyStats(symbol: string): Promise<CompanyKeyStats | null> {
    const assetClass = this.classifyAsset(symbol);
    if (assetClass !== 'equity') return null;

    const cacheKey = `company_stats_${symbol}`;
    const cached = this.getFromCache<CompanyKeyStats>(cacheKey);
    if (cached) return cached;

    const data = await FinnhubClient.getInstance().getBasicFinancials(symbol);
    if (data) this.setCache(cacheKey, data);
    return data;
  }

  public async getHistoricalSeries(symbol: string, interval: string = "DAILY"): Promise<CompanyHistoricalSeries | null> {
    const assetClass = this.classifyAsset(symbol);
    if (assetClass === 'unknown') return null;

    const cacheKey = `historical_${symbol}_${interval}`;
    const cached = this.getFromCache<CompanyHistoricalSeries>(cacheKey);
    if (cached) return cached;

    const data = await AlphaVantageClient.getInstance().getHistoricalSeries(symbol, interval);
    if (data) this.setCache(cacheKey, data);
    return data;
  }

  public async getResearchReportData(symbol: string): Promise<ResearchReportInputData | null> {
    const [header, stats, historical] = await Promise.all([
      this.getCompanyHeader(symbol),
      this.getCompanyStats(symbol),
      this.getHistoricalSeries(symbol)
    ]);

    if (!header || !stats || !historical) return null;

    return { header, stats, historical };
  }

  public async getPeers(symbol: string): Promise<string[]> {
    const assetClass = this.classifyAsset(symbol);
    if (assetClass !== 'equity') return [];

    const cacheKey = `peers_${symbol}`;
    const cached = this.getFromCache<string[]>(cacheKey);
    if (cached) return cached;

    const data = await FinnhubClient.getInstance().getPeers(symbol);
    if (data) this.setCache(cacheKey, data);
    return data;
  }
}
