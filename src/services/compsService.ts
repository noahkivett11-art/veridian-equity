/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketDataService } from "./api/marketDataService";
import { FinnhubClient } from "./api/finnhubClient";
import { parseNumber } from "../lib/utils";

export interface PeerData {
  symbol: string;
  name: string;
  sector: string;
  marketCap: string;
  marketCapValue: number;    // millions USD
  netDebt: number | null;    // millions USD (positive = net debt, negative = net cash)
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
  eps: number | null;
  dividendYield: number | null;
  roe: number | null;
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
  summaryText: string;
  targetRanks: Record<string, { rank: number; total: number }>;
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
    const [header, stats, rawFin] = await Promise.all([
      api.getCompanyHeader(symbol),
      api.getCompanyStats(symbol),
      FinnhubClient.getInstance().getFinancialsReported(symbol).catch(() => null),
    ]);

    if (!header || !stats) return null;

    // Strip leading $ and commas before parseNumber so parseFloat can read it
    const mktCapRaw = header.marketCap.replace(/[$,\s]/g, '');
    const mktCapVal =
      parseNumber(mktCapRaw) *
      (mktCapRaw.includes('T') ? 1_000_000 :
       mktCapRaw.includes('B') ? 1_000 : 1);

    // Use metric API values if positive; otherwise fall back to financial statements
    let evEbitda: number | null = (() => { const v = parseNumber(stats.evEbitda); return v > 0 ? v : null; })();
    let evRevenue: number | null = (() => { const v = parseNumber(stats.evRevenue); return v > 0 ? v : null; })();

    if ((!evEbitda || !evRevenue) && rawFin?.data?.length) {
      try {
        // Take most recent annual filing (quarter===0 = annual); fall back to any record
        const annuals = rawFin.data.filter((r: any) => r.quarter === 0);
        const latest = (annuals.length > 0 ? annuals : rawFin.data)[0];
        if (latest?.report) {
          // Build lookup maps normalising both "us-gaap:Foo" and "us-gaap_Foo" forms
          const byMap = (items: any[]): Record<string, number> => {
            const m: Record<string, number> = {};
            for (const x of (items ?? [])) {
              const v = Number(x.value);
              if (isNaN(v)) continue;
              const key = String(x.concept).replace(':', '_');
              m[key] = v;
            }
            return m;
          };
          const ic = byMap(latest.report?.ic ?? []);
          const cf = byMap(latest.report?.cf ?? []);
          const bs = byMap(latest.report?.bs ?? []);

          const first = (map: Record<string, number>, ...keys: string[]) => {
            for (const k of keys) { const v = map[k]; if (v && Math.abs(v) > 0) return v; }
            return 0;
          };

          const revenue = first(ic,
            'us-gaap_RevenueFromContractWithCustomerExcludingAssessedTax',
            'us-gaap_RevenueFromContractWithCustomerIncludingAssessedTax',
            'us-gaap_Revenues',
            'us-gaap_SalesRevenueNet',
            'us-gaap_SalesRevenueGoodsNet',
          );
          const opIncome = first(ic, 'us-gaap_OperatingIncomeLoss');
          const da = first(cf,
            'us-gaap_DepreciationDepletionAndAmortization',
            'us-gaap_DepreciationAndAmortization',
            'us-gaap_Depreciation',
          );
          const ebitda = opIncome + da;

          const ltDebt = first(bs,
            'us-gaap_LongTermDebtNoncurrent',
            'us-gaap_LongTermDebtAndCapitalLeaseObligations',
            'us-gaap_LongTermDebt',
          );
          const currentDebt = first(bs,
            'us-gaap_LongTermDebtCurrent',
            'us-gaap_DebtCurrent',
            'us-gaap_ShortTermBorrowings',
          );
          const totalDebt = ltDebt + currentDebt;

          const cash = first(bs,
            'us-gaap_CashAndCashEquivalentsAtCarryingValue',
            'us-gaap_CashCashEquivalentsAndShortTermInvestments',
            'us-gaap_CashAndCashEquivalentsAndShortTermInvestments',
            'us-gaap_Cash',
          );

          // mktCapVal is in millions; XBRL values are in full dollars
          const mktCapDollars = mktCapVal * 1_000_000;
          const ev = mktCapDollars + totalDebt - cash;

          if (!evEbitda && ebitda > 0 && ev > 0) evEbitda = parseFloat((ev / ebitda).toFixed(2));
          if (!evRevenue && revenue > 0 && ev > 0) evRevenue = parseFloat((ev / revenue).toFixed(2));
        }
      } catch { /* ignore */ }
    }

    const pos = (v: number) => (v > 0 ? v : null);
    const nz  = (v: number) => (!isNaN(v) && v !== 0 ? v : null);

    return {
      symbol: header.symbol,
      name: header.name,
      sector: header.sector,
      marketCap: header.marketCap,
      marketCapValue: mktCapVal,
      netDebt:           nz(parseNumber(stats.netDebt)),
      revenueGrowth:     nz(parseNumber(stats.revenueGrowth)),
      ebitdaMargin:      nz(parseNumber(stats.operatingMarginTTM)),
      peRatio:           pos(parseNumber(stats.peRatio)),
      evEbitda,
      evRevenue,
      beta:              nz(parseNumber(stats.beta)),
      return52w:         nz(parseNumber(stats.perf52w)),
      revenueTTM:        pos(parseNumber(stats.revenueTTM)),
      sharesOutstanding: pos(parseNumber(stats.sharesOutstanding)),
      price:             pos(parseNumber(header.price)),
      eps:               nz(parseNumber(stats.eps)),
      dividendYield:     pos(parseNumber(stats.dividendYield)),
      roe:               nz(parseNumber(stats.roe)),
    };
  }

  public async fetchPeers(symbol: string): Promise<PeerData[]> {
    const api = MarketDataService.getInstance();
    const peerSymbols = await api.getPeers(symbol);
    const topPeers = peerSymbols.slice(0, 8);
    const peerData = await Promise.all(
      topPeers.map(s => this.fetchPeerData(s).catch(() => null))
    );
    return peerData.filter((p): p is PeerData => p !== null);
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
    const metrics: (keyof PeerData)[] = [
      'peRatio', 'evEbitda', 'evRevenue', 'revenueGrowth', 'ebitdaMargin', 'beta', 'return52w',
    ];

    const averages: any = {};
    const medians: any = {};

    metrics.forEach(metric => {
      const values = peers
        .map(p => p[metric] as number | null)
        .filter((v): v is number => v !== null && !isNaN(v))
        .sort((a, b) => a - b);

      if (values.length > 0) {
        averages[metric] = values.reduce((a, b) => a + b, 0) / values.length;
        const mid = Math.floor(values.length / 2);
        medians[metric] =
          values.length % 2 !== 0 ? values[mid] : (values[mid - 1] + values[mid]) / 2;
      } else {
        averages[metric] = null;
        medians[metric] = null;
      }
    });

    const currentPrice = target.price || 0;
    // sharesOutstanding is in millions; fallback derives millions from mktCap/price
    const shares =
      target.sharesOutstanding ||
      (currentPrice > 0 ? target.marketCapValue / currentPrice : 0);
    const netDebt = target.netDebt ?? 0; // millions USD (positive = debt > cash)
    // Enterprise Value in millions: market cap + net debt
    const ev = target.marketCapValue + netDebt;
    const impliedValuations: ImpliedValuation[] = [];

    // P/E: implied price = EPS × median peer P/E (no shares/EV needed)
    const effectiveEps =
      (target.eps !== null && target.eps > 0)
        ? target.eps
        : (currentPrice > 0 && target.peRatio && target.peRatio > 0)
          ? currentPrice / target.peRatio
          : null;

    if (medians.peRatio && effectiveEps && effectiveEps > 0 && currentPrice > 0) {
      const impliedPrice = effectiveEps * medians.peRatio;
      if (impliedPrice > 0 && impliedPrice < 10_000 && isFinite(impliedPrice)) {
        impliedValuations.push({
          metric: 'P/E Multiple',
          peerMedian: medians.peRatio,
          targetFundamental: effectiveEps,
          impliedEquityValue: impliedPrice * (shares || 1),
          impliedPrice,
          upside: ((impliedPrice - currentPrice) / currentPrice) * 100,
        });
      }
    }

    // EV/EBITDA — all values in millions USD
    // EBITDA (M) = EV / multiple  →  Implied EV (M) = EBITDA × peer median
    // Implied Equity (M) = Implied EV − Net Debt  →  Price = Equity (M) / shares (M)
    if (medians.evEbitda && target.evEbitda && target.evEbitda > 0 && ev > 0 && shares > 0 && currentPrice > 0) {
      const ebitda_m = ev / target.evEbitda;
      const impliedEV_m = ebitda_m * medians.evEbitda;
      const impliedEquity_m = impliedEV_m - netDebt;
      const impliedPrice = impliedEquity_m / shares;
      if (impliedPrice > 0 && impliedPrice < 10_000 && isFinite(impliedPrice)) {
        impliedValuations.push({
          metric: 'EV/EBITDA',
          peerMedian: medians.evEbitda,
          targetFundamental: ebitda_m,
          impliedEquityValue: impliedEquity_m,
          impliedPrice,
          upside: ((impliedPrice - currentPrice) / currentPrice) * 100,
        });
      }
    }

    // EV/Revenue — same pattern
    if (medians.evRevenue && target.evRevenue && target.evRevenue > 0 && ev > 0 && shares > 0 && currentPrice > 0) {
      const revenue_m = ev / target.evRevenue;
      const impliedEV_m = revenue_m * medians.evRevenue;
      const impliedEquity_m = impliedEV_m - netDebt;
      const impliedPrice = impliedEquity_m / shares;
      if (impliedPrice > 0 && impliedPrice < 10_000 && isFinite(impliedPrice)) {
        impliedValuations.push({
          metric: 'EV/Revenue',
          peerMedian: medians.evRevenue,
          targetFundamental: revenue_m,
          impliedEquityValue: impliedEquity_m,
          impliedPrice,
          upside: ((impliedPrice - currentPrice) / currentPrice) * 100,
        });
      }
    }

    // Summary sentence
    const summaryText = (() => {
      const tPE = target.peRatio;
      const mPE = medians.peRatio as number | null;
      if (!tPE || !mPE) return `${target.symbol} vs ${peers.length} comparable peers.`;
      const pct = ((tPE - mPE) / mPE) * 100;
      const dir = pct >= 0 ? 'premium' : 'discount';
      return `${target.symbol} trades at a P/E of ${tPE.toFixed(1)}x vs peer median of ${mPE.toFixed(1)}x, representing a ${Math.abs(pct).toFixed(0)}% ${dir} to peers.`;
    })();

    // Target rank vs peers (ascending: rank 1 = lowest/cheapest multiple)
    const targetRanks: Record<string, { rank: number; total: number }> = {};
    (['peRatio', 'evEbitda', 'evRevenue', 'revenueGrowth'] as const).forEach(metric => {
      const targetVal = target[metric] as number | null;
      if (targetVal === null) return;
      const peerVals = peers
        .map(p => p[metric] as number | null)
        .filter((v): v is number => v !== null);
      if (peerVals.length === 0) return;
      const all = [targetVal, ...peerVals].sort((a, b) => a - b);
      targetRanks[metric] = { rank: all.indexOf(targetVal) + 1, total: all.length };
    });

    return { target, peers, averages, medians, impliedValuations, summaryText, targetRanks };
  }
}
