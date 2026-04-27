/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AssetClass = 'macro' | 'equity' | 'crypto' | 'commodity' | 'unknown';

export interface MarketOverviewItem {
  symbol: string;
  name: string;
  price: number | string;
  change: number | string;
  changePercent: number | string;
  assetClass: AssetClass;
  provider: string;
  lastUpdated: string;
}

export interface CompanyHeaderData {
  symbol: string;
  name: string;
  exchange: string;
  price: number | string;
  change: number | string;
  changePercent: number | string;
  marketCap: string;
  sector: string;
  industry: string;
  description?: string;
  provider: string;
}

export interface HistoricalPoint {
  date: string;
  price: number;
}

export interface CompanyHistoricalSeries {
  symbol: string;
  points: HistoricalPoint[];
  interval: string;
  provider: string;
}

export interface CompanyKeyStats {
  symbol: string;
  peRatio: string;
  eps: string;
  beta: string;
  roe: string;
  revenueGrowth: string;
  revenueGrowth5Y: string;
  revenueTTM: string;
  operatingMarginTTM: string;
  operatingMargin5Y: string;
  taxRateTTM: string;
  sharesOutstanding: string;
  netDebt: string;
  capexTTM: string;
  daTTM: string;
  perf52w: string;
  dividendYield: string;
  fiftyTwoWeekHigh: string;
  fiftyTwoWeekLow: string;
  previousClose: string;
  open: string;
  dayHigh: string;
  dayLow: string;
  volume: string;
  avgVolume: string;
  marketCap: string;
  evEbitda: string;
  evRevenue: string;
  provider: string;
}

export interface ScreenerRow {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  marketCap: number;
  peRatio: number | null;
  sector: string;
}

export interface ResearchReportInputData {
  header: CompanyHeaderData;
  stats: CompanyKeyStats;
  historical: CompanyHistoricalSeries;
}

export interface LiveQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
  stale?: boolean;
}

export interface APIResponse<T> {
  data: T | null;
  error: string | null;
  provider: string;
}
