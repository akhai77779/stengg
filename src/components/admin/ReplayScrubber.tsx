import { useCallback, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, SkipBack, SkipForward, Rewind, FastForward } from 'lucide-react';

interface ReplayScrubberProps {
  totalCandles: number;
  displayIndex: number;
  windowSize: number;
  isPlaying: boolean;
  speed: number;
  onIndexChange: (index: number) => void;
  onPlayPause: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEED_OPTIONS = [1, 2, 5, 10, 30];

export function ReplayScrubber({
  totalCandles,
  displayIndex,
  windowSize,
  isPlaying,
  speed,
  onIndexChange,
  onPlayPause,
  onSpeedChange,
}: ReplayScrubberProps) {
  const minIndex = Math.min(windowSize, totalCandles);
  const progress = totalCandles > minIndex ? ((displayIndex - minIndex) / (totalCandles - minIndex)) * 100 : 0;

  const handleSliderChange = useCallback((value: number[]) => {
    const ratio = value[0] / 100;
    const newIndex = Math.round(minIndex + ratio * (totalCandles - minIndex));
    onIndexChange(Math.max(minIndex, Math.min(totalCandles, newIndex)));
  }, [minIndex, totalCandles, onIndexChange]);

  const handleSkipBack = useCallback(() => {
    onIndexChange(minIndex);
  }, [minIndex, onIndexChange]);

  const handleSkipForward = useCallback(() => {
    onIndexChange(totalCandles);
  }, [totalCandles, onIndexChange]);

  const handleStepBack = useCallback(() => {
    onIndexChange(Math.max(minIndex, displayIndex - 10));
  }, [minIndex, displayIndex, onIndexChange]);

  const handleStepForward = useCallback(() => {
    onIndexChange(Math.min(totalCandles, displayIndex + 10));
  }, [totalCandles, displayIndex, onIndexChange]);

  const cycleSpeed = useCallback(() => {
    const currentIdx = SPEED_OPTIONS.indexOf(speed);
    const nextIdx = (currentIdx + 1) % SPEED_OPTIONS.length;
    onSpeedChange(SPEED_OPTIONS[nextIdx]);
  }, [speed, onSpeedChange]);

  if (totalCandles <= minIndex) return null;

  return (
    <div className="px-3 pb-2">
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border">
        {/* Skip to start */}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSkipBack} title="Về đầu">
          <SkipBack className="h-3.5 w-3.5" />
        </Button>

        {/* Step back 10 */}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleStepBack} title="Lùi 10 nến">
          <Rewind className="h-3.5 w-3.5" />
        </Button>

        {/* Play/Pause */}
        <Button size="icon" variant="outline" className="h-8 w-8" onClick={onPlayPause}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>

        {/* Step forward 10 */}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleStepForward} title="Tiến 10 nến">
          <FastForward className="h-3.5 w-3.5" />
        </Button>

        {/* Skip to end */}
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSkipForward} title="Về cuối">
          <SkipForward className="h-3.5 w-3.5" />
        </Button>

        {/* Slider */}
        <div className="flex-1 mx-2">
          <Slider
            value={[progress]}
            onValueChange={handleSliderChange}
            max={100}
            step={0.5}
            className="cursor-pointer"
          />
        </div>

        {/* Position indicator */}
        <span className="text-xs text-muted-foreground font-mono tabular-nums min-w-[70px] text-right">
          {displayIndex}/{totalCandles}
        </span>

        {/* Speed control */}
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs font-mono min-w-[40px]"
          onClick={cycleSpeed}
          title="Tốc độ phát lại"
        >
          {speed}x
        </Button>
      </div>
    </div>
  );
}
