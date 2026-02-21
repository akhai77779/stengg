import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { Candle } from '@/types/trading';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExportButtonProps {
  candles: Candle[];
  productName: string;
}

export function ExportButton({ candles, productName }: ExportButtonProps) {
  const exportCSV = () => {
    const header = 'Time,Open,High,Low,Close,Volume\n';
    const rows = candles.map(c =>
      `${new Date(c.time * 1000).toISOString()},${c.open},${c.high},${c.low},${c.close},${c.volume}`
    ).join('\n');
    downloadFile(header + rows, `${productName}_chart.csv`, 'text/csv');
  };

  const exportJSON = () => {
    const data = candles.map(c => ({
      time: new Date(c.time * 1000).toISOString(),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));
    downloadFile(JSON.stringify(data, null, 2), `${productName}_chart.json`, 'application/json');
  };

  const downloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 gap-1.5">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV}>Export CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={exportJSON}>Export JSON</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
