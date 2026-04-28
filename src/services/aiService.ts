/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { CompanyData, KeyStatistics, CompanyNews } from "./companyService";
import { InvestorProfileInputs, PortfolioRecommendation } from "./plannerService";

/**
 * AIService handles AI-generated summaries and analysis using Gemini.
 */
export class AIService {
  private static instance: AIService;
  private ai: GoogleGenAI;

  private constructor() {
    this.ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
  }

  public static getInstance(): AIService {
    if (!AIService.instance) {
      AIService.instance = new AIService();
    }
    return AIService.instance;
  }

  /**
   * Generates a concise AI overview for a company based on its data and recent news.
   */
  public async generateCompanyOverview(
    company: CompanyData,
    stats: KeyStatistics,
    news: CompanyNews[]
  ): Promise<string> {
    const newsHeadlines = news.map(n => `- ${n.headline}`).join('\n');
    
    const prompt = `
      Generate a concise, professional plain-English overview for ${company.name} (${company.symbol}).
      
      Company Data:
      - Sector: ${company.sector}
      - Industry: ${company.industry}
      - Market Cap: ${company.marketCap}
      - Price: ${company.price} (${company.percentChange}% change)
      - P/E Ratio: ${stats.peRatio}
      - EPS: ${stats.eps}
      - Revenue (TTM): ${stats.revenueTTM}
      - Revenue Growth: ${stats.revenueGrowth}%
      - Operating Margin: ${stats.operatingMarginTTM}%
      
      Recent News Headlines:
      ${newsHeadlines || "No recent news available."}
      
      The overview should summarize:
      1. What the company does.
      2. Recent price context and financial profile.
      3. Valuation context.
      4. Recent news themes.
      
      Additionally, include a clearly labeled 'Key Financials' section at the end with the following bullet points:
      - Revenue (TTM): ${stats.revenueTTM}
      - Operating Margin: ${stats.operatingMarginTTM}%
      - Market Cap: ${company.marketCap}
      
      Keep it under 180 words. Be objective and professional. Do not invent claims.
      If data is missing, focus on what is available.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are a senior equity research analyst at a top-tier investment bank. Your summaries are concise, objective, and data-driven."
        }
      });

      return response.text || "Unable to generate overview at this time.";
    } catch (error) {
      console.error("AI Overview generation error:", error);
      return "An error occurred while generating the company overview.";
    }
  }

  /**
   * Generates a personalized rationale for a recommended portfolio.
   */
  public async generatePortfolioRationale(
    inputs: InvestorProfileInputs,
    recommendation: PortfolioRecommendation
  ): Promise<string> {
    const prompt = `
      As a senior investment strategist, provide a personalized, professional rationale for the following model portfolio recommendation.
      
      User Profile:
      - Age: ${inputs.age}
      - Years to Retirement: ${inputs.yearsToRetirement}
      - Risk Level: ${inputs.riskLevel}
      - Risk Tolerance: ${inputs.riskTolerance}
      - Primary Preference: ${inputs.preference}
      - Desired Return: ${inputs.desiredReturn}%
      
      Recommended Model: ${recommendation.profileName}
      - Stock/Bond Ratio: ${recommendation.stockBondRatio}
      - Growth Tilt: ${recommendation.growthTilt}
      - Estimated Return: ${recommendation.estimatedReturnRange[0]}-${recommendation.estimatedReturnRange[1]}%
      
      Allocations:
      ${recommendation.allocations.map(a => `- ${a.category}: ${Math.round(a.weight * 100)}% (${a.description})`).join('\n')}
      
      Provide a 2-3 paragraph explanation of why this specific mix is appropriate for the user's profile. Mention how it balances their desire for ${inputs.preference} with their ${inputs.riskTolerance} risk tolerance and ${inputs.yearsToRetirement}-year horizon.
      
      Keep it professional, objective, and educational. Remind them this is not personalized advice.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are a senior investment strategist at Veridian Equity. Your rationales are sophisticated, data-driven, and clearly educational."
        }
      });

      return response.text || "Unable to generate rationale at this time.";
    } catch (error) {
      console.error("AI Rationale generation error:", error);
      return "An error occurred while generating the AI rationale.";
    }
  }

  /**
   * Generates a summary of recent and upcoming events for a company.
   */
  public async generateEventIntelligenceSummary(
    symbol: string,
    earnings: any[],
    catalysts: any[]
  ): Promise<string> {
    const prompt = `
      Analyze the earnings trend and event calendar for ${symbol}.
      
      Earnings History:
      ${earnings.slice(1, 5).map(e => `- ${e.quarter}: EPS ${e.epsActual} (Surprise: ${e.surprisePercent?.toFixed(2)}%)`).join('\n')}
      
      Upcoming Catalysts:
      ${catalysts.filter(c => new Date(c.date) > new Date()).map(c => `- ${c.date}: ${c.title} (${c.type}, Impact: ${c.impact})`).join('\n')}
      
      Provide a concise 2-paragraph "Event Intelligence" summary.
      Paragraph 1: Summarize the earnings momentum and surprise history.
      Paragraph 2: Highlight the most critical upcoming catalyst and its potential impact on the investment thesis.
      
      Keep it professional, data-driven, and institutional.
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are a senior event-driven strategist. You analyze catalysts and earnings surprises to identify market-moving events."
        }
      });

      return response.text || "Unable to generate event intelligence summary.";
    } catch (error) {
      console.error("AI Event Summary error:", error);
      return "An error occurred while generating the event intelligence summary.";
    }
  }

  /**
   * Generates a response for the AI Copilot based on the current context and conversation history.
   */
  public async generateCopilotResponse(
    userInput: string,
    context: { activeTab: string; selectedSymbol: string },
    history: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<string> {
    const prompt = `
      You are the Veridian Equity AI Copilot, a premium institutional finance assistant.
      Your goal is to help users understand data, explain reports, summarize companies, and answer finance questions.
      
      Current Context:
      - Page: ${context.activeTab}
      - Selected Ticker: ${context.selectedSymbol || 'None'}
      
      User Input: ${userInput}
      
      Instructions:
      1. Base your answers on verified financial principles and the context provided.
      2. If the user asks about a specific company and a ticker is selected, focus on that company.
      3. Keep the tone professional, analytical, and educational.
      4. DO NOT provide personalized investment advice or fiduciary recommendations.
      5. DO NOT make guaranteed financial claims or promise returns.
      6. If you don't have enough data to answer a specific question about a company's current financials, state that clearly.
      7. Remind the user that your output is for educational and informational purposes only.
      
      Conversation History:
      ${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
    `;

    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are the Veridian Equity AI Copilot. You are sophisticated, objective, and strictly educational. You never provide personal advice or guarantees."
        }
      });

      return response.text || "I'm sorry, I couldn't process that request.";
    } catch (error) {
      console.error("Copilot generation error:", error);
      return "I encountered an error while processing your request. Please try again later.";
    }
  }
}
