/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LiveQuote } from "./api/types";
import { FinnhubClient } from "./api/finnhubClient";

type QuoteCallback = (quote: LiveQuote) => void;
type GlobalStatusCallback = (isRefreshing: boolean) => void;

export class LiveQuoteService {
  private static instance: LiveQuoteService;
  private watchedSymbols: Set<string> = new Set();
  private subscribers: Map<string, Set<QuoteCallback>> = new Map();
  private globalSubscribers: Set<GlobalStatusCallback> = new Set();
  private quotes: Map<string, LiveQuote> = new Map();
  private refreshInterval: number = 45000; // 45 seconds to be safe with rate limits
  private timer: any = null;
  private isRefreshing: boolean = false;

  private constructor() {}

  public static getInstance(): LiveQuoteService {
    if (!LiveQuoteService.instance) {
      LiveQuoteService.instance = new LiveQuoteService();
    }
    return LiveQuoteService.instance;
  }

  public subscribe(symbol: string, callback: QuoteCallback): () => void {
    const s = symbol.toUpperCase();
    if (!s) return () => {};

    if (!this.subscribers.has(s)) {
      this.subscribers.set(s, new Set());
    }
    this.subscribers.get(s)!.add(callback);
    this.watchedSymbols.add(s);

    // Initial fetch if no quote exists or if it's older than 1 minute
    const existing = this.quotes.get(s);
    if (!existing || (Date.now() - new Date(existing.lastUpdated).getTime() > 60000)) {
      this.fetchQuote(s);
    } else {
      callback(existing);
    }

    this.startTimer();

    return () => {
      const subs = this.subscribers.get(s);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(s);
          this.watchedSymbols.delete(s);
        }
      }
      if (this.watchedSymbols.size === 0) {
        this.stopTimer();
      }
    };
  }

  public subscribeToStatus(callback: GlobalStatusCallback): () => void {
    this.globalSubscribers.add(callback);
    callback(this.isRefreshing);
    return () => {
      this.globalSubscribers.delete(callback);
    };
  }

  private startTimer() {
    if (this.timer) return;
    this.timer = setInterval(() => this.refreshAll(), this.refreshInterval);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async fetchQuote(symbol: string) {
    try {
      const quote = await FinnhubClient.getInstance().getQuote(symbol);
      if (quote) {
        this.quotes.set(symbol, quote);
        this.notify(symbol, quote);
      }
    } catch (error) {
      console.error(`[LiveQuoteService] Error fetching ${symbol}:`, error);
      const existing = this.quotes.get(symbol);
      if (existing) {
        const staleQuote = { ...existing, stale: true };
        this.quotes.set(symbol, staleQuote);
        this.notify(symbol, staleQuote);
      }
    }
  }

  private async refreshAll() {
    if (this.isRefreshing || this.watchedSymbols.size === 0) return;
    
    this.isRefreshing = true;
    this.notifyStatus(true);
    
    const symbols = Array.from(this.watchedSymbols);
    for (const symbol of symbols) {
      // Small stagger to avoid rate limit spikes
      await new Promise(resolve => setTimeout(resolve, 250));
      await this.fetchQuote(symbol);
    }
    
    this.isRefreshing = false;
    this.notifyStatus(false);
  }

  private notify(symbol: string, quote: LiveQuote) {
    const subs = this.subscribers.get(symbol);
    if (subs) {
      subs.forEach(cb => cb(quote));
    }
  }

  private notifyStatus(isRefreshing: boolean) {
    this.globalSubscribers.forEach(cb => cb(isRefreshing));
  }
  
  public getQuote(symbol: string): LiveQuote | null {
    return this.quotes.get(symbol.toUpperCase()) || null;
  }

  public updateQuote(symbol: string, price: number, change: number = 0, changePercent: number = 0) {
    const s = symbol.toUpperCase();
    const quote: LiveQuote = {
      symbol: s,
      price,
      change,
      changePercent,
      lastUpdated: new Date().toISOString()
    };
    this.quotes.set(s, quote);
    this.notify(s, quote);
  }
}
