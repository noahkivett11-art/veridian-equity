/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanyData, KeyStatistics } from "./companyService";
import { MarketDataService } from "./api/marketDataService";
import { parseNumber } from "../lib/utils";

export interface PeerData {
  symbol: string;
  name: string;
  sector: string;
  marketCap: string;
  marketCapValue: number;
  revenueGrowth: number | null;
  ebitdaMargin: number | null;
  peRatio: number | null;
  evEbitda: number | null;
  evRevenue: number | null;
  beta: number | null;
  return52w: number | null;
  revenueTTM: number | null;
  sharesOutstanding: number | null;
  price: number | null;
}

export interface ImpliedValuation {
  metric: string;
  peerMedian: number;
  targetFundamental: number;
  impliedEquityValue: number;
  impliedPrice: number;
  upside: number;
}

export interface CompsResult {
  target: PeerData;
  peers: PeerData[];
  averages: Partial<PeerData>;
  medians: Partial<PeerData>;
  impliedValuations: ImpliedValuation[];
}

export class CompsService {
  private static instance: CompsService;

  private constructor() {}

  public static getInstance(): CompsService {
    if (!CompsService.instance) {
      CompsService.instance = new CompsService();
    }
    return CompsService.instance;
  }

  public async fetchPeerData(symbol: string): Promise<PeerData | null> {
    const api = MarketDataService.getInstance();
    const [header, stats] = await Promise.all([
      api.getCompanyHeader(symbol),
      api.getCompanyStats(symbol)
    ]);

    if (!header || !stats) return null;

    const mktCapVal = parseNumber(header.marketCap) * (header.marketCap.includes('T') ? 1000000 : header.marketCap.includes('B') ? 1000 : 1);

    return {
      symbol: header.symbol,
      name: header.name,
      sector: header.sector,
      marketCap: header.marketCap,
      marketCapValue: mktCapVal,
      revenueGrowth: parseNumber(stats.revenueGrowth),
      ebitdaMargin: parseNumber(stats.operatingMarginTTM), // Using op margin as proxy
      peRatio: parseNumber(stats.peRatio),
      evEbitda: parseNumber(stats.evEbitda),
      evRevenue: parseNumber(stats.evRevenue),
      beta: parseNumber(stats.beta),
      return52w: parseNumber(stats.perf52w),
      revenueTTM: parseNumber(stats.revenueTTM),
      sharesOutstanding: parseNumber(stats.sharesOutstanding),
      price: parseNumber(header.price)
    };
  }

  public async fetchPeers(symbol: string): Promise<PeerData[]> {
    const api = MarketDataService.getInstance();
    const peerSymbols = await api.getPeers(symbol);
    
    // Limit to top 6 peers for performance and relevance
    const topPeers = peerSymbols.slice(0, 6);
    
    const peerData = await Promise.all(
      topPeers.map(s => this.fetchPeerData(s).catch(() => null))
    );
    
    return peerData.filter(p => p !== null) as PeerData[];
  }

  public async runComparableAnalysis(symbol: string): Promise<CompsResult | null> {
    const [targetData, peers] = await Promise.all([
      this.fetchPeerData(symbol),
      this.fetchPeers(symbol),
    ]);
    if (!targetData) return null;
    const validPeers = peers.filter(p => p.symbol !== symbol);
    return this.calculateComps(targetData, validPeers);
  }

  public calculateComps(target: PeerData, peers: PeerData[]): CompsResult {
    const metrics: (keyof PeerData)[] = ['peRatio', 'evEbitda', 'evRevenue', 'revenueGrowth', 'ebitdaMargin', 'beta', 'return52w'];
    
    const averages: any = {};
    const medians: any = {};

    metrics.forEach(metric => {
      const values = peers
        .map(p => p[metric] as number)
        .filter(v => v !== null && !isNaN(v))
        .sort((a, b) => a - b);

      if (values.length > 0) {
        averages[metric] = values.reduce((a, b) => a + b, 0) / values.length;
        
        const mid = Math.floor(values.length / 2);
        medians[metric] = values.length % 2 !== 0 
          ? values[mid] 
          : (values[mid - 1] + values[mid]) / 2;
      } else {
        averages[metric] = null;
        medians[metric] = null;
      }
    });

    const impliedValuations: ImpliedValuation[] = [];
    const shares = target.sharesOutstanding || (target.marketCapValue / (target.peRatio && target.peRatio > 0 ? (target.marketCapValue / target.peRatio) : 150));
    const currentPrice = target.marketCapValue / shares;

    // Implied P/E
    if (medians.peRatio && target.peRatio) {
      const earnings = target.marketCapValue / target.peRatio;
      const impliedEquityValue = earnings * medians.peRatio;
      const impliedPrice = impliedEquityValue / shares;
      impliedValuations.push({
        metric: 'P/E Multiple',
        peerMedian: medians.peRatio,
        targetFundamental: earnings,
        impliedEquityValue,
        impliedPrice,
        upside: ((impliedPrice - currentPrice) / currentPrice) * 100
      });
    }

    // Implied EV/EBITDA
    if (medians.evEbitda && target.evEbitda) {
      const ebitda = target.marketCapValue / target.evEbitda;
      const impliedEV = ebitda * medians.evEbitda;
      const impliedPrice = impliedEV / shares; // Simplified (assuming EV ~ Equity Value for this mock)
      impliedValuations.push({
        metric: 'EV/EBITDA',
        peerMedian: medians.evEbitda,
        targetFundamental: ebitda,
        impliedEquityValue: impliedEV,
        impliedPrice,
        upside: ((impliedPrice - currentPrice) / currentPrice) * 100
      });
    }

    // Implied EV/Revenue
    if (medians.evRevenue && target.evRevenue) {
      const revenue = target.marketCapValue / target.evRevenue;
      const impliedEV = revenue * medians.evRevenue;
      const impliedPrice = impliedEV / shares;
      impliedValuations.push({
        metric: 'EV/Revenue',
        peerMedian: medians.evRevenue,
        targetFundamental: revenue,
        impliedEquityValue: impliedEV,
        impliedPrice,
        upside: ((impliedPrice - currentPrice) / currentPrice) * 100
      });
    }

    return {
      target,
      peers,
      averages,
      medians,
      impliedValuations
    };
  }
}
