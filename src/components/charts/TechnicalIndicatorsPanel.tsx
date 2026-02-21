import { Card } from '@/components/ui/card';
import { TechnicalIndicators } from '@/types/trading';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TechnicalIndicatorsPanelProps {
  indicators: TechnicalIndicators;
}

export function TechnicalIndicatorsPanel({ indicators }: TechnicalIndicatorsPanelProps) {
  const rsi = indicators.rsi;
  const rsiColor = rsi > 70 ? 'text-red-400' : rsi < 30 ? 'text-green-400' : 'text-yellow-400';
  const rsiLabel = rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral';

  const lastMacd = indicators.macd.histogram.length > 0
    ? indicators.macd.histogram[indicators.macd.histogram.length - 1]
    : 0;

  return (
    <Card className="p-3 mt-2">
      <div className="flex flex-wrap items-center gap-4 text-xs">
        {/* RSI */}
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium">RSI(14):</span>
          <span className={`font-mono font-bold ${rsiColor}`}>
            {rsi.toFixed(1)}
          </span>
          <span className={`text-[10px] ${rsiColor}`}>({rsiLabel})</span>
        </div>

        {/* MA20 */}
        {indicators.ma20.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground font-medium">MA20:</span>
            <span className="font-mono text-blue-400">
              {indicators.ma20[indicators.ma20.length - 1]?.toFixed(2)}
            </span>
          </div>
        )}

        {/* MA50 */}
        {indicators.ma50.length > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground font-medium">MA50:</span>
            <span className="font-mono text-purple-400">
              {indicators.ma50[indicators.ma50.length - 1]?.toFixed(2)}
            </span>
          </div>
        )}

        {/* MACD */}
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground font-medium">MACD:</span>
          {lastMacd > 0 ? (
            <TrendingUp className="w-3 h-3 text-green-400" />
          ) : lastMacd < 0 ? (
            <TrendingDown className="w-3 h-3 text-red-400" />
          ) : (
            <Minus className="w-3 h-3 text-muted-foreground" />
          )}
          <span className={`font-mono ${lastMacd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {lastMacd.toFixed(4)}
          </span>
        </div>
      </div>
    </Card>
  );
}
