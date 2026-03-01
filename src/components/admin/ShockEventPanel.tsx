import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Zap,
  X,
  TrendingUp,
  TrendingDown,
  Settings2,
} from 'lucide-react';
import { ShockEvent, ProductScenario } from '@/lib/market-engine/types';
import { getShockProgress, getShockTimeRemaining } from '@/lib/market-engine/shockEvents';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

interface ShockEventPanelProps {
  productId: string;
  productName: string;
  currentPrice: number;
  activeShock: ShockEvent | null;
  scenario: ProductScenario | null;
  onAddShock: (productId: string, targetPrice: number, durationMinutes: number) => void;
  onCancelShock: (productId: string) => void;
  onUpdateScenario: (productId: string, updates: Partial<ProductScenario>) => void;
}

export function ShockEventPanel({
  productId,
  productName,
  currentPrice,
  activeShock,
  scenario,
  onAddShock,
  onCancelShock,
  onUpdateScenario,
}: ShockEventPanelProps) {
  const [targetPrice, setTargetPrice] = useState('');
  const [duration, setDuration] = useState('5');
  const [showScenario, setShowScenario] = useState(false);

  const handleSubmit = () => {
    const target = parseFloat(targetPrice);
    const dur = parseFloat(duration);
    if (isNaN(target) || target <= 0 || isNaN(dur) || dur <= 0) return;
    onAddShock(productId, target, dur);
    setTargetPrice('');
  };

  const progress = activeShock ? getShockProgress(activeShock) : 0;
  const timeRemaining = activeShock ? getShockTimeRemaining(activeShock) : 0;

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      {/* Shock Event Controls */}
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" />
        <span className="text-sm font-semibold text-foreground">Shock Event</span>
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto h-7 px-2"
          onClick={() => setShowScenario(!showScenario)}
        >
          <Settings2 className="w-3.5 h-3.5 mr-1" />
          <span className="text-xs">Scenario</span>
        </Button>
      </div>

      {/* Active Shock Display */}
      {activeShock && !activeShock.isComplete && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {activeShock.direction === 'up' ? (
                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              <span className="text-xs font-medium text-foreground">
                ${activeShock.startPrice.toFixed(2)} → ${activeShock.targetPrice.toFixed(2)}
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => onCancelShock(productId)}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <Progress value={progress} className="h-1.5" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress.toFixed(0)}%</span>
            <span>{Math.ceil(timeRemaining)}s còn lại</span>
          </div>
        </div>
      )}

      {/* New Shock Form */}
      {(!activeShock || activeShock.isComplete) && (
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              type="number"
              placeholder={`Target ($${currentPrice.toFixed(0)})`}
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="w-20">
            <Input
              type="number"
              placeholder="Min"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="h-8 text-xs"
              min={0.5}
              step={0.5}
            />
          </div>
          <Button size="sm" className="h-8 px-3" onClick={handleSubmit}>
            <Zap className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Scenario Controls */}
      {showScenario && scenario && (
        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Trend:</span>
            <Select
              value={scenario.trend}
              onValueChange={(v) => onUpdateScenario(productId, { trend: v as ProductScenario['trend'] })}
            >
              <SelectTrigger className="h-7 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bullish">🟢 Bullish</SelectItem>
                <SelectItem value="bearish">🔴 Bearish</SelectItem>
                <SelectItem value="neutral">⚪ Neutral</SelectItem>
                <SelectItem value="volatile">🟡 Volatile</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Vol:</span>
            <Slider
              value={[scenario.volatility * 1000]}
              min={1}
              max={50}
              step={1}
              onValueChange={([v]) => onUpdateScenario(productId, { volatility: v / 1000 })}
              className="flex-1"
            />
            <span className="text-xs font-mono text-foreground w-12 text-right">
              {(scenario.volatility * 100).toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-16">Strength:</span>
            <Slider
              value={[(scenario.trendStrength ?? 0.5) * 100]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => onUpdateScenario(productId, { trendStrength: v / 100 })}
              className="flex-1"
            />
            <span className="text-xs font-mono text-foreground w-12 text-right">
              {((scenario.trendStrength ?? 0.5) * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
