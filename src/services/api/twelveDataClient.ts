/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketOverviewItem, AssetClass } from "./types";

const API_KEY = import.meta.env.VITE_TWELVE_DATA_API_KEY;
const BASE_URL = "https://api.twelvedata.com";

export class TwelveDataClient {
  private static instance: TwelveDataClient;
  private lastRequestTime: number = 0;
  private minInterval: number = 8000; // ~8 requests per minute for free tier (usually 8-12 is safe)

  private constructor() {}

  public static getInstance(): TwelveDataClient {
    if (!TwelveDataClient.instance) {
      TwelveDataClient.instance = new TwelveDataClient();
    }
    return TwelveDataClient.instance;
  }

  private async fetchWithRateLimit(params: Record<string, string>): Promise<any> {
    if (!API_KEY) {
      // Don't warn every time if intentionally not provided, but here we expect it for fallback
      return { status: "error", message: "Twelve Data API Key missing" };
    }

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minInterval) {
      const waitTime = this.minInterval - timeSinceLastRequest;
      console.log(`[TwelveData] Rate limiting: waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    const queryParams = new URLSearchParams({ ...params, apikey: API_KEY });
    const url = `${BASE_URL}/${params.endpoint}?${queryParams.toString()}`;

    try {
      this.lastRequestTime = Date.now();
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      
      if (data.status === "error") {
        console.warn("[TwelveData] API Warning:", data.message);
      }
      
      return data;
    } catch (error) {
      console.error("[TwelveData] fetch error:", error);
      return { status: "error", message: String(error) };
    }
  }

  public async getQuote(symbol: string, assetClass: AssetClass = 'macro'): Promise<MarketOverviewItem | null> {
    console.log(`[TwelveData] Fetching quote for ${symbol}`);
    
    // Twelve Data sometimes uses different symbols for crypto or indices
    const symbolMap: Record<string, string> = {
      'TNX': 'TNX', // or ^TNX
      'VIX': 'VIX',
      'BTC/USD': 'BTC/USD'
    };

    const apiSymbol = symbolMap[symbol.toUpperCase()] || symbol;

    const params = {
      endpoint: "quote",
      symbol: apiSymbol
    };

    const data = await this.fetchWithRateLimit(params);

    if (!data || data.status === "error" || !data.close) {
      console.warn(`[TwelveData] No valid quote for ${symbol}`);
      return null;
    }

    return {
      symbol: data.symbol,
      name: data.name || symbol,
      price: parseFloat(data.close),
      change: parseFloat(data.change || "0"),
      changePercent: data.percent_change ? `${data.percent_change}%` : "0%",
      assetClass,
      provider: "Twelve Data",
      lastUpdated: data.datetime || new Date().toISOString()
    };
  }
}
