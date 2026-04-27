/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanyData, KeyStatistics } from "./companyService";
import { DCFResult } from "./dcfService";
import { CompsResult } from "./compsService";

export type EquityRating = 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';

export interface ResearchReport {
  symbol: string;
  companyName: string;
  timestamp: string;
  currentPrice: number;
  targetPrice: number;
  upside: number;
  rating: EquityRating;
  ratingReason: string;
  thesis: string[];
  risks: string[];
  valuation: {
    dcf: number | null;
    comps: number | null;
    blended: number;
    dcfWeight: number;
    compsWeight: number;
  };
  financials: {
    revenue: string;
    eps: string;
    margin: string;
    marketCap: string;
    pe: string;
    beta: string;
    range52w: string;
  };
  conclusion: string;
}

export class ReportService {
  private static instance: ReportService;

  private constructor() {}

  public static getInstance(): ReportService {
    if (!ReportService.instance) {
      ReportService.instance = new ReportService();
    }
    return ReportService.instance;
  }

  public generateInstitutionalReport(
    company: CompanyData, 
    stats: KeyStatistics, 
    dcfResult: DCFResult | null,
    compsResult: CompsResult | null
  ): ResearchReport {
    const currentPrice = typeof company.price === 'number' ? company.price : 0;
    
    const dcfValue = dcfResult?.intrinsicValue || null;
    
    // Calculate comps value as average of implied prices if available
    let compsValue: number | null = null;
    if (compsResult?.impliedValuations && compsResult.impliedValuations.length > 0) {
      const validValuations = compsResult.impliedValuations.filter(v => v.impliedPrice > 0);
      if (validValuations.length > 0) {
        compsValue = validValuations.reduce((acc, v) => acc + v.impliedPrice, 0) / validValuations.length;
      }
    }
    
    // Blended Valuation Logic (60% DCF / 40% Comps)
    let dcfWeight = 0.6;
    let compsWeight = 0.4;
    let targetPrice = currentPrice;

    if (dcfValue && compsValue) {
      targetPrice = (dcfValue * dcfWeight) + (compsValue * compsWeight);
    } else if (dcfValue) {
      targetPrice = dcfValue;
      dcfWeight = 1.0;
      compsWeight = 0.0;
    } else if (compsValue) {
      targetPrice = compsValue;
      dcfWeight = 0.0;
      compsWeight = 1.0;
    }

    const upside = currentPrice > 0 ? ((targetPrice - currentPrice) / currentPrice) * 100 : 0;

    // Rating Engine Logic
    const ratingData = this.calculateRating(upside, stats);
    const rating = ratingData.rating;
    const ratingReason = ratingData.reason;

    // Dynamic Thesis based on data
    const thesis = [
      `${company.name} maintains a dominant market position with significant competitive moats in its core business segments.`,
      `The company's ${stats.revenueGrowth || 'stable'} revenue growth profile is supported by secular tailwinds and strong customer retention.`,
      `Operating margins of ${stats.operatingMarginTTM || 'N/A'}% reflect strong pricing power and efficient cost management.`,
      `A robust balance sheet with manageable leverage provides significant financial flexibility for R&D and capital returns.`
    ];

    const risks = [
      "Intense competition from both established players and emerging disruptive technologies.",
      "Regulatory scrutiny and potential antitrust actions in key global jurisdictions.",
      "Macroeconomic headwinds impacting enterprise spending and consumer discretionary demand.",
      "Execution risk associated with ongoing digital transformation and product roadmap delivery."
    ];

    return {
      symbol: company.symbol,
      companyName: company.name,
      timestamp: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      currentPrice,
      targetPrice,
      upside,
      rating,
      ratingReason,
      thesis,
      risks,
      valuation: {
        dcf: dcfValue,
        comps: compsValue,
        blended: targetPrice,
        dcfWeight,
        compsWeight
      },
      financials: {
        revenue: stats.revenueTTM || "Data unavailable",
        eps: stats.eps?.toString() || "Data unavailable",
        margin: stats.operatingMarginTTM ? `${stats.operatingMarginTTM}%` : "Data unavailable",
        marketCap: company.marketCap || "Data unavailable",
        pe: stats.peRatio?.toString() || "Data unavailable",
        beta: stats.beta?.toString() || "Data unavailable",
        range52w: stats.fiftyTwoWeekRange || "Data unavailable"
      },
      conclusion: `We initiate coverage on ${company.name} with a ${rating} rating and a price target of $${targetPrice.toFixed(2)}. Our valuation is derived from a blended analysis of fundamental DCF (${(dcfWeight * 100).toFixed(0)}%) and relative peer multiples (${(compsWeight * 100).toFixed(0)}%), suggesting a ${upside.toFixed(1)}% ${upside >= 0 ? 'upside' : 'downside'} from current levels.`
    };
  }

  public calculateRating(upside: number, stats: KeyStatistics): { rating: EquityRating, reason: string } {
    let rating: EquityRating = 'Hold';
    let reason = '';

    const revGrowth = typeof stats.revenueGrowth === 'string' ? parseFloat(stats.revenueGrowth) : (stats.revenueGrowth || 0);
    const opMargin = typeof stats.operatingMarginTTM === 'string' ? parseFloat(stats.operatingMarginTTM) : (stats.operatingMarginTTM || 0);
    const beta = typeof stats.beta === 'number' ? stats.beta : parseFloat(stats.beta?.toString() || '1');

    if (upside > 25) {
      rating = 'Strong Buy';
      reason = `Significant valuation gap of ${upside.toFixed(1)}% identified based on our blended methodology. The market is currently underestimating the company's long-term cash flow generation potential and peer-relative valuation. `;
      if (revGrowth > 15) reason += "Robust top-line growth profile supports a premium valuation. ";
      if (opMargin > 20) reason += "Superior profitability and operating leverage provide a strong margin of safety. ";
    } else if (upside > 10) {
      rating = 'Buy';
      reason = `Attractive entry point with ${upside.toFixed(1)}% implied upside from our blended target. Fundamentals remain robust despite recent market volatility. `;
      if (beta < 1) reason += "Lower volatility profile relative to the market enhances risk-adjusted returns. ";
    } else if (upside < -25) {
      rating = 'Strong Sell';
      reason = `Material downside risk of ${Math.abs(upside).toFixed(1)}% identified. Our blended valuation suggests fundamentals are deteriorating and the current market price is unsustainable. `;
    } else if (upside < -10) {
      rating = 'Sell';
      reason = `Current valuation appears stretched with ${Math.abs(upside).toFixed(1)}% downside risk relative to our blended target. We recommend reducing exposure as the stock is trading at a significant premium. `;
    } else {
      rating = 'Hold';
      reason = `The stock is currently fairly valued based on our blended analysis of intrinsic and relative value. We see limited near-term catalysts to drive significant outperformance at current levels.`;
    }

    return { rating, reason };
  }

  public generateReport(company: CompanyData, stats: KeyStatistics): ResearchReport {
    // Legacy support or fallback
    return this.generateInstitutionalReport(company, stats, null, null);
  }
}
