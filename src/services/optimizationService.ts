/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanyDataService, HistoricalDataPoint } from "./companyService";
import { Portfolio, Position } from "./portfolioService";
import { parseNumber } from "../lib/utils";

export type OptimizationObjective = "Max Sharpe" | "Min Variance" | "Target Return" | "Risk-Constrained";

export interface OptimizationConstraints {
  maxWeight: number; // e.g. 0.4 for 40%
  minWeight: number; // e.g. 0.05 for 5%
  includeCash: boolean;
  sectorMaxExposure: Record<string, number>;
}

export interface OptimizedPortfolio {
  weights: Record<string, number>; // symbol -> weight (0-1)
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
}

export interface FrontierPoint extends OptimizedPortfolio {}

export interface OptimizationResult {
  current: OptimizedPortfolio;
  optimized: OptimizedPortfolio;
  minVariance: OptimizedPortfolio;
  maxSharpe: OptimizedPortfolio;
  efficientFrontier: FrontierPoint[];
  correlationMatrix: Record<string, Record<string, number>>;
}

export class OptimizationService {
  private static instance: OptimizationService;
  private RISK_FREE_RATE = 0.02; // 2% assumed

  private constructor() {}

  public static getInstance(): OptimizationService {
    if (!OptimizationService.instance) {
      OptimizationService.instance = new OptimizationService();
    }
    return OptimizationService.instance;
  }

  public async optimizePortfolio(
    portfolio: Portfolio,
    objective: OptimizationObjective,
    constraints: OptimizationConstraints
  ): Promise<OptimizationResult | null> {
    if (portfolio.positions.length < 2) return null;

    const symbols = portfolio.positions.map(p => p.symbol);
    const historicalData: Record<string, HistoricalDataPoint[]> = {};

    // Fetch 1Y historical data for all symbols
    await Promise.all(symbols.map(async (symbol) => {
      const data = await CompanyDataService.getInstance().fetchHistoricalData(symbol, "1Y");
      historicalData[symbol] = data;
    }));

    // Align dates and calculate returns
    const alignedReturns = this.calculateAlignedReturns(historicalData);
    if (Object.keys(alignedReturns).length === 0) return null;

    const tickers = Object.keys(alignedReturns);
    const numTickers = tickers.length;
    const numDays = alignedReturns[tickers[0]].length;

    // Calculate Expected Returns (Annualized)
    const expectedReturns: Record<string, number> = {};
    tickers.forEach(ticker => {
      const returns = alignedReturns[ticker];
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      expectedReturns[ticker] = avgReturn * 252; // Annualize daily returns
    });

    // Calculate Covariance Matrix (Annualized)
    const covarianceMatrix: number[][] = Array(numTickers).fill(0).map(() => Array(numTickers).fill(0));
    for (let i = 0; i < numTickers; i++) {
      for (let j = 0; j < numTickers; j++) {
        let cov = 0;
        const meanI = expectedReturns[tickers[i]] / 252;
        const meanJ = expectedReturns[tickers[j]] / 252;
        for (let k = 0; k < numDays; k++) {
          cov += (alignedReturns[tickers[i]][k] - meanI) * (alignedReturns[tickers[j]][k] - meanJ);
        }
        covarianceMatrix[i][j] = (cov / (numDays - 1)) * 252;
      }
    }

    // Correlation Matrix
    const correlationMatrix: Record<string, Record<string, number>> = {};
    tickers.forEach((t1, i) => {
      correlationMatrix[t1] = {};
      tickers.forEach((t2, j) => {
        const sigmaI = Math.sqrt(covarianceMatrix[i][i]);
        const sigmaJ = Math.sqrt(covarianceMatrix[j][j]);
        correlationMatrix[t1][t2] = covarianceMatrix[i][j] / (sigmaI * sigmaJ);
      });
    });

    // Current Portfolio Stats
    const totalValue = portfolio.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const currentWeights: Record<string, number> = {};
    portfolio.positions.forEach(p => {
      currentWeights[p.symbol] = p.marketValue / totalValue;
    });

    const currentStats = this.calculatePortfolioStats(currentWeights, tickers, expectedReturns, covarianceMatrix);

    // Generate Efficient Frontier (Random Sampling for now, as it's stable and easy to implement)
    const numSimulations = 5000;
    const frontierPoints: FrontierPoint[] = [];
    let maxSharpePoint: FrontierPoint | null = null;
    let minVarPoint: FrontierPoint | null = null;

    for (let i = 0; i < numSimulations; i++) {
      const weights = this.generateRandomWeights(tickers, constraints, portfolio.positions);
      const stats = this.calculatePortfolioStats(weights, tickers, expectedReturns, covarianceMatrix);
      
      const point: FrontierPoint = {
        expectedReturn: stats.expectedReturn,
        expectedVolatility: stats.expectedVolatility,
        sharpeRatio: stats.sharpeRatio,
        weights
      };

      frontierPoints.push(point);

      if (!maxSharpePoint || point.sharpeRatio > maxSharpePoint.sharpeRatio) maxSharpePoint = point;
      if (!minVarPoint || point.expectedVolatility < minVarPoint.expectedVolatility) minVarPoint = point;
    }

    // Select "Optimized" based on objective
    let optimized: OptimizedPortfolio;
    switch (objective) {
      case "Max Sharpe":
        optimized = maxSharpePoint!;
        break;
      case "Min Variance":
        optimized = minVarPoint!;
        break;
      default:
        optimized = maxSharpePoint!;
    }

    return {
      current: currentStats,
      optimized,
      minVariance: minVarPoint!,
      maxSharpe: maxSharpePoint!,
      efficientFrontier: this.filterFrontier(frontierPoints),
      correlationMatrix
    };
  }

  private calculateAlignedReturns(historicalData: Record<string, HistoricalDataPoint[]>): Record<string, number[]> {
    const symbols = Object.keys(historicalData);
    if (symbols.length === 0) return {};

    // Find common dates
    const dateSets = symbols.map(s => new Set(historicalData[s].map(p => p.date)));
    const commonDates = [...dateSets[0]].filter(date => dateSets.every(set => set.has(date))).sort();

    if (commonDates.length < 10) return {};

    const alignedReturns: Record<string, number[]> = {};
    symbols.forEach(symbol => {
      const data = historicalData[symbol];
      const prices: number[] = [];
      commonDates.forEach(date => {
        const point = data.find(p => p.date === date);
        if (point) prices.push(point.price);
      });

      const returns: number[] = [];
      for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
      alignedReturns[symbol] = returns;
    });

    return alignedReturns;
  }

  private calculatePortfolioStats(
    weights: Record<string, number>,
    tickers: string[],
    expectedReturns: Record<string, number>,
    covarianceMatrix: number[][]
  ): OptimizedPortfolio {
    let portfolioReturn = 0;
    tickers.forEach(t => {
      portfolioReturn += (weights[t] || 0) * expectedReturns[t];
    });

    let portfolioVar = 0;
    for (let i = 0; i < tickers.length; i++) {
      for (let j = 0; j < tickers.length; j++) {
        portfolioVar += (weights[tickers[i]] || 0) * (weights[tickers[j]] || 0) * covarianceMatrix[i][j];
      }
    }

    const portfolioVol = Math.sqrt(portfolioVar);
    const sharpe = (portfolioReturn - this.RISK_FREE_RATE) / portfolioVol;

    return {
      weights,
      expectedReturn: portfolioReturn,
      expectedVolatility: portfolioVol,
      sharpeRatio: sharpe
    };
  }

  private generateRandomWeights(
    tickers: string[],
    constraints: OptimizationConstraints,
    positions: Position[]
  ): Record<string, number> {
    const weights: Record<string, number> = {};
    let total = 0;

    // Simple random weights with constraints
    // This is a naive implementation, a better one would use Dirichlet distribution or similar
    tickers.forEach(t => {
      const rand = Math.random();
      weights[t] = rand;
      total += rand;
    });

    // Normalize
    tickers.forEach(t => {
      weights[t] /= total;
    });

    // Apply basic min/max constraints (clipping and re-normalizing)
    // In a real app, we'd use a more robust constrained optimization
    let adjustedTotal = 0;
    tickers.forEach(t => {
      weights[t] = Math.max(constraints.minWeight, Math.min(constraints.maxWeight, weights[t]));
      adjustedTotal += weights[t];
    });

    tickers.forEach(t => {
      weights[t] /= adjustedTotal;
    });

    return weights;
  }

  private filterFrontier(points: FrontierPoint[]): FrontierPoint[] {
    // Return a subset of points to keep the chart clean and focused on the frontier
    // Sort by volatility and take points that have the highest return for that volatility
    const sorted = [...points].sort((a, b) => a.expectedVolatility - b.expectedVolatility);
    const filtered: FrontierPoint[] = [];
    let maxReturn = -Infinity;

    sorted.forEach(p => {
      if (p.expectedReturn > maxReturn) {
        filtered.push(p);
        maxReturn = p.expectedReturn;
      }
    });

    return filtered;
  }
}
