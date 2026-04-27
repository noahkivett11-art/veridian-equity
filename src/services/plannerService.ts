/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Very High';
export type RiskTolerance = 'Conservative' | 'Moderate' | 'Aggressive';
export type InvestmentPreference = 'Growth' | 'Income' | 'Balanced';

export interface InvestorProfileInputs {
  age: number;
  investableAmount: number;
  annualContribution: number;
  yearsToRetirement: number;
  riskLevel: RiskLevel;
  riskTolerance: RiskTolerance;
  desiredReturn: number;
  incomeNeed: 'None' | 'Low' | 'Medium' | 'High';
  preference: InvestmentPreference;
}

export interface AllocationSleeve {
  category: string;
  weight: number;
  description: string;
  exampleAssets: string[];
}

export interface PortfolioRecommendation {
  profileName: string;
  stockBondRatio: string;
  growthTilt: string;
  estimatedReturnRange: [number, number];
  riskLevel: string;
  explanation: string;
  allocations: AllocationSleeve[];
}

export class PlannerService {
  private static instance: PlannerService;

  private constructor() {}

  public static getInstance(): PlannerService {
    if (!PlannerService.instance) {
      PlannerService.instance = new PlannerService();
    }
    return PlannerService.instance;
  }

  public generateRecommendation(inputs: InvestorProfileInputs): PortfolioRecommendation {
    const riskScore = this.calculateRiskScore(inputs);
    
    if (riskScore < 30) {
      return this.getConservativeProfile(inputs);
    } else if (riskScore < 60) {
      return this.getModerateProfile(inputs);
    } else if (riskScore < 85) {
      return this.getGrowthProfile(inputs);
    } else {
      return this.getAggressiveGrowthProfile(inputs);
    }
  }

  private calculateRiskScore(inputs: InvestorProfileInputs): number {
    let score = 0;

    // Time Horizon (0-30 points)
    if (inputs.yearsToRetirement > 20) score += 30;
    else if (inputs.yearsToRetirement > 10) score += 20;
    else if (inputs.yearsToRetirement > 5) score += 10;

    // Risk Level Choice (0-30 points)
    const riskLevelMap: Record<RiskLevel, number> = {
      'Low': 0,
      'Medium': 10,
      'High': 20,
      'Very High': 30
    };
    score += riskLevelMap[inputs.riskLevel];

    // Risk Tolerance (0-20 points)
    const toleranceMap: Record<RiskTolerance, number> = {
      'Conservative': 0,
      'Moderate': 10,
      'Aggressive': 20
    };
    score += toleranceMap[inputs.riskTolerance];

    // Preference (0-20 points)
    const prefMap: Record<InvestmentPreference, number> = {
      'Income': 0,
      'Balanced': 10,
      'Growth': 20
    };
    score += prefMap[inputs.preference];

    return score;
  }

  private getConservativeProfile(inputs: InvestorProfileInputs): PortfolioRecommendation {
    return {
      profileName: "Conservative Income",
      stockBondRatio: "30/70",
      growthTilt: "Low / Dividend Focused",
      estimatedReturnRange: [3, 5],
      riskLevel: "Low",
      explanation: "Based on your preference for income and a shorter time horizon or lower risk tolerance, this model prioritizes capital preservation and steady yield. The high bond allocation provides a buffer against equity market volatility.",
      allocations: [
        { category: "Large Cap Dividend", weight: 0.20, description: "High-quality, dividend-paying US equities.", exampleAssets: ["VIG", "SCHD", "HD"] },
        { category: "International Value", weight: 0.10, description: "Established non-US companies with stable cash flows.", exampleAssets: ["VYMI", "EFV"] },
        { category: "Investment Grade Bonds", weight: 0.45, description: "US Treasury and high-quality corporate debt.", exampleAssets: ["BND", "AGG"] },
        { category: "Short-Term / TIPS", weight: 0.15, description: "Inflation-protected and short-duration fixed income.", exampleAssets: ["VTIP", "BSV"] },
        { category: "Cash / Money Market", weight: 0.10, description: "Highly liquid capital preservation.", exampleAssets: ["VMFXX", "SPAXX"] }
      ]
    };
  }

  private getModerateProfile(inputs: InvestorProfileInputs): PortfolioRecommendation {
    return {
      profileName: "Moderate Balanced",
      stockBondRatio: "60/40",
      growthTilt: "Balanced Core",
      estimatedReturnRange: [5, 7],
      riskLevel: "Medium",
      explanation: "This 60/40 style framework balances growth potential with risk mitigation. It is designed for investors with a medium-term horizon who seek market participation while maintaining a significant defensive component.",
      allocations: [
        { category: "US Total Stock Market", weight: 0.35, description: "Broad exposure to the entire US equity market.", exampleAssets: ["VTI", "ITOT"] },
        { category: "International Developed", weight: 0.15, description: "Exposure to major non-US economies.", exampleAssets: ["VEA", "IEFA"] },
        { category: "Large Cap Dividend", weight: 0.10, description: "Defensive equity sleeve for income and stability.", exampleAssets: ["SCHD", "VIG"] },
        { category: "Total Bond Market", weight: 0.30, description: "Diversified US fixed income exposure.", exampleAssets: ["BND", "AGG"] },
        { category: "International Bonds", weight: 0.05, description: "Non-US sovereign and corporate debt.", exampleAssets: ["BNDX"] },
        { category: "Cash", weight: 0.05, description: "Liquidity for rebalancing and safety.", exampleAssets: ["VMFXX"] }
      ]
    };
  }

  private getGrowthProfile(inputs: InvestorProfileInputs): PortfolioRecommendation {
    return {
      profileName: "Capital Growth",
      stockBondRatio: "80/20",
      growthTilt: "Moderate Growth",
      estimatedReturnRange: [7, 9],
      riskLevel: "High",
      explanation: "With a longer time horizon and higher risk tolerance, this model emphasizes equity growth. The 20% bond allocation serves primarily as a rebalancing tool and minor volatility dampener rather than a primary return driver.",
      allocations: [
        { category: "Large Cap Growth", weight: 0.40, description: "Focus on high-growth US technology and consumer companies.", exampleAssets: ["VUG", "QQQ"] },
        { category: "US Mid/Small Cap", weight: 0.15, description: "Exposure to smaller, faster-growing US companies.", exampleAssets: ["VB", "VO"] },
        { category: "International Developed", weight: 0.15, description: "Global equity diversification.", exampleAssets: ["VXUS", "VEA"] },
        { category: "Emerging Markets", weight: 0.10, description: "High-growth potential in developing economies.", exampleAssets: ["VWO", "IEMG"] },
        { category: "Total Bond Market", weight: 0.20, description: "Core fixed income for structural stability.", exampleAssets: ["BND", "AGG"] }
      ]
    };
  }

  private getAggressiveGrowthProfile(inputs: InvestorProfileInputs): PortfolioRecommendation {
    return {
      profileName: "Aggressive Growth",
      stockBondRatio: "95/5",
      growthTilt: "High Growth / Innovation",
      estimatedReturnRange: [9, 12],
      riskLevel: "Very High",
      explanation: "Designed for long-term wealth accumulation where near-term volatility is acceptable. This model is heavily tilted toward innovation, technology, and emerging markets to maximize total return potential over decades.",
      allocations: [
        { category: "Technology & Innovation", weight: 0.45, description: "Concentrated exposure to secular growth themes.", exampleAssets: ["QQQM", "VGT", "ARKK"] },
        { category: "US Total Stock Market", weight: 0.20, description: "Core US equity foundation.", exampleAssets: ["VTI"] },
        { category: "Emerging Markets", weight: 0.15, description: "Aggressive international growth exposure.", exampleAssets: ["VWO", "MCHI"] },
        { category: "Small Cap Growth", weight: 0.15, description: "High-beta US equity exposure.", exampleAssets: ["VOT", "IWO"] },
        { category: "High Yield / Bonds", weight: 0.05, description: "Minimal defensive sleeve.", exampleAssets: ["JNK", "BND"] }
      ]
    };
  }
}
