/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MarketDataService } from "./api/marketDataService";

export type ValueSource = 'loaded' | 'assumption' | 'override';

export interface DCFValue<T> {
  value: T;
  source: ValueSource;
  label?: string;
}

export interface DCFAssumptions {
  symbol: string;
  companyName: string;
  currentRevenue: DCFValue<number | null>;
  growthRates: DCFValue<number[]>; // 5 years
  operatingMargin: DCFValue<number | null>;
  taxRate: DCFValue<number | null>;
  daPercentOfRev: DCFValue<number | null>;
  capexPercentOfRev: DCFValue<number | null>;
  wcPercentOfRev: DCFValue<number | null>;
  sharesOutstanding: DCFValue<number | null>;
  currentEPS: DCFValue<number | null>;
  baseRevenueGrowth: DCFValue<number | null>;
  baseEPSGrowth: DCFValue<number | null>;
  epsGrowthRates: DCFValue<number[]>;
  modelDriver: DCFValue<'revenue' | 'earnings' | 'blended'>;
  netDebt: DCFValue<number | null>;
  terminalGrowth: DCFValue<number | null>;
  wacc: DCFValue<number | null>;
}

export interface WACCInputs {
  riskFreeRate: DCFValue<number | null>;
  beta: DCFValue<number | null>;
  equityRiskPremium: DCFValue<number | null>;
  costOfDebt: DCFValue<number | null>;
  taxRate: DCFValue<number | null>;
  debtWeight: DCFValue<number | null>;
  equityWeight: DCFValue<number | null>;
}

export interface ForecastYear {
  year: number;
  revenue: number;
  ebit: number;
  taxes: number;
  nopat: number;
  da: number;
  capex: number;
  changeInWC: number;
  fcf: number;
  pvFcf: number;
  eps: number;
}

export interface DCFResult {
  forecast: ForecastYear[];
  pvForecastCashFlows: number;
  terminalValue: number;
  pvTerminalValue: number;
  enterpriseValue: number;
  equityValue: number;
  intrinsicValue: number;
}

export class DCFService {
  private static instance: DCFService;

  private constructor() {}

  public static getInstance(): DCFService {
    if (!DCFService.instance) {
      DCFService.instance = new DCFService();
    }
    return DCFService.instance;
  }

  public async loadCompanyData(symbol: string): Promise<{ assumptions: DCFAssumptions, waccInputs: WACCInputs } | null> {
    const api = MarketDataService.getInstance();
    const [header, stats] = await Promise.all([
      api.getCompanyHeader(symbol),
      api.getCompanyStats(symbol)
    ]);

    if (!header || !stats) return null;

    const parse = (val: string | number | null): number | null => {
      if (val === null || val === "Data unavailable") return null;
      if (typeof val === 'number') return val;
      const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
      return isNaN(parsed) ? null : parsed;
    };

    const createValue = <T,>(value: T, source: ValueSource = 'loaded', label?: string): DCFValue<T> => ({
      value,
      source,
      label
    });

    const revTTM = parse(stats.revenueTTM);
    const revGrowthTTM = (parse(stats.revenueGrowth) || 0) / 100;
    const revGrowth5Y = (parse(stats.revenueGrowth5Y) || 0) / 100;
    
    // Seed growth rates: use 5Y average if available, otherwise TTM, then decay
    const baseGrowth = revGrowth5Y || revGrowthTTM || 0.10;
    const growthRates = [
      baseGrowth,
      baseGrowth * 0.9,
      baseGrowth * 0.8,
      baseGrowth * 0.7,
      baseGrowth * 0.6
    ];

    const opMarginTTM = parse(stats.operatingMarginTTM) !== null ? (parse(stats.operatingMarginTTM) as number) / 100 : null;
    const opMargin5Y = parse(stats.operatingMargin5Y) !== null ? (parse(stats.operatingMargin5Y) as number) / 100 : null;
    
    const daTTM = parse(stats.daTTM);
    const capexTTM = parse(stats.capexTTM);
    
    const daPercent = (revTTM && daTTM) ? daTTM / revTTM : 0.05;
    const capexPercent = (revTTM && capexTTM) ? capexTTM / revTTM : 0.06;

    const epsTTM = parse(stats.eps);
    const epsGrowth = 0.12; // Default assumption if not available
    const epsGrowthRates = [
      epsGrowth,
      epsGrowth * 0.9,
      epsGrowth * 0.8,
      epsGrowth * 0.7,
      epsGrowth * 0.6
    ];

    const assumptions: DCFAssumptions = {
      symbol: header.symbol,
      companyName: header.name,
      currentRevenue: createValue(revTTM),
      growthRates: createValue(growthRates, revGrowth5Y ? 'loaded' : 'assumption', revGrowth5Y ? 'Based on 5Y Avg' : 'Model Default'),
      operatingMargin: createValue(opMarginTTM, opMarginTTM !== null ? 'loaded' : 'assumption', (opMargin5Y !== null && opMargin5Y !== undefined) ? `5Y Avg: ${(opMargin5Y * 100).toFixed(1)}%` : undefined),
      taxRate: createValue(parse(stats.taxRateTTM) !== null ? (parse(stats.taxRateTTM) as number) / 100 : 0.21, stats.taxRateTTM !== "Data unavailable" ? 'loaded' : 'assumption'),
      daPercentOfRev: createValue(daPercent, stats.daTTM !== "Data unavailable" ? 'loaded' : 'assumption'),
      capexPercentOfRev: createValue(capexPercent, stats.capexTTM !== "Data unavailable" ? 'loaded' : 'assumption'),
      wcPercentOfRev: createValue(0.02, 'assumption'),
      sharesOutstanding: createValue(parse(stats.sharesOutstanding)),
      currentEPS: createValue(epsTTM),
      baseRevenueGrowth: createValue(baseGrowth, revGrowth5Y ? 'loaded' : 'assumption'),
      baseEPSGrowth: createValue(epsGrowth, 'assumption'),
      epsGrowthRates: createValue(epsGrowthRates, 'assumption'),
      modelDriver: createValue('blended', 'assumption'),
      netDebt: createValue(parse(stats.netDebt)),
      terminalGrowth: createValue(0.02, 'assumption'),
      wacc: createValue(0.09, 'assumption')
    };

    const waccInputs: WACCInputs = {
      riskFreeRate: createValue(0.04, 'assumption'),
      beta: createValue(parse(stats.beta)),
      equityRiskPremium: createValue(0.05, 'assumption'),
      costOfDebt: createValue(0.06, 'assumption'),
      taxRate: createValue(assumptions.taxRate.value, assumptions.taxRate.source),
      debtWeight: createValue(0.2, 'assumption'),
      equityWeight: createValue(0.8, 'assumption')
    };

    return { assumptions, waccInputs };
  }

  public calculateWACC(inputs: WACCInputs): number {
    const beta = inputs.beta.value ?? 1.0;
    const rf = inputs.riskFreeRate.value ?? 0.04;
    const erp = inputs.equityRiskPremium.value ?? 0.05;
    const costOfDebt = inputs.costOfDebt.value ?? 0.06;
    const taxRate = inputs.taxRate.value ?? 0.21;
    const debtWeight = inputs.debtWeight.value ?? 0.2;
    const equityWeight = inputs.equityWeight.value ?? 0.8;

    const costOfEquity = rf + (beta * erp);
    const afterTaxCostOfDebt = costOfDebt * (1 - taxRate);
    const wacc = (equityWeight * costOfEquity) + (debtWeight * afterTaxCostOfDebt);
    return wacc;
  }

  public calculateDCF(assumptions: DCFAssumptions): DCFResult {
    const forecast: ForecastYear[] = [];
    let prevRevenue = assumptions.currentRevenue.value ?? 0;
    let pvForecastCashFlows = 0;
    const wacc = assumptions.wacc.value ?? 0.09;
    const opMargin = assumptions.operatingMargin.value ?? 0;
    const taxRate = assumptions.taxRate.value ?? 0.21;
    const daPercent = assumptions.daPercentOfRev.value ?? 0.05;
    const capexPercent = assumptions.capexPercentOfRev.value ?? 0.06;
    const wcPercent = assumptions.wcPercentOfRev.value ?? 0.02;
    const terminalGrowth = assumptions.terminalGrowth.value ?? 0.02;
    const netDebt = assumptions.netDebt.value ?? 0;
    const sharesOutstanding = assumptions.sharesOutstanding.value ?? 1;
    const modelDriver = assumptions.modelDriver.value ?? 'blended';
    let prevEPS = assumptions.currentEPS.value ?? 0;

    for (let i = 0; i < 5; i++) {
      const year = i + 1;
      const revenue = prevRevenue * (1 + assumptions.growthRates.value[i]);
      const eps = prevEPS * (1 + assumptions.epsGrowthRates.value[i]);
      
      const revenueBasedEbit = revenue * opMargin;
      const earningsBasedEbit = (eps * sharesOutstanding) / (1 - taxRate);
      
      let ebit = 0;
      if (modelDriver === 'revenue') {
        ebit = revenueBasedEbit;
      } else if (modelDriver === 'earnings') {
        ebit = earningsBasedEbit;
      } else {
        ebit = (revenueBasedEbit + earningsBasedEbit) / 2;
      }
      
      const taxes = ebit * taxRate;
      const nopat = ebit - taxes;
      const da = revenue * daPercent;
      const capex = revenue * capexPercent;
      const changeInWC = revenue * wcPercent;
      const fcf = nopat + da - capex - changeInWC;
      const pvFcf = fcf / Math.pow(1 + wacc, year);

      forecast.push({
        year,
        revenue,
        ebit,
        taxes,
        nopat,
        da,
        capex,
        changeInWC,
        fcf,
        pvFcf,
        eps
      });

      pvForecastCashFlows += pvFcf;
      prevRevenue = revenue;
      prevEPS = eps;
    }

    // Guard against invalid terminal growth (must be less than WACC)
    const safeTerminalGrowth = terminalGrowth >= wacc ? wacc - 0.01 : terminalGrowth;
    
    const lastFcf = forecast[4].fcf;
    const terminalValue = (lastFcf * (1 + safeTerminalGrowth)) / (wacc - safeTerminalGrowth);
    const pvTerminalValue = terminalValue / Math.pow(1 + wacc, 5);
    const enterpriseValue = pvForecastCashFlows + pvTerminalValue;
    const equityValue = enterpriseValue - netDebt;
    const intrinsicValue = equityValue / sharesOutstanding;

    return {
      forecast,
      pvForecastCashFlows,
      terminalValue,
      pvTerminalValue,
      enterpriseValue,
      equityValue,
      intrinsicValue
    };
  }

  public generateSensitivity(assumptions: DCFAssumptions, waccRange: number[], growthRange: number[]): number[][] {
    const matrix: number[][] = [];
    
    for (const w of waccRange) {
      const row: number[] = [];
      for (const g of growthRange) {
        const result = this.calculateDCF({
          ...assumptions,
          wacc: { value: w, source: 'assumption' },
          terminalGrowth: { value: g, source: 'assumption' }
        });
        row.push(result.intrinsicValue);
      }
      matrix.push(row);
    }
    
    return matrix;
  }
}
