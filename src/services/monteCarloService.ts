/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanyDataService, HistoricalDataPoint } from "./companyService";
import { Portfolio } from "./portfolioService";

export interface SimulationInputs {
  initialValue: number;
  years: number;
  numSimulations: number;
  annualContribution: number;
  targetValue: number;
  expectedReturnOverride?: number;
  volatilityOverride?: number;
}

export interface SimulationPath {
  id: number;
  data: { year: number; value: number }[];
}

export interface SimulationResult {
  paths: SimulationPath[];
  terminalValues: number[];
  percentiles: {
    p5: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  probabilityOfTarget: number;
  expectedReturn: number;
  expectedVolatility: number;
  histogramData: { bin: string; count: number }[];
}

export class MonteCarloService {
  private static instance: MonteCarloService;

  private constructor() {}

  public static getInstance(): MonteCarloService {
    if (!MonteCarloService.instance) {
      MonteCarloService.instance = new MonteCarloService();
    }
    return MonteCarloService.instance;
  }

  public async runPortfolioSimulation(inputs: SimulationInputs): Promise<SimulationResult | null> {
    const expectedReturn = inputs.expectedReturnOverride ?? 0.08;
    const expectedVolatility = inputs.volatilityOverride ?? 0.18;
    return this.runSimulationCore(inputs, expectedReturn, expectedVolatility);
  }

  private runSimulationCore(
    inputs: SimulationInputs,
    expectedReturn: number,
    expectedVolatility: number
  ): SimulationResult {
    const { initialValue, years, numSimulations, annualContribution, targetValue } = inputs;
    const dt = 1 / 252;
    const totalSteps = Math.floor(years * 252);
    const paths: SimulationPath[] = [];
    const terminalValues: number[] = [];
    const pathsToStore = 50;

    for (let i = 0; i < numSimulations; i++) {
      let currentValue = initialValue;
      const pathData: { year: number; value: number }[] = [{ year: 0, value: initialValue }];

      for (let step = 1; step <= totalSteps; step++) {
        const drift = (expectedReturn - 0.5 * Math.pow(expectedVolatility, 2)) * dt;
        const diffusion = expectedVolatility * Math.sqrt(dt) * this.gaussianRandom();
        currentValue = currentValue * Math.exp(drift + diffusion);

        if (step % 252 === 0) {
          currentValue += annualContribution;
          if (i < pathsToStore) {
            pathData.push({ year: step / 252, value: currentValue });
          }
        }
      }

      terminalValues.push(currentValue);
      if (i < pathsToStore) {
        paths.push({ id: i, data: pathData });
      }
    }

    const sortedTerminal = [...terminalValues].sort((a, b) => a - b);
    const getPercentile = (p: number) => sortedTerminal[Math.floor(p * (numSimulations - 1))];

    const percentiles = {
      p5: getPercentile(0.05),
      p10: getPercentile(0.10),
      p25: getPercentile(0.25),
      p50: getPercentile(0.50),
      p75: getPercentile(0.75),
      p90: getPercentile(0.90),
      p95: getPercentile(0.95),
    };

    const successes = terminalValues.filter(v => v >= targetValue).length;
    const probabilityOfTarget = (successes / numSimulations) * 100;
    const histogramData = this.generateHistogram(terminalValues);

    return { paths, terminalValues, percentiles, probabilityOfTarget, expectedReturn, expectedVolatility, histogramData };
  }

  public async runSimulation(
    portfolio: Portfolio,
    inputs: SimulationInputs
  ): Promise<SimulationResult | null> {
    if (portfolio.positions.length === 0) return null;

    // 1. Calculate Portfolio Stats (Return & Volatility)
    let { expectedReturn, expectedVolatility } = await this.calculatePortfolioStats(portfolio);

    // Apply overrides if provided
    if (inputs.expectedReturnOverride !== undefined) expectedReturn = inputs.expectedReturnOverride;
    if (inputs.volatilityOverride !== undefined) expectedVolatility = inputs.volatilityOverride;

    return this.runSimulationCore(inputs, expectedReturn, expectedVolatility);
  }

  private async calculatePortfolioStats(portfolio: Portfolio): Promise<{ expectedReturn: number; expectedVolatility: number }> {
    const symbols = portfolio.positions.map(p => p.symbol);
    const historicalData: Record<string, HistoricalDataPoint[]> = {};

    await Promise.all(symbols.map(async (symbol) => {
      const data = await CompanyDataService.getInstance().fetchHistoricalData(symbol, "1Y");
      historicalData[symbol] = data;
    }));

    const alignedReturns = this.calculateAlignedReturns(historicalData);
    if (Object.keys(alignedReturns).length === 0) return { expectedReturn: 0.08, expectedVolatility: 0.15 };

    const tickers = Object.keys(alignedReturns);
    const numTickers = tickers.length;
    const numDays = alignedReturns[tickers[0]].length;

    // Expected Returns (Annualized)
    const expReturns: Record<string, number> = {};
    tickers.forEach(t => {
      const avg = alignedReturns[t].reduce((a, b) => a + b, 0) / alignedReturns[t].length;
      expReturns[t] = avg * 252;
    });

    // Covariance Matrix
    const covMatrix: number[][] = Array(numTickers).fill(0).map(() => Array(numTickers).fill(0));
    for (let i = 0; i < numTickers; i++) {
      for (let j = 0; j < numTickers; j++) {
        let cov = 0;
        const meanI = expReturns[tickers[i]] / 252;
        const meanJ = expReturns[tickers[j]] / 252;
        for (let k = 0; k < numDays; k++) {
          cov += (alignedReturns[tickers[i]][k] - meanI) * (alignedReturns[tickers[j]][k] - meanJ);
        }
        covMatrix[i][j] = (cov / (numDays - 1)) * 252;
      }
    }

    // Portfolio Weights
    const totalValue = portfolio.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const weights: Record<string, number> = {};
    portfolio.positions.forEach(p => {
      weights[p.symbol] = p.marketValue / totalValue;
    });

    // Portfolio Return
    let pReturn = 0;
    tickers.forEach(t => {
      pReturn += (weights[t] || 0) * expReturns[t];
    });

    // Portfolio Volatility
    let pVar = 0;
    for (let i = 0; i < numTickers; i++) {
      for (let j = 0; j < numTickers; j++) {
        pVar += (weights[tickers[i]] || 0) * (weights[tickers[j]] || 0) * covMatrix[i][j];
      }
    }

    return {
      expectedReturn: pReturn,
      expectedVolatility: Math.sqrt(pVar)
    };
  }

  private calculateAlignedReturns(historicalData: Record<string, HistoricalDataPoint[]>): Record<string, number[]> {
    const symbols = Object.keys(historicalData);
    if (symbols.length === 0) return {};
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

  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private generateHistogram(values: number[]): { bin: string; count: number }[] {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const numBins = 20;
    const binSize = (max - min) / numBins;
    const bins = Array(numBins).fill(0);

    values.forEach(v => {
      const binIndex = Math.min(Math.floor((v - min) / binSize), numBins - 1);
      bins[binIndex]++;
    });

    return bins.map((count, i) => ({
      bin: `$${((min + i * binSize) / 1000).toFixed(0)}k`,
      count
    }));
  }
}
