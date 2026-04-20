import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, PiggyBank, TrendingUp } from 'lucide-react';
import type { SavingsPackage } from './SavingsDetailDialog';

interface SavingsCardProps {
  pkg: SavingsPackage;
  onClick: () => void;
}

export function SavingsCard({ pkg, onClick }: SavingsCardProps) {
  return (
    <button onClick={onClick} className="text-left group">
      <Card className="overflow-hidden bg-card border-border hover:border-blue-500/50 transition-all active:scale-[0.98] h-full flex flex-col">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {pkg.image_url ? (
            <img src={pkg.image_url} alt={pkg.title} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-500/10 to-blue-500/5">
              <PiggyBank className="w-10 h-10 text-blue-500/60" />
            </div>
          )}
          <Badge className="absolute top-2 left-2 bg-blue-500/90 text-white border-0 text-[10px] backdrop-blur-sm">
            <PiggyBank className="w-3 h-3 mr-1" /> Tiết kiệm
          </Badge>
        </div>
        <div className="p-3 flex-1 flex flex-col">
          <h3 className="text-sm md:text-base font-bold text-foreground mb-2.5 line-clamp-2 leading-tight">
            {pkg.title}
          </h3>
          <div className="space-y-1 text-[11px] md:text-xs text-muted-foreground mt-auto">
            <div>
              Tiền tệ: <span className="text-foreground">{pkg.currency}</span>
            </div>
            <div>
              Kỳ hạn: <span className="text-foreground">{pkg.cycle_months} tháng</span>
            </div>
            <div className="flex items-end justify-between gap-2">
              <span className="leading-snug flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-success" />
                Lãi suất:{' '}
                <span className="text-success font-semibold">{pkg.interest_rate_percent}%</span>
              </span>
              <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-500/10 group-hover:bg-blue-500/20 text-blue-500 shrink-0 transition-all duration-300 group-hover:gap-1.5 group-hover:px-2.5">
                <span className="text-[10px] md:text-[11px] font-medium whitespace-nowrap">Xem thêm</span>
                <ChevronRight className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </button>
  );
}
