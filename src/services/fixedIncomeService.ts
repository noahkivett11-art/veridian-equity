/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BondInputs {
  faceValue: number;
  couponRate: number;
  ytm: number;
  yearsToMaturity: number;
  frequency: number; // 1 for annual, 2 for semi-annual
}

export interface CashFlow {
  period: number;
  cashFlow: number;
  discountFactor: number;
  presentValue: number;
  runningTotalPV: number;
}

export interface BondPricingResult {
  price: number;
  status: 'Premium' | 'Par' | 'Discount';
  pvCoupons: number;
  pvFaceValue: number;
  cashFlows: CashFlow[];
  macaulayDuration: number;
  modifiedDuration: number;
  dollarDuration: number;
  convexity: number;
}

export interface YieldCurvePoint {
  maturity: string;
  tenor: number; // in years for sorting
  yield: number;
}

export interface PriceSensitivityPoint {
  shiftBps: number;
  durationEstimate: number;
  durationConvexityEstimate: number;
  exactPrice: number;
}

export interface YTMSolverResult {
  ytm: number;
  iterations: number;
  verificationPrice: number;
}

export interface SpotBootstrapBond {
  maturity: number;
  couponRate: number;
  price: number;
  faceValue: number;
  frequency: number;
}

export interface SpotRateResult {
  maturity: number;
  spotRate: number;
  discountFactor: number;
}

export class FixedIncomeService {
  private static instance: FixedIncomeService;

  private constructor() {}

  public static getInstance(): FixedIncomeService {
    if (!FixedIncomeService.instance) {
      FixedIncomeService.instance = new FixedIncomeService();
    }
    return FixedIncomeService.instance;
  }

  /**
   * Calculates bond price, duration, convexity and detailed cash flows.
   */
  public calculateBondPrice(inputs: BondInputs): BondPricingResult {
    const { faceValue, couponRate, ytm, yearsToMaturity, frequency } = inputs;
    const totalPeriods = Math.ceil(yearsToMaturity * frequency);
    const periodicCoupon = (faceValue * (couponRate / 100)) / frequency;
    const periodicYtm = (ytm / 100) / frequency;

    let pvCoupons = 0;
    let macDurationSum = 0;
    let convexitySum = 0;
    const cashFlows: CashFlow[] = [];
    let runningTotalPV = 0;

    for (let t = 1; t <= totalPeriods; t++) {
      const discountFactor = 1 / Math.pow(1 + periodicYtm, t);
      const pv = periodicCoupon * discountFactor;
      pvCoupons += pv;
      runningTotalPV += pv;

      // Duration and Convexity components
      const timeInYears = t / frequency;
      macDurationSum += timeInYears * pv;
      convexitySum += (t * (t + 1) * periodicCoupon) / Math.pow(1 + periodicYtm, t + 2);

      cashFlows.push({
        period: t,
        cashFlow: periodicCoupon,
        discountFactor,
        presentValue: pv,
        runningTotalPV
      });
    }

    const pvFaceValue = faceValue / Math.pow(1 + periodicYtm, totalPeriods);
    runningTotalPV += pvFaceValue;
    
    // Final period duration and convexity components
    const finalTimeInYears = totalPeriods / frequency;
    macDurationSum += finalTimeInYears * pvFaceValue;
    convexitySum += (totalPeriods * (totalPeriods + 1) * faceValue) / Math.pow(1 + periodicYtm, totalPeriods + 2);

    // Update the last cash flow to include face value for the table
    if (cashFlows.length > 0) {
      const last = cashFlows[cashFlows.length - 1];
      last.cashFlow += faceValue;
      last.presentValue += pvFaceValue;
      last.runningTotalPV = runningTotalPV;
    }

    const price = pvCoupons + pvFaceValue;
    const macDuration = macDurationSum / price;
    const modDuration = macDuration / (1 + periodicYtm);
    const dollarDuration = modDuration * price;
    const convexity = convexitySum / (price * Math.pow(frequency, 2));

    let status: 'Premium' | 'Par' | 'Discount' = 'Par';
    if (price > faceValue + 0.01) status = 'Premium';
    else if (price < faceValue - 0.01) status = 'Discount';

    return {
      price,
      status,
      pvCoupons,
      pvFaceValue,
      cashFlows,
      macaulayDuration: macDuration,
      modifiedDuration: modDuration,
      dollarDuration,
      convexity
    };
  }

  /**
   * Gets current Treasury Yield Curve data.
   */
  public getTreasuryYieldCurve(): YieldCurvePoint[] {
    // Mocking real-time Treasury data as requested
    return [
      { maturity: "1M", tenor: 1/12, yield: 5.38 },
      { maturity: "3M", tenor: 3/12, yield: 5.42 },
      { maturity: "6M", tenor: 6/12, yield: 5.35 },
      { maturity: "1Y", tenor: 1, yield: 5.12 },
      { maturity: "2Y", tenor: 2, yield: 4.88 },
      { maturity: "3Y", tenor: 3, yield: 4.65 },
      { maturity: "5Y", tenor: 5, yield: 4.42 },
      { maturity: "7Y", tenor: 7, yield: 4.38 },
      { maturity: "10Y", tenor: 10, yield: 4.35 },
      { maturity: "20Y", tenor: 20, yield: 4.62 },
      { maturity: "30Y", tenor: 30, yield: 4.51 },
    ];
  }

  /**
   * Calculates price sensitivity for various yield shifts.
   */
  public getPriceSensitivityAnalysis(inputs: BondInputs): PriceSensitivityPoint[] {
    const baseResult = this.calculateBondPrice(inputs);
    const shifts = [200, 100, 50, -50, -100, -200];
    
    return shifts.map(shiftBps => {
      const shift = shiftBps / 10000;
      const exactResult = this.calculateBondPrice({
        ...inputs,
        ytm: inputs.ytm + (shiftBps / 100)
      });

      // Duration approximation: dP/P = -Dmod * dy
      const durEstimate = baseResult.price * (1 - baseResult.modifiedDuration * shift);
      
      // Duration + Convexity approximation: dP/P = -Dmod * dy + 0.5 * C * dy^2
      const durConvEstimate = baseResult.price * (1 - baseResult.modifiedDuration * shift + 0.5 * baseResult.convexity * Math.pow(shift, 2));

      return {
        shiftBps,
        durationEstimate: durEstimate,
        durationConvexityEstimate: durConvEstimate,
        exactPrice: exactResult.price
      };
    });
  }

  /**
   * Solves for YTM using the bisection method.
   */
  public solveYTM(
    marketPrice: number,
    faceValue: number,
    couponRate: number,
    yearsToMaturity: number,
    frequency: number
  ): YTMSolverResult {
    let low = 0;
    let high = 100; // 100% max yield for search
    let iterations = 0;
    const tolerance = 0.00001;
    const maxIterations = 100;

    let mid = 0;
    while (iterations < maxIterations) {
      mid = (low + high) / 2;
      const result = this.calculateBondPrice({
        faceValue,
        couponRate,
        ytm: mid,
        yearsToMaturity,
        frequency
      });

      if (Math.abs(result.price - marketPrice) < tolerance) {
        break;
      }

      if (result.price > marketPrice) {
        low = mid;
      } else {
        high = mid;
      }
      iterations++;
    }

    return {
      ytm: mid,
      iterations,
      verificationPrice: this.calculateBondPrice({
        faceValue,
        couponRate,
        ytm: mid,
        yearsToMaturity,
        frequency
      }).price
    };
  }

  private interpolateSpotRate(spots: { maturity: number; spotRate: number }[], t: number): number {
    if (spots.length === 0) return 5;
    const exact = spots.find(s => Math.abs(s.maturity - t) < 0.001);
    if (exact) return exact.spotRate;
    const lower = [...spots].filter(s => s.maturity <= t).sort((a, b) => b.maturity - a.maturity)[0];
    const upper = spots.find(s => s.maturity > t);
    if (!lower) return upper!.spotRate;
    if (!upper) return lower.spotRate;
    const ratio = (t - lower.maturity) / (upper.maturity - lower.maturity);
    return lower.spotRate + ratio * (upper.spotRate - lower.spotRate);
  }

  public bootstrapSpotRates(bonds: SpotBootstrapBond[]): SpotRateResult[] {
    const sorted = [...bonds].sort((a, b) => a.maturity - b.maturity);
    const spots: { maturity: number; spotRate: number }[] = [];

    for (const bond of sorted) {
      const { maturity, couponRate, price, faceValue, frequency } = bond;
      const periods = Math.max(1, Math.round(maturity * frequency));
      const periodicCoupon = (faceValue * (couponRate / 100)) / frequency;

      if (couponRate === 0 || periods === 1) {
        const totalCF = periodicCoupon + faceValue;
        const spotRate = (Math.pow(totalCF / price, 1 / maturity) - 1) * 100;
        spots.push({ maturity, spotRate });
      } else {
        let pvCoupons = 0;
        for (let t = 1; t < periods; t++) {
          const tYears = t / frequency;
          const z = this.interpolateSpotRate(spots, tYears) / 100;
          pvCoupons += periodicCoupon / Math.pow(1 + z, tYears);
        }
        const lastCF = periodicCoupon + faceValue;
        const remainingPV = price - pvCoupons;
        if (remainingPV <= 0) continue;
        const spotRate = (Math.pow(lastCF / remainingPV, 1 / maturity) - 1) * 100;
        spots.push({ maturity, spotRate });
      }
    }

    return spots.map(s => ({
      maturity: s.maturity,
      spotRate: parseFloat(s.spotRate.toFixed(4)),
      discountFactor: parseFloat((1 / Math.pow(1 + s.spotRate / 100, s.maturity)).toFixed(6)),
    }));
  }

  /**
   * Generates price/yield sensitivity data.
   */
  public generateSensitivity(inputs: BondInputs): { ytm: number; price: number }[] {
    const data: { ytm: number; price: number }[] = [];
    const baseYield = inputs.ytm;
    
    for (let i = -200; i <= 200; i += 25) {
      const currentYield = baseYield + (i / 100);
      if (currentYield <= 0) continue;
      
      const result = this.calculateBondPrice({
        ...inputs,
        ytm: currentYield
      });
      
      data.push({
        ytm: currentYield,
        price: result.price
      });
    }
    
    return data;
  }
}
