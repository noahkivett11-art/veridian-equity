import React, { useState, useEffect } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { timeFormat } from "d3-time-format";
import { CompanyDataService, HistoricalDataPoint } from "../../services/companyService";
import { TabBar, Skeleton } from "../shared";

const RANGES = ["1D", "1W", "1M", "3M", "6M", "YTD", "1Y", "5Y", "MAX"];

interface CompanyChartProps {
  symbol: string;
}

export const CompanyChart: React.FC<CompanyChartProps> = ({ symbol }) => {
  const [data, setData] = useState<HistoricalDataPoint[]>([]);
  const [range, setRange] = useState("1M");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const chartData = await CompanyDataService.getInstance().fetchHistoricalData(symbol, range);
      setData(chartData);
      setLoading(false);
    };
    load();
  }, [symbol, range]);

  const formatXAxis = (tick: string) => {
    const d = new Date(tick);
    if (range === "1D") return timeFormat("%H:%M")(d);
    if (range === "1W" || range === "1M") return timeFormat("%b %d")(d);
    return timeFormat("%b %y")(d);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-surface-900 border border-white/[0.1] p-2.5 rounded-lg shadow-xl">
        <p className="text-[10px] text-slate-500 mb-1">{timeFormat("%B %d, %Y")(new Date(label))}</p>
        <p className="text-sm font-mono font-semibold text-accent">
          ${payload[0].value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    );
  };

  return (
    <div className="card p-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <h4 className="card-header">Historical Performance</h4>
        <TabBar tabs={RANGES} active={range} onChange={setRange} />
      </div>

      <div className="h-[380px] relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-7 h-7 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
              <span className="text-xs text-slate-500">Loading chart data...</span>
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-600">
            No historical data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
                stroke="#475569"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                minTickGap={30}
              />
              <YAxis
                stroke="#475569"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
                domain={["auto", "auto"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="price"
                stroke="#22c55e"
                strokeWidth={1.5}
                fillOpacity={1}
                fill="url(#priceGradient)"
                animationDuration={800}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
