import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Settings2 } from 'lucide-react';

export interface IndicatorConfig {
  ma: {
    enabled: boolean;
    period: number;
    color: string;
  };
  ema: {
    enabled: boolean;
    period: number;
    color: string;
  };
}

interface ChartIndicatorsProps {
  config: IndicatorConfig;
  onChange: (config: IndicatorConfig) => void;
}

export const defaultIndicatorConfig: IndicatorConfig = {
  ma: { enabled: true, period: 20, color: '#3b82f6' },
  ema: { enabled: true, period: 12, color: '#f59e0b' },
};

export const ChartIndicators = ({ config, onChange }: ChartIndicatorsProps) => {
  const [localConfig, setLocalConfig] = useState<IndicatorConfig>(config);

  const handleToggle = (indicator: 'ma' | 'ema', enabled: boolean) => {
    const newConfig = {
      ...localConfig,
      [indicator]: { ...localConfig[indicator], enabled },
    };
    setLocalConfig(newConfig);
    onChange(newConfig);
  };

  const handlePeriodChange = (indicator: 'ma' | 'ema', value: string) => {
    const period = Math.max(1, Math.min(200, parseInt(value) || 1));
    const newConfig = {
      ...localConfig,
      [indicator]: { ...localConfig[indicator], period },
    };
    setLocalConfig(newConfig);
  };

  const handlePeriodBlur = () => {
    onChange(localConfig);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 px-2"
        >
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Indicators</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Chỉ báo kỹ thuật</h4>
          
          {/* MA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: config.ma.color }} 
                />
                <Label htmlFor="ma-toggle" className="text-sm font-medium">
                  MA (Simple)
                </Label>
              </div>
              <Switch
                id="ma-toggle"
                checked={localConfig.ma.enabled}
                onCheckedChange={(checked) => handleToggle('ma', checked)}
              />
            </div>
            {localConfig.ma.enabled && (
              <div className="flex items-center gap-2 pl-5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  Period:
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={localConfig.ma.period}
                  onChange={(e) => handlePeriodChange('ma', e.target.value)}
                  onBlur={handlePeriodBlur}
                  className="h-7 w-16 text-xs"
                />
              </div>
            )}
          </div>
          
          {/* EMA */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: config.ema.color }} 
                />
                <Label htmlFor="ema-toggle" className="text-sm font-medium">
                  EMA (Exponential)
                </Label>
              </div>
              <Switch
                id="ema-toggle"
                checked={localConfig.ema.enabled}
                onCheckedChange={(checked) => handleToggle('ema', checked)}
              />
            </div>
            {localConfig.ema.enabled && (
              <div className="flex items-center gap-2 pl-5">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">
                  Period:
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={localConfig.ema.period}
                  onChange={(e) => handlePeriodChange('ema', e.target.value)}
                  onBlur={handlePeriodBlur}
                  className="h-7 w-16 text-xs"
                />
              </div>
            )}
          </div>
          
          {/* Legend when indicators active */}
          {(localConfig.ma.enabled || localConfig.ema.enabled) && (
            <div className="pt-2 border-t border-border text-xs text-muted-foreground">
              {localConfig.ma.enabled && (
                <div className="flex items-center gap-2">
                  <span style={{ color: localConfig.ma.color }}>━━</span>
                  <span>MA({localConfig.ma.period})</span>
                </div>
              )}
              {localConfig.ema.enabled && (
                <div className="flex items-center gap-2">
                  <span style={{ color: localConfig.ema.color }}>━━</span>
                  <span>EMA({localConfig.ema.period})</span>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
