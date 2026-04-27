/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CompanyDataService } from "./companyService";
import { ReportService, EquityRating } from "./reportService";
import { DCFService } from "./dcfService";
import { CompsService } from "./compsService";
import { MarketDataService } from "./api/marketDataService";
import { parseNumber } from "../lib/utils";

export interface Position {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  marketValue: number;
  unrealizedGainLoss: number;
  unrealizedGainLossPercent: number;
  weight: number;
  sector: string;
  beta: number;
  pe: number;
  veridianTargetPrice: number | null;
  veridianRating: EquityRating | null;
  upsideToTarget: number | null;
  purchaseDate: string;
}

export interface Portfolio {
  id: string;
  name: string;
  positions: Position[];
  createdAt: string;
  updatedAt: string;
}

export interface PortfolioSummary {
  totalMarketValue: number;
  totalCostBasis: number;
  totalGainLoss: number;
  totalGainLossPercent: number;
  dailyMove: number;
  dailyMovePercent: number;
  weightedBeta: number;
  portfolioPE: number;
  sectorAllocation: { sector: string; value: number; percent: number }[];
  topHoldings: Position[];
}

export class PortfolioService {
  private static instance: PortfolioService;
  private portfolios: Portfolio[] = [];
  private STORAGE_KEY = "veridian_portfolios";

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): PortfolioService {
    if (!PortfolioService.instance) {
      PortfolioService.instance = new PortfolioService();
    }
    return PortfolioService.instance;
  }

  private loadFromStorage() {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        this.portfolios = JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse portfolios from storage", e);
        this.portfolios = [];
      }
    }
  }

  private saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.portfolios));
  }

  public getPortfolios(): Portfolio[] {
    return this.portfolios;
  }

  public createPortfolio(name: string): Portfolio {
    const newPortfolio: Portfolio = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      positions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.portfolios.push(newPortfolio);
    this.saveToStorage();
    return newPortfolio;
  }

  public deletePortfolio(id: string) {
    this.portfolios = this.portfolios.filter(p => p.id !== id);
    this.saveToStorage();
  }

  private async getVeridianData(symbol: string) {
    try {
      const company = await CompanyDataService.getInstance().fetchCompanyData(symbol);
      const stats = await CompanyDataService.getInstance().fetchKeyStatistics(symbol);
      
      if (!company || !stats) return { targetPrice: null, rating: null };

      // Load DCF
      const dcfData = await DCFService.getInstance().loadCompanyData(symbol);
      const dcfResult = dcfData ? DCFService.getInstance().calculateDCF(dcfData.assumptions) : null;

      // Load Comps
      const targetPeerData = await CompsService.getInstance().fetchPeerData(symbol);
      const peerSymbols = await MarketDataService.getInstance().getPeers(symbol);
      const peers = await Promise.all(peerSymbols.slice(0, 3).map(s => CompsService.getInstance().fetchPeerData(s)));
      const validPeers = peers.filter(p => p !== null) as any[];
      const compsResult = targetPeerData ? CompsService.getInstance().calculateComps(targetPeerData, validPeers) : null;

      const report = ReportService.getInstance().generateInstitutionalReport(company, stats, dcfResult, compsResult);
      return {
        targetPrice: report.targetPrice,
        rating: report.rating
      };
    } catch (e) {
      console.error(`Failed to fetch Veridian data for ${symbol}`, e);
      return { targetPrice: null, rating: null };
    }
  }

  public async addPosition(portfolioId: string, symbol: string, shares: number, costBasis: number, purchaseDate: string = new Date().toISOString().split('T')[0]): Promise<Portfolio | null> {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return null;

    const companyData = await CompanyDataService.getInstance().fetchCompanyData(symbol);
    const stats = await CompanyDataService.getInstance().fetchKeyStatistics(symbol);

    if (!companyData) return null;

    const currentPrice = parseNumber(companyData.price);
    const marketValue = shares * currentPrice;
    const totalCost = shares * costBasis;
    const gainLoss = marketValue - totalCost;
    const gainLossPercent = totalCost !== 0 ? (gainLoss / totalCost) * 100 : 0;

    const veridian = await this.getVeridianData(symbol);

    const newPosition: Position = {
      id: Math.random().toString(36).substr(2, 9),
      symbol: symbol.toUpperCase(),
      name: companyData.name,
      shares,
      costBasis,
      currentPrice,
      marketValue,
      unrealizedGainLoss: gainLoss,
      unrealizedGainLossPercent: gainLossPercent,
      weight: 0, 
      sector: companyData.sector || "Unknown",
      beta: parseNumber(stats?.beta || "1.0"),
      pe: parseNumber(stats?.peRatio || "0"),
      veridianTargetPrice: veridian.targetPrice,
      veridianRating: veridian.rating,
      upsideToTarget: (veridian.targetPrice && currentPrice > 0) ? ((veridian.targetPrice - currentPrice) / currentPrice) * 100 : null,
      purchaseDate
    };

    // Check for existing position to merge or add as new lot (user requested avoiding duplicates unless intentional)
    // For this implementation, we merge by default if ticker matches, or we could support lots.
    // Let's merge for simplicity as per "Prevent duplicate ticker rows unless intentionally added".
    const existingIndex = portfolio.positions.findIndex(p => p.symbol === newPosition.symbol);
    if (existingIndex >= 0) {
      const existing = portfolio.positions[existingIndex];
      const totalShares = existing.shares + shares;
      const newAvgCost = (existing.shares * existing.costBasis + shares * costBasis) / totalShares;
      
      portfolio.positions[existingIndex] = {
        ...existing,
        shares: totalShares,
        costBasis: newAvgCost,
        marketValue: totalShares * currentPrice,
        unrealizedGainLoss: (totalShares * currentPrice) - (totalShares * newAvgCost),
        unrealizedGainLossPercent: (((totalShares * currentPrice) - (totalShares * newAvgCost)) / (totalShares * newAvgCost)) * 100
      };
    } else {
      portfolio.positions.push(newPosition);
    }

    portfolio.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return portfolio;
  }

  public updatePosition(portfolioId: string, positionId: string, shares: number, costBasis: number): Portfolio | null {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return null;

    const position = portfolio.positions.find(p => p.id === positionId);
    if (!position) return null;

    position.shares = shares;
    position.costBasis = costBasis;
    position.marketValue = shares * position.currentPrice;
    position.unrealizedGainLoss = position.marketValue - (shares * costBasis);
    position.unrealizedGainLossPercent = (shares * costBasis) !== 0 ? (position.unrealizedGainLoss / (shares * costBasis)) * 100 : 0;

    portfolio.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return portfolio;
  }

  public deletePosition(portfolioId: string, positionId: string): Portfolio | null {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return null;

    portfolio.positions = portfolio.positions.filter(p => p.id !== positionId);
    portfolio.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return portfolio;
  }

  public async refreshPortfolioPrices(portfolioId: string): Promise<Portfolio | null> {
    const portfolio = this.portfolios.find(p => p.id === portfolioId);
    if (!portfolio) return null;

    await Promise.all(portfolio.positions.map(async (pos) => {
      const data = await CompanyDataService.getInstance().fetchCompanyData(pos.symbol);
      const veridian = await this.getVeridianData(pos.symbol);
      
      if (data) {
        pos.currentPrice = parseNumber(data.price);
        pos.marketValue = pos.shares * pos.currentPrice;
        pos.unrealizedGainLoss = pos.marketValue - (pos.shares * pos.costBasis);
        pos.unrealizedGainLossPercent = (pos.shares * pos.costBasis) !== 0 ? (pos.unrealizedGainLoss / (pos.shares * pos.costBasis)) * 100 : 0;
        
        pos.veridianTargetPrice = veridian.targetPrice;
        pos.veridianRating = veridian.rating;
        pos.upsideToTarget = (veridian.targetPrice && pos.currentPrice > 0) ? ((veridian.targetPrice - pos.currentPrice) / pos.currentPrice) * 100 : null;
      }
    }));

    portfolio.updatedAt = new Date().toISOString();
    this.saveToStorage();
    return portfolio;
  }

  public calculateSummary(portfolio: Portfolio): PortfolioSummary & { weightedUpside: number; buyRatingCount: number } {
    const totalMarketValue = portfolio.positions.reduce((sum, p) => sum + p.marketValue, 0);
    const totalCostBasis = portfolio.positions.reduce((sum, p) => sum + (p.shares * p.costBasis), 0);
    const totalGainLoss = totalMarketValue - totalCostBasis;
    const totalGainLossPercent = totalCostBasis !== 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;

    // Update weights
    portfolio.positions.forEach(p => {
      p.weight = totalMarketValue !== 0 ? (p.marketValue / totalMarketValue) * 100 : 0;
    });

    const weightedBeta = portfolio.positions.reduce((sum, p) => sum + (p.beta * (p.weight / 100)), 0);
    const portfolioPE = portfolio.positions.reduce((sum, p) => sum + (p.pe * (p.weight / 100)), 0);

    // Weighted Upside
    const weightedUpside = portfolio.positions.reduce((sum, p) => {
      return sum + ((p.upsideToTarget || 0) * (p.weight / 100));
    }, 0);

    // Ratings Count
    const buyRatingCount = portfolio.positions.filter(p => p.veridianRating === 'Buy' || p.veridianRating === 'Strong Buy').length;

    // Sector Allocation
    const sectorMap = new Map<string, number>();
    portfolio.positions.forEach(p => {
      const current = sectorMap.get(p.sector) || 0;
      sectorMap.set(p.sector, current + p.marketValue);
    });

    const sectorAllocation = Array.from(sectorMap.entries()).map(([sector, value]) => ({
      sector,
      value,
      percent: totalMarketValue !== 0 ? (value / totalMarketValue) * 100 : 0
    })).sort((a, b) => b.value - a.value);

    const topHoldings = [...portfolio.positions].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5);

    return {
      totalMarketValue,
      totalCostBasis,
      totalGainLoss,
      totalGainLossPercent,
      dailyMove: 0,
      dailyMovePercent: 0,
      weightedBeta,
      portfolioPE,
      sectorAllocation,
      topHoldings,
      weightedUpside,
      buyRatingCount
    };
  }
}
