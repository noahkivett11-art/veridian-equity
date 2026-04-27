/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketDataService } from "./api/marketDataService";
import { CompanyKeyStats, CompanyHeaderData } from "./api/types";

export interface ScreenerFilters {
  marketCapMin: number | null;
  marketCapMax: number | null;
  peMin: number | null;
  peMax: number | null;
  sector: string;
  perfMin: number | null;
  perfMax: number | null;
  revGrowthMin: number | null;
  revGrowthMax: number | null;
  roeMin: number | null;
  roeMax: number | null;
  betaMin: number | null;
  betaMax: number | null;
}

export interface ScreenerResult {
  symbol: string;
  name: string;
  price: number | null;
  marketCap: number | null; // in billions
  pe: number | null;
  revGrowth: number | null; // percentage
  roe: number | null; // percentage
  beta: number | null;
  perf52w: number | null; // percentage
  sector: string;
}

const TICKER_UNIVERSE = [
  'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN',
  'META', 'TSLA', 'BRK.B', 'JPM', 'V',
  'UNH', 'LLY', 'XOM', 'CVX', 'PG',
  'COST', 'HD', 'WMT', 'KO', 'PEP',
  'ABBV', 'BAC', 'ADBE', 'CRM', 'AVGO',
  'ORCL', 'ACN', 'NFLX', 'DIS', 'TMO'
];

const STATIC_FALLBACK: Record<string, ScreenerResult> = {
  AAPL:  { symbol: 'AAPL',  name: 'Apple Inc.',               price: 189.50,  marketCap: 2924, pe: 29.4, revGrowth:  7.8, roe: 147.9, beta: 1.24, perf52w:  18.5, sector: 'Technology' },
  MSFT:  { symbol: 'MSFT',  name: 'Microsoft Corp.',          price: 415.20,  marketCap: 3082, pe: 35.2, revGrowth: 15.2, roe:  38.6, beta: 0.90, perf52w:  22.1, sector: 'Technology' },
  NVDA:  { symbol: 'NVDA',  name: 'NVIDIA Corp.',             price: 875.40,  marketCap: 2163, pe: 68.3, revGrowth: 122.4, roe: 91.5, beta: 1.66, perf52w: 201.8, sector: 'Technology' },
  GOOGL: { symbol: 'GOOGL', name: 'Alphabet Inc.',            price: 177.30,  marketCap: 2208, pe: 26.1, revGrowth: 13.5, roe:  28.0, beta: 1.05, perf52w:  38.2, sector: 'Technology' },
  AMZN:  { symbol: 'AMZN',  name: 'Amazon.com Inc.',         price: 193.60,  marketCap: 2016, pe: 53.8, revGrowth: 12.5, roe:  20.2, beta: 1.42, perf52w:  55.3, sector: 'Consumer Discretionary' },
  META:  { symbol: 'META',  name: 'Meta Platforms Inc.',      price: 527.80,  marketCap: 1346, pe: 27.2, revGrowth: 24.7, roe:  36.8, beta: 1.22, perf52w:  72.6, sector: 'Communication Services' },
  TSLA:  { symbol: 'TSLA',  name: 'Tesla Inc.',               price: 175.20,  marketCap:  558, pe: 48.6, revGrowth:  1.0, roe:  17.9, beta: 2.31, perf52w: -22.0, sector: 'Consumer Discretionary' },
  'BRK.B': { symbol: 'BRK.B', name: 'Berkshire Hathaway B', price: 407.50,  marketCap:  889, pe: 22.4, revGrowth:  5.8, roe:  14.2, beta: 0.88, perf52w:  25.8, sector: 'Financials' },
  JPM:   { symbol: 'JPM',   name: 'JPMorgan Chase & Co.',    price: 209.40,  marketCap:  605, pe: 12.3, revGrowth: 22.1, roe:  17.1, beta: 1.10, perf52w:  47.3, sector: 'Financials' },
  V:     { symbol: 'V',     name: 'Visa Inc.',                price: 281.90,  marketCap:  583, pe: 29.0, revGrowth:  9.6, roe:  53.0, beta: 0.93, perf52w:  17.6, sector: 'Financials' },
  UNH:   { symbol: 'UNH',   name: 'UnitedHealth Group',      price: 502.30,  marketCap:  464, pe: 22.3, revGrowth:  8.8, roe:  27.5, beta: 0.53, perf52w:  -4.7, sector: 'Healthcare' },
  LLY:   { symbol: 'LLY',   name: 'Eli Lilly & Co.',         price: 776.20,  marketCap:  739, pe: 62.4, revGrowth: 36.0, roe: 100.4, beta: 0.44, perf52w:  46.5, sector: 'Healthcare' },
  XOM:   { symbol: 'XOM',   name: 'Exxon Mobil Corp.',       price: 108.50,  marketCap:  434, pe: 14.1, revGrowth: -4.5, roe:  15.4, beta: 0.82, perf52w:   8.9, sector: 'Energy' },
  CVX:   { symbol: 'CVX',   name: 'Chevron Corp.',           price:  151.70, marketCap:  290, pe: 13.5, revGrowth: -8.2, roe:  11.7, beta: 0.86, perf52w:   2.3, sector: 'Energy' },
  PG:    { symbol: 'PG',    name: 'Procter & Gamble Co.',    price: 164.80,  marketCap:  388, pe: 26.9, revGrowth:  4.0, roe:  31.8, beta: 0.53, perf52w:  10.2, sector: 'Consumer Staples' },
  COST:  { symbol: 'COST',  name: 'Costco Wholesale Corp.',  price: 887.30,  marketCap:  393, pe: 53.1, revGrowth:  6.0, roe:  33.2, beta: 0.79, perf52w:  43.5, sector: 'Consumer Staples' },
  HD:    { symbol: 'HD',    name: 'Home Depot Inc.',         price: 371.20,  marketCap:  369, pe: 24.5, revGrowth: -3.3, roe: 999.0, beta: 1.02, perf52w:  12.8, sector: 'Consumer Discretionary' },
  WMT:   { symbol: 'WMT',   name: 'Walmart Inc.',            price:  69.40,  marketCap:  558, pe: 34.7, revGrowth:  5.1, roe:  19.6, beta: 0.55, perf52w:  67.8, sector: 'Consumer Staples' },
  KO:    { symbol: 'KO',    name: 'Coca-Cola Co.',           price:  60.80,  marketCap:  262, pe: 24.6, revGrowth:  3.1, roe:  42.5, beta: 0.58, perf52w:   6.4, sector: 'Consumer Staples' },
  PEP:   { symbol: 'PEP',   name: 'PepsiCo Inc.',            price: 161.90,  marketCap:  222, pe: 23.2, revGrowth:  2.3, roe:  48.9, beta: 0.60, perf52w:  -4.1, sector: 'Consumer Staples' },
  ABBV:  { symbol: 'ABBV',  name: 'AbbVie Inc.',             price: 175.30,  marketCap:  310, pe: 55.4, revGrowth: 14.0, roe:  87.2, beta: 0.63, perf52w:  25.2, sector: 'Healthcare' },
  BAC:   { symbol: 'BAC',   name: 'Bank of America Corp.',   price:  39.50,  marketCap:  310, pe: 13.5, revGrowth:  6.7, roe:  10.2, beta: 1.28, perf52w:  26.0, sector: 'Financials' },
  ADBE:  { symbol: 'ADBE',  name: 'Adobe Inc.',              price: 487.60,  marketCap:  214, pe: 47.2, revGrowth: 10.6, roe:  36.0, beta: 1.38, perf52w:   0.3, sector: 'Technology' },
  CRM:   { symbol: 'CRM',   name: 'Salesforce Inc.',         price: 287.20,  marketCap:  277, pe: 45.5, revGrowth: 11.3, roe:  10.5, beta: 1.30, perf52w:   4.1, sector: 'Technology' },
  AVGO:  { symbol: 'AVGO',  name: 'Broadcom Inc.',           price: 163.40,  marketCap:  763, pe: 34.5, revGrowth: 51.2, roe:  46.8, beta: 1.19, perf52w:  44.7, sector: 'Technology' },
  ORCL:  { symbol: 'ORCL',  name: 'Oracle Corp.',            price: 134.30,  marketCap:  370, pe: 33.2, revGrowth: 17.0, roe: 999.0, beta: 0.98, perf52w:  13.6, sector: 'Technology' },
  ACN:   { symbol: 'ACN',   name: 'Accenture PLC',           price: 305.10,  marketCap:  192, pe: 26.3, revGrowth:  1.2, roe:  32.4, beta: 1.12, perf52w: -13.5, sector: 'Technology' },
  NFLX:  { symbol: 'NFLX',  name: 'Netflix Inc.',            price: 710.50,  marketCap:  303, pe: 50.6, revGrowth: 15.0, roe:  36.8, beta: 1.28, perf52w:  89.1, sector: 'Communication Services' },
  DIS:   { symbol: 'DIS',   name: 'Walt Disney Co.',         price:  97.20,  marketCap:  178, pe: 72.5, revGrowth:  3.0, roe:   4.3, beta: 1.44, perf52w:   7.3, sector: 'Communication Services' },
  TMO:   { symbol: 'TMO',   name: 'Thermo Fisher Scientific', price: 513.80, marketCap:  197, pe: 32.7, revGrowth: -5.2, roe:  14.9, beta: 0.69, perf52w: -13.8, sector: 'Healthcare' },
};

export class ScreenerService {
  private static instance: ScreenerService;
  private cachedResults: ScreenerResult[] | null = null;
  private lastFetch: number = 0;
  private CACHE_DURATION = 1000 * 60 * 10; // 10 minutes

  private constructor() {}

  public static getInstance(): ScreenerService {
    if (!ScreenerService.instance) {
      ScreenerService.instance = new ScreenerService();
    }
    return ScreenerService.instance;
  }

  private async fetchUniverseData(): Promise<ScreenerResult[]> {
    if (this.cachedResults && (Date.now() - this.lastFetch < this.CACHE_DURATION)) {
      return this.cachedResults;
    }

    // Return static baseline immediately so the screener never shows empty
    const baseline: ScreenerResult[] = TICKER_UNIVERSE
      .map((sym) => STATIC_FALLBACK[sym])
      .filter((r): r is ScreenerResult => r !== undefined);

    // Enrich with live data in the background; update cache when done
    console.log("[Screener] Enriching with live data...");
    this.enrichWithLiveData(baseline).then((enriched) => {
      this.cachedResults = enriched;
      this.lastFetch = Date.now();
    });

    // Set cache to baseline now so subsequent calls within 10 min get it
    this.cachedResults = baseline;
    this.lastFetch = Date.now();
    return baseline;
  }

  private async enrichWithLiveData(baseline: ScreenerResult[]): Promise<ScreenerResult[]> {
    const api = MarketDataService.getInstance();
    const results: ScreenerResult[] = [...baseline];

    const parse = (val: string | number | null) => {
      if (val === null || val === "Data unavailable") return null;
      if (typeof val === 'number') return val;
      const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    };

    const chunkSize = 3;
    for (let i = 0; i < TICKER_UNIVERSE.length; i += chunkSize) {
      const chunk = TICKER_UNIVERSE.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (symbol) => {
        try {
          const [header, stats] = await Promise.all([
            api.getCompanyHeader(symbol),
            api.getCompanyStats(symbol),
          ]);
          if (!header || !stats) return;

          let mCap = parse(header.marketCap);
          if (mCap !== null && header.marketCap.includes('T')) mCap *= 1000;

          const live: ScreenerResult = {
            symbol: header.symbol,
            name: header.name,
            price: typeof header.price === 'number' ? header.price : parse(header.price),
            marketCap: mCap,
            pe: parse(stats.peRatio),
            revGrowth: parse(stats.revenueGrowth),
            roe: parse(stats.roe),
            beta: parse(stats.beta),
            perf52w: parse(stats.perf52w),
            sector: header.sector,
          };

          const idx = results.findIndex((r) => r.symbol === symbol);
          if (idx >= 0) results[idx] = live;
        } catch {
          // keep static fallback for this symbol
        }
      }));

      if (i + chunkSize < TICKER_UNIVERSE.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    return results;
  }

  public async runScreen(filters: ScreenerFilters): Promise<ScreenerResult[]> {
    const universe = await this.fetchUniverseData();

    return universe.filter(stock => {
      if (filters.sector !== 'All' && stock.sector !== filters.sector) return false;
      
      const checkRange = (val: number | null, min: number | null, max: number | null) => {
        if (min === null && max === null) return true;
        if (val === null) return false;
        if (min !== null && val < min) return false;
        if (max !== null && val > max) return false;
        return true;
      };

      if (!checkRange(stock.marketCap, filters.marketCapMin, filters.marketCapMax)) return false;
      if (!checkRange(stock.pe, filters.peMin, filters.peMax)) return false;
      if (!checkRange(stock.perf52w, filters.perfMin, filters.perfMax)) return false;
      if (!checkRange(stock.revGrowth, filters.revGrowthMin, filters.revGrowthMax)) return false;
      if (!checkRange(stock.roe, filters.roeMin, filters.roeMax)) return false;
      if (!checkRange(stock.beta, filters.betaMin, filters.betaMax)) return false;
      
      return true;
    });
  }

  public async getSectors(): Promise<string[]> {
    const fallback = Object.values(STATIC_FALLBACK);
    const sectors = new Set(fallback.map((s) => s.sector));
    return ['All', ...Array.from(sectors).sort()];
  }
}
