import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, TrendingDown, Zap, Timer, X } from 'lucide-react';
import { toast } from 'sonner';

interface PriceVolatilityControlProps {
  productId: string;
  productName: string;
}

interface ActiveControl {
  direction: string;
  strength: number;
  expires_at: string;
  is_active: boolean;
}

const DURATIONS = [
  { value: '1', label: '1 phút' },
  { value: '3', label: '3 phút' },
  { value: '5', label: '5 phút' },
  { value: '10', label: '10 phút' },
  { value: '15', label: '15 phút' },
  { value: '30', label: '30 phút' },
  { value: '60', label: '1 giờ' },
];

export function PriceVolatilityControl({ productId, productName }: PriceVolatilityControlProps) {
  const [direction, setDirection] = useState<'up' | 'down'>('up');
  const [strength, setStrength] = useState(5);
  const [duration, setDuration] = useState('5');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeControl, setActiveControl] = useState<ActiveControl | null>(null);
  const [remainingTime, setRemainingTime] = useState('');

  // Fetch current active control
  useEffect(() => {
    const fetchControl = async () => {
      const { data } = await supabase
        .from('product_price_controls')
        .select('direction, strength, expires_at, is_active')
        .eq('product_id', productId)
        .single();

      if (data && data.is_active && data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        if (expiresAt > new Date()) {
          setActiveControl(data);
        } else {
          // Expired, deactivate
          await supabase
            .from('product_price_controls')
            .update({ is_active: false, direction: 'neutral', strength: 1 })
            .eq('product_id', productId);
          setActiveControl(null);
        }
      } else {
        setActiveControl(null);
      }
    };

    fetchControl();

    // Poll every 5s
    const interval = setInterval(fetchControl, 5000);
    return () => clearInterval(interval);
  }, [productId]);

  // Countdown timer
  useEffect(() => {
    if (!activeControl?.expires_at) {
      setRemainingTime('');
      return;
    }

    const update = () => {
      const now = new Date().getTime();
      const end = new Date(activeControl.expires_at).getTime();
      const diff = end - now;

      if (diff <= 0) {
        setRemainingTime('Hết hạn');
        setActiveControl(null);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemainingTime(`${mins}:${secs.toString().padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [activeControl]);

  const handleActivate = async () => {
    setIsSubmitting(true);
    const expiresAt = new Date(Date.now() + parseInt(duration) * 60 * 1000).toISOString();

    const { error } = await supabase
      .from('product_price_controls')
      .upsert({
        product_id: productId,
        direction: direction,
        strength: strength,
        expires_at: expiresAt,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'product_id' });

    if (error) {
      toast.error('Lỗi kích hoạt biến động');
    } else {
      toast.success(
        `Đã kích hoạt biến động ${direction === 'up' ? '📈 TĂNG' : '📉 GIẢM'} mạnh cho ${productName} trong ${duration} phút`
      );
      setActiveControl({
        direction,
        strength,
        expires_at: expiresAt,
        is_active: true,
      });
    }
    setIsSubmitting(false);
  };

  const handleDeactivate = async () => {
    const { error } = await supabase
      .from('product_price_controls')
      .update({
        is_active: false,
        direction: 'neutral',
        strength: 1,
        expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('product_id', productId);

    if (!error) {
      toast.success('Đã tắt biến động mạnh');
      setActiveControl(null);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-3 bg-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">Điều khiển biến động</span>
        </div>
        {activeControl && (
          <Badge variant="destructive" className="gap-1 text-xs animate-pulse">
            <Timer className="w-3 h-3" />
            {remainingTime}
          </Badge>
        )}
      </div>

      {activeControl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Đang hoạt động:</span>
            <Badge variant={activeControl.direction === 'up' ? 'default' : 'destructive'} className="gap-1">
              {activeControl.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {activeControl.direction === 'up' ? 'TĂNG' : 'GIẢM'} x{activeControl.strength}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1"
            onClick={handleDeactivate}
          >
            <X className="w-3 h-3" />
            Tắt biến động
          </Button>
        </div>
      ) : (
        <>
          {/* Direction */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={direction === 'up' ? 'default' : 'outline'}
              className="flex-1 gap-1"
              onClick={() => setDirection('up')}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              Tăng mạnh
            </Button>
            <Button
              size="sm"
              variant={direction === 'down' ? 'destructive' : 'outline'}
              className="flex-1 gap-1"
              onClick={() => setDirection('down')}
            >
              <TrendingDown className="w-3.5 h-3.5" />
              Giảm mạnh
            </Button>
          </div>

          {/* Strength */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Cường độ</span>
              <span className="text-xs font-mono font-bold text-foreground">x{strength}</span>
            </div>
            <Slider
              value={[strength]}
              onValueChange={([v]) => setStrength(v)}
              min={1}
              max={10}
              step={1}
            />
          </div>

          {/* Duration */}
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">Thời gian</span>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map(d => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Activate */}
          <Button
            size="sm"
            className="w-full gap-1"
            variant={direction === 'up' ? 'default' : 'destructive'}
            onClick={handleActivate}
            disabled={isSubmitting}
          >
            <Zap className="w-3.5 h-3.5" />
            Kích hoạt {direction === 'up' ? '📈' : '📉'} trong {duration} phút
          </Button>
        </>
      )}
    </div>
  );
}
