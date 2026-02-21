import { Button } from '@/components/ui/button';
import { TimeInterval } from '@/types/trading';

const INTERVALS: { label: string; value: TimeInterval }[] = [
  { label: '1M', value: '1M' },
  { label: '5M', value: '5M' },
  { label: '15M', value: '15M' },
  { label: '30M', value: '30M' },
  { label: '1H', value: '1H' },
  { label: '1D', value: '1D' },
];

interface TimeIntervalSelectorProps {
  value: TimeInterval;
  onChange: (interval: TimeInterval) => void;
}

export function TimeIntervalSelector({ value, onChange }: TimeIntervalSelectorProps) {
  return (
    <div className="flex gap-1">
      {INTERVALS.map((interval) => (
        <Button
          key={interval.value}
          size="sm"
          variant={value === interval.value ? 'default' : 'outline'}
          className="h-7 px-2.5 text-xs font-mono"
          onClick={() => onChange(interval.value)}
        >
          {interval.label}
        </Button>
      ))}
    </div>
  );
}
