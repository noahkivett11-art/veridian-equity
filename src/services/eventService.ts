/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { FinnhubClient } from "./api/finnhubClient";

export interface EarningsResult {
  quarter: string;
  date: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprise: number | null;
  surprisePercent: number | null;
  revenueActual: number | null;
  revenueEstimate: number | null;
  priceReaction: number | null; // % move after earnings
}

export interface CatalystEvent {
  id: string;
  date: string;
  title: string;
  type: 'Earnings' | 'Dividend' | 'Product' | 'Macro' | 'Conference' | 'Legal';
  impact: 'High' | 'Medium' | 'Low';
  description: string;
}

export interface EventImpactSummary {
  recentCatalyst: string;
  marketReaction: string;
  riskLevel: 'High' | 'Moderate' | 'Low';
  upcomingSignificance: string;
  volatilityContext: string;
}

export class EventService {
  private static instance: EventService;

  private constructor() {}

  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  /**
   * Fetches earnings history and upcoming dates.
   * Note: In a real app, this would hit multiple Finnhub endpoints.
   */
  public async fetchEarningsData(symbol: string): Promise<EarningsResult[]> {
    // Simulating institutional-grade earnings data
    // In production, this would use Finnhub's /stock/earnings and /calendar/earnings
    const quarters = ['Q4 2025', 'Q3 2025', 'Q2 2025', 'Q1 2025', 'Q4 2024'];
    const baseDate = new Date();
    
    return quarters.map((q, i) => {
      const date = new Date();
      date.setMonth(baseDate.getMonth() - (i * 3));
      
      const actual = 2.5 + Math.random();
      const estimate = 2.5 + Math.random() * 0.5;
      const surprise = actual - estimate;
      
      return {
        quarter: q,
        date: date.toISOString().split('T')[0],
        epsActual: i === 0 ? null : actual, // Null for upcoming
        epsEstimate: estimate,
        surprise: i === 0 ? null : surprise,
        surprisePercent: i === 0 ? null : (surprise / estimate) * 100,
        revenueActual: i === 0 ? null : 50000 + Math.random() * 10000,
        revenueEstimate: 50000 + Math.random() * 5000,
        priceReaction: i === 0 ? null : (Math.random() * 10 - 5)
      };
    });
  }

  /**
   * Fetches catalyst calendar events.
   */
  public async fetchCatalysts(symbol: string): Promise<CatalystEvent[]> {
    const now = new Date();
    return [
      {
        id: '1',
        date: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Q1 2026 Earnings Call',
        type: 'Earnings' as const,
        impact: 'High' as const,
        description: 'Primary quarterly financial results and forward guidance update.'
      },
      {
        id: '2',
        date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Dividend Ex-Date',
        type: 'Dividend' as const,
        impact: 'Low' as const,
        description: 'Quarterly cash dividend of $0.24 per share.'
      },
      {
        id: '3',
        date: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Annual Product Showcase',
        type: 'Product' as const,
        impact: 'Medium' as const,
        description: 'Unveiling of next-generation hardware and software ecosystem updates.'
      },
      {
        id: '4',
        date: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: 'Goldman Sachs Tech Conference',
        type: 'Conference' as const,
        impact: 'Medium' as const,
        description: 'CFO fireside chat regarding long-term margin expansion targets.'
      }
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  /**
   * Generates impact summary.
   */
  public async getEventImpactSummary(symbol: string): Promise<EventImpactSummary> {
    return {
      recentCatalyst: "Q4 Earnings Beat",
      marketReaction: "Positive (+4.2% post-market)",
      riskLevel: "Moderate",
      upcomingSignificance: "High - Q1 Guidance critical for valuation support",
      volatilityContext: "Implied volatility is currently 15% above 30-day historical average."
    };
  }
}
