/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanyHeaderData, CompanyKeyStats, APIResponse, LiveQuote } from "./types";

const API_KEY = import.meta.env.VITE_FINNHUB_API_KEY;
const BASE_URL = "https://finnhub.io/api/v1";

export class FinnhubClient {
  private static instance: FinnhubClient;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private requestQueue: Promise<void> = Promise.resolve();
  private MIN_REQUEST_INTERVAL = 25; // 25ms between requests to avoid bursts

  private constructor() {}

  public static getInstance(): FinnhubClient {
    if (!FinnhubClient.instance) {
      FinnhubClient.instance = new FinnhubClient();
    }
    return FinnhubClient.instance;
  }

  private async fetchWithKey(endpoint: string, params: Record<string, string>, _retryCount = 0, bypassCache = false): Promise<any> {
    if (!API_KEY) {
      console.warn("Finnhub API Key is missing.");
      return { error: "API Key missing" };
    }

    const queryParams = new URLSearchParams({ ...params, token: API_KEY });
    const cacheKey = `${endpoint}?${queryParams.toString()}`;

    if (!bypassCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.data;
      }
    }

    const url = `${BASE_URL}/${endpoint}?${queryParams.toString()}`;

    // All retries run inline inside a single queue slot — avoids circular promise
    // chains that occur when retries are chained to the end of a non-empty queue.
    return this.requestQueue = this.requestQueue.then(async () => {
      await new Promise(resolve => setTimeout(resolve, this.MIN_REQUEST_INTERVAL));

      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          const response = await fetch(url);

          if (response.status === 429 && attempt < 3) {
            const backoff = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
            console.warn(`[Finnhub] Rate limited (429). Retrying in ${Math.round(backoff)}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoff));
            continue;
          }

          // 4xx client errors are deterministic — retrying won't help
          if (response.status >= 400 && response.status < 500) {
            return { error: `HTTP ${response.status}` };
          }

          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

          const data = await response.json();

          if (data && !data.error) {
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
          }

          return data;
        } catch (error) {
          if (attempt < 3) {
            const backoff = Math.pow(2, attempt) * 1000;
            await new Promise(resolve => setTimeout(resolve, backoff));
            continue;
          }
          console.error("Finnhub fetch error:", error);
          return { error: String(error) };
        }
      }

      return { error: "Max retries exceeded" };
    });
  }

  public async getQuote(symbol: string): Promise<LiveQuote | null> {
    console.log(`[Finnhub] Fetching quote for ${symbol}`);
    const data = await this.fetchWithKey("quote", { symbol }, 0, true);

    if (!data || data.error || data.c === undefined) {
      console.warn(`[Finnhub] Quote data error for ${symbol}`);
      return null;
    }

    return {
      symbol,
      price: data.c,
      change: data.d || 0,
      changePercent: data.dp || 0,
      lastUpdated: new Date().toISOString()
    };
  }

  public async getCompanyProfile(symbol: string): Promise<CompanyHeaderData | null> {
    console.log(`[Finnhub] Fetching company profile for ${symbol}`);
    const profile = await this.fetchWithKey("stock/profile2", { symbol });
    const quote = await this.fetchWithKey("quote", { symbol });

    if (!profile || profile.error || !profile.name || !quote || quote.error || quote.c === undefined) {
      console.warn(`[Finnhub] Incomplete profile/quote data for ${symbol}`);
      return null;
    }

    // Market capitalization is in millions in Finnhub profile2
    const marketCapValue = profile.marketCapitalization;
    let marketCapStr = "Data unavailable";
    if (marketCapValue) {
      if (marketCapValue >= 1_000_000) {
        marketCapStr = `$${(marketCapValue / 1_000_000).toFixed(2)}T`;
      } else if (marketCapValue >= 1_000) {
        marketCapStr = `$${(marketCapValue / 1_000).toFixed(2)}B`;
      } else {
        marketCapStr = `$${marketCapValue.toFixed(0)}M`;
      }
    }

    return {
      symbol,
      name: profile.name,
      exchange: profile.exchange || "Data unavailable",
      price: quote.c,
      change: quote.d || 0,
      changePercent: quote.dp || 0,
      marketCap: marketCapStr,
      sector: profile.finnhubIndustry || "Data unavailable",
      industry: profile.finnhubIndustry || "Data unavailable",
      description: profile.description,
      provider: "Finnhub"
    };
  }

  public async searchSymbols(query: string): Promise<any[]> {
    console.log(`[Finnhub] Searching for ${query}`);
    const data = await this.fetchWithKey("search", { q: query });
    return data.result || [];
  }

  public async getCompanyNews(symbol: string): Promise<any[]> {
    console.log(`[Finnhub] Fetching news for ${symbol}`);
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    const fromDate = new Date();
    fromDate.setDate(now.getDate() - 30); // Last 30 days
    const from = fromDate.toISOString().split('T')[0];

    const data = await this.fetchWithKey("company-news", { symbol, from, to });
    return Array.isArray(data) ? data : [];
  }

  public async getBasicFinancials(symbol: string): Promise<CompanyKeyStats | null> {
    console.log(`[Finnhub] Fetching basic financials for ${symbol}`);
    const metricsData = await this.fetchWithKey("stock/metric", { symbol, metric: "all" });
    const quoteData = await this.fetchWithKey("quote", { symbol });
    const profileData = await this.fetchWithKey("stock/profile2", { symbol });

    if (!metricsData || metricsData.error || !metricsData.metric) {
      console.warn(`[Finnhub] No financial metrics found for ${symbol}`);
      return null;
    }

    const m = metricsData.metric;
    const q = quoteData || {};
    const p = profileData || {};

    const normalizeToMillions = (val: number | undefined): number | undefined => {
      if (val === undefined) return undefined;
      if (Math.abs(val) > 1000000000) {
        return val / 1000000;
      }
      return val;
    };

    const revenue = normalizeToMillions(m.revenueTTM || m.revenueAnnual);
    const netDebt = normalizeToMillions(m.netDebt);
    const capex = normalizeToMillions(m.capitalExpenditureTTM);
    const da = normalizeToMillions(m.depreciationAndAmortizationTTM);
    const shares = p.shareOutstanding;

    return {
      symbol,
      peRatio: m.peExclExtraTTM?.toFixed(2) || "Data unavailable",
      eps: m.epsExclExtraItemsTTM?.toFixed(2) || "Data unavailable",
      beta: m.beta?.toFixed(2) || "Data unavailable",
      roe: m.roeTTM?.toFixed(2) || "Data unavailable",
      revenueGrowth: m.revenueGrowthTTMYoy?.toFixed(2) || "Data unavailable",
      revenueGrowth5Y: m.revenueGrowth5Y?.toFixed(2) || "Data unavailable",
      revenueTTM: revenue?.toFixed(2) || "Data unavailable",
      operatingMarginTTM: m.operatingMarginTTM?.toFixed(2) || "Data unavailable",
      operatingMargin5Y: m.operatingMargin5Y?.toFixed(2) || "Data unavailable",
      taxRateTTM: m.taxRateTTM?.toFixed(2) || "Data unavailable",
      sharesOutstanding: shares?.toFixed(2) || "Data unavailable",
      netDebt: netDebt?.toFixed(2) || "Data unavailable",
      capexTTM: capex?.toFixed(2) || "Data unavailable",
      daTTM: da?.toFixed(2) || "Data unavailable",
      perf52w: m["52WeekPriceReturnDaily"]?.toFixed(2) || "Data unavailable",
      dividendYield: m.dividendYieldIndicatedAnnual?.toFixed(2) || "Data unavailable",
      fiftyTwoWeekHigh: m["52WeekHigh"]?.toFixed(2) || "Data unavailable",
      fiftyTwoWeekLow: m["52WeekLow"]?.toFixed(2) || "Data unavailable",
      previousClose: q.pc?.toFixed(2) || "Data unavailable",
      open: q.o?.toFixed(2) || "Data unavailable",
      dayHigh: q.h?.toFixed(2) || "Data unavailable",
      dayLow: q.l?.toFixed(2) || "Data unavailable",
      volume: q.v?.toLocaleString() || "Data unavailable",
      avgVolume: m["10DayAverageTradingVolume"]?.toFixed(0) || "Data unavailable",
      marketCap: p.marketCapitalization
        ? p.marketCapitalization >= 1_000_000
          ? `$${(p.marketCapitalization / 1_000_000).toFixed(2)}T`
          : p.marketCapitalization >= 1_000
          ? `$${(p.marketCapitalization / 1_000).toFixed(2)}B`
          : `$${p.marketCapitalization.toFixed(0)}M`
        : "Data unavailable",
      evEbitda: m.evToEbitdaTTM?.toFixed(2) || m["ev/ebitdaTTM"]?.toFixed(2) || "Data unavailable",
      evRevenue: m.evToRevenueTTM?.toFixed(2) || m["ev/revenueTTM"]?.toFixed(2) || "Data unavailable",
      provider: "Finnhub"
    };
  }

  public async getPeers(symbol: string): Promise<string[]> {
    console.log(`[Finnhub] Fetching peers for ${symbol}`);
    const data = await this.fetchWithKey("stock/peers", { symbol });
    return Array.isArray(data) ? data : [];
  }

  public async getCandles(
    symbol: string,
    resolution: string,
    from: number,
    to: number
  ): Promise<{ t: number[]; c: number[] } | null> {
    console.log(`[Finnhub] Fetching candles for ${symbol} (${resolution})`);
    const data = await this.fetchWithKey("stock/candle", {
      symbol,
      resolution,
      from: String(from),
      to: String(to),
    });
    if (!data || data.s === "no_data" || !Array.isArray(data.t)) return null;
    return { t: data.t, c: data.c };
  }

  public async getMarketNews(category = 'general'): Promise<any[]> {
    const data = await this.fetchWithKey('news', { category });
    return Array.isArray(data) ? data.slice(0, 15) : [];
  }

  public async getAnalystRecommendations(symbol: string): Promise<any[]> {
    const data = await this.fetchWithKey('stock/recommendation', { symbol });
    return Array.isArray(data) ? data.slice(0, 6) : [];
  }

  public async getBatchQuotes(symbols: string[]): Promise<any[]> {
    const results = await Promise.allSettled(symbols.map(s => this.getQuote(s)));
    return results
      .map((r, i) => r.status === 'fulfilled' && r.value ? { ...r.value, symbol: symbols[i] } : null)
      .filter(Boolean) as any[];
  }
}
