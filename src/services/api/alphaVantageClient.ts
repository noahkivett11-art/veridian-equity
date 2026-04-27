/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HistoricalPoint, CompanyHistoricalSeries, MarketOverviewItem } from "./types";

const API_KEY = import.meta.env.VITE_ALPHA_VANTAGE_API_KEY;
const BASE_URL = "https://www.alphavantage.co/query";

export class AlphaVantageClient {
  private static instance: AlphaVantageClient;
  private lastRequestTime: number = 0;
  private minInterval: number = 12000; // 5 calls per minute = 12s interval

  private constructor() {}

  public static getInstance(): AlphaVantageClient {
    if (!AlphaVantageClient.instance) {
      AlphaVantageClient.instance = new AlphaVantageClient();
    }
    return AlphaVantageClient.instance;
  }

  private async fetchWithRateLimit(params: Record<string, string>): Promise<any> {
    if (!API_KEY) {
      console.warn("Alpha Vantage API Key is missing.");
      return { "Error Message": "API Key missing" };
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      console.log(`Rate limiting Alpha Vantage: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const queryParams = new URLSearchParams({ ...params, apikey: API_KEY });
    const url = `${BASE_URL}?${queryParams.toString()}`;

    try {
      this.lastRequestTime = Date.now();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data["Note"]) {
        console.warn("Alpha Vantage Rate Limit Reached:", data["Note"]);
      }
      
      return data;
    } catch (error) {
      console.error("Alpha Vantage fetch error:", error);
      return { "Error Message": String(error) };
    }
  }

  public async getHistoricalSeries(symbol: string, interval: string = "DAILY"): Promise<CompanyHistoricalSeries | null> {
    console.log(`[AlphaVantage] Fetching historical series for ${symbol} with interval ${interval}`);
    const isIntraday = interval !== "DAILY";
    const functionName = isIntraday ? "TIME_SERIES_INTRADAY" : "TIME_SERIES_DAILY";
    
    const params: Record<string, string> = {
      function: functionName,
      symbol: symbol,
      outputsize: isIntraday ? "compact" : "full" // Full for daily to support 5Y/MAX
    };

    if (isIntraday) {
      params.interval = interval;
    }

    const data = await this.fetchWithRateLimit(params);
    const timeSeriesKey = isIntraday ? `Time Series (${interval})` : "Time Series (Daily)";
    const timeSeries = data[timeSeriesKey];

    if (!timeSeries) {
      console.error(`[AlphaVantage] No time series data found for ${symbol}. Response:`, data);
      return null;
    }

    const points: HistoricalPoint[] = Object.entries(timeSeries).map(([date, values]: [string, any]) => ({
      date,
      price: parseFloat(values["4. close"])
    })).reverse();

    return {
      symbol,
      points,
      interval,
      provider: "Alpha Vantage"
    };
  }

  public async searchSymbols(query: string): Promise<Array<{ symbol: string; name: string; type: string; region: string; matchScore: number }>> {
    const data = await this.fetchWithRateLimit({ function: "SYMBOL_SEARCH", keywords: query });
    if (!data || data["Error Message"] || !data.bestMatches) return [];
    return (data.bestMatches as any[]).map((m) => ({
      symbol: m["1. symbol"],
      name: m["2. name"],
      type: m["3. type"],
      region: m["4. region"],
      matchScore: parseFloat(m["9. matchScore"] ?? "0"),
    }));
  }

  public async getIncomeStatement(symbol: string): Promise<any> {
    return this.fetchWithRateLimit({ function: 'INCOME_STATEMENT', symbol });
  }

  public async getBalanceSheet(symbol: string): Promise<any> {
    return this.fetchWithRateLimit({ function: 'BALANCE_SHEET', symbol });
  }

  public async getCashFlow(symbol: string): Promise<any> {
    return this.fetchWithRateLimit({ function: 'CASH_FLOW', symbol });
  }

  public async getMacroIndicator(symbol: string): Promise<MarketOverviewItem | null> {
    console.log(`[AlphaVantage] Fetching macro indicator for ${symbol}`);
    
    const s = symbol.toUpperCase();
    let price: number = 0;
    let change: number = 0;
    let changePercent: string = "0%";
    let assetClass: any = "macro";

    try {
      // Handle 10Y Treasury Yield specifically
      if (s === "TNX") {
        const params = {
          function: "TREASURY_YIELD",
          interval: "daily",
          maturity: "10year"
        };
        const data = await this.fetchWithRateLimit(params);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AlphaVantage] Raw Treasury Yield:`, data);
        }
        if (data && data.data && data.data.length > 0) {
          const current = data.data[0];
          const previous = data.data[1];
          price = parseFloat(current.value);
          if (previous && parseFloat(previous.value) !== 0) {
            change = price - parseFloat(previous.value);
            changePercent = `${((change / parseFloat(previous.value)) * 100).toFixed(2)}%`;
          }
          return {
            symbol,
            name: "10Y Treasury Yield",
            price,
            change,
            changePercent,
            assetClass: "macro",
            provider: "Alpha Vantage",
            lastUpdated: current.date
          };
        }
      }

      // Handle Crypto explicitly
      if (s.includes("BTC") || s.includes("ETH") || s.includes("SOL") || s.endsWith("USD")) {
        // More robust extraction of base currency (e.g., BTC/USD -> BTC, BTCUSD -> BTC)
        const fromCurrency = s.split('/')[0].replace("USD", "");
        
        const params = {
          function: "DIGITAL_CURRENCY_DAILY",
          symbol: fromCurrency || "BTC",
          market: "USD"
        };
        const data = await this.fetchWithRateLimit(params);
        if (process.env.NODE_ENV === 'development') {
          console.log(`[AlphaVantage] Raw Crypto Data for ${fromCurrency}:`, data);
        }
        const timeSeries = data["Time Series (Digital Currency Daily)"];
        if (timeSeries) {
          const dates = Object.keys(timeSeries);
          const current = timeSeries[dates[0]];
          const previous = timeSeries[dates[1]];
          
          price = parseFloat(current["4b. close (USD)"]);
          if (previous) {
            const prevClose = parseFloat(previous["4b. close (USD)"]);
            if (prevClose !== 0) {
              change = price - prevClose;
              changePercent = `${((change / prevClose) * 100).toFixed(2)}%`;
            }
          }
          
          return {
            symbol,
            name: symbol === "BTC/USD" ? "Bitcoin" : symbol,
            price,
            change,
            changePercent,
            assetClass: "crypto",
            provider: "Alpha Vantage",
            lastUpdated: dates[0]
          };
        }
      }

      // Default: Global Quote for indices/commodities (via ETFs)
      const params = {
        function: "GLOBAL_QUOTE",
        symbol: symbol
      };

      const data = await this.fetchWithRateLimit(params);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[AlphaVantage] Raw Global Quote for ${symbol}:`, data);
      }
      const quote = data["Global Quote"];

      if (!quote) {
        return null;
      }

      const p = quote["05. price"] || quote["price"];
      if (p === undefined) return null;

      return {
        symbol,
        name: symbol,
        price: parseFloat(p),
        change: parseFloat(quote["09. change"] || quote["change"] || "0"),
        changePercent: quote["10. change percent"] || quote["change_percent"] || "0%",
        assetClass: ["GLD", "USO"].includes(s) ? "commodity" : "macro",
        provider: "Alpha Vantage",
        lastUpdated: quote["07. latest trading day"] || new Date().toISOString()
      };
    } catch (error) {
      console.error(`Error in getMacroIndicator for ${symbol}:`, error);
      return null;
    }
  }
}
