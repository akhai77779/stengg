import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Clock, TrendingUp, TrendingDown, CheckCircle, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionTrade {
  id: string;
  user_id: string;
  product_id: string;
  direction: 'buy' | 'sell';
  amount: number;
  entry_price: number;
  duration_seconds: number;
  profit_rate: number;
  fee_rate: number;
  status: 'pending' | 'active' | 'won' | 'lost' | 'cancelled';
  admin_result: 'win' | 'lose' | null;
  started_at: string;
  expires_at: string;
  settled_at: string | null;
  exit_price: number | null;
  profit_loss: number | null;
  created_at: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  active: 'bg-blue-500/20 text-blue-500',
  won: 'bg-green-500/20 text-green-500',
  lost: 'bg-red-500/20 text-red-500',
  cancelled: 'bg-muted text-muted-foreground',
};

const statusLabels: Record<string, string> = {
  pending: 'Chờ',
  active: 'Đang chạy',
  won: 'Thắng',
  lost: 'Thua',
  cancelled: 'Đã hủy',
};

export default function AdminOptionTrades() {
  const [trades, setTrades] = useState<OptionTrade[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'settled'>('active');
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [products, setProducts] = useState<Record<string, { name: string; price: number | null }>>({});
  const { toast } = useToast();

  const fetchTrades = useCallback(async () => {
    setIsLoading(true);

    let query = supabase
      .from('option_trades')
      .select('*')
      .order('created_at', { ascending: false });

    if (filter === 'active') {
      query = query.eq('status', 'active');
    } else if (filter === 'settled') {
      query = query.in('status', ['won', 'lost']);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      console.error('Error fetching option trades:', error);
      toast({ title: 'Lỗi', description: 'Không thể tải dữ liệu', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const tradesData = (data || []) as OptionTrade[];
    setTrades(tradesData);

    // Fetch profiles and products for enrichment
    const userIds = [...new Set(tradesData.map(t => t.user_id))];
    const productIds = [...new Set(tradesData.map(t => t.product_id))];

    if (userIds.length > 0) {
      // Use profiles_safe view for security
      const { data: profilesData } = await supabase
        .from('profiles_safe')
        .select('id, full_name')
        .in('id', userIds);
      
      if (profilesData) {
        const map: Record<string, string> = {};
        profilesData.forEach(p => { map[p.id] = p.full_name || p.id.slice(0, 8); });
        setProfiles(map);
      }
    }

    if (productIds.length > 0) {
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price')
        .in('id', productIds);
      
      if (productsData) {
        const map: Record<string, { name: string; price: number | null }> = {};
        productsData.forEach(p => { map[p.id] = { name: p.name, price: p.price }; });
        setProducts(map);
      }
    }

    setIsLoading(false);
  }, [filter, toast]);

  // Auto-settle expired trades
  const autoSettleExpiredTrades = useCallback(async () => {
    // Fetch all active trades that have expired
    const { data: expiredTrades, error } = await supabase
      .from('option_trades')
      .select('id, product_id, entry_price')
      .eq('status', 'active')
      .lt('expires_at', new Date().toISOString());

    if (error || !expiredTrades || expiredTrades.length === 0) return;

    console.log(`[AdminOptionTrades] Auto-settling ${expiredTrades.length} expired trades`);

    // Get current prices for products
    const productIds = [...new Set(expiredTrades.map(t => t.product_id))];
    const { data: productsData } = await supabase
      .from('products')
      .select('id, price')
      .in('id', productIds);

    const priceMap: Record<string, number> = {};
    productsData?.forEach(p => { priceMap[p.id] = p.price ?? 0; });

    // Settle each expired trade
    for (const trade of expiredTrades) {
      const exitPrice = priceMap[trade.product_id] || trade.entry_price;
      
      const { error: settleError } = await supabase.rpc('settle_option_trade', {
        _trade_id: trade.id,
        _exit_price: exitPrice,
      });

      if (settleError) {
        console.error(`[AdminOptionTrades] Failed to settle trade ${trade.id}:`, settleError);
      } else {
        console.log(`[AdminOptionTrades] Settled trade ${trade.id}`);
      }
    }

    // Refresh the list
    fetchTrades();
    
    if (expiredTrades.length > 0) {
      toast({ 
        title: 'Đã xử lý tự động', 
        description: `${expiredTrades.length} giao dịch hết hạn đã được kết thúc` 
      });
    }
  }, [fetchTrades, toast]);

  // Initial fetch, auto-settle, and realtime subscription
  useEffect(() => {
    fetchTrades();
    autoSettleExpiredTrades();

    // Check for expired trades every 5 seconds
    const intervalId = setInterval(autoSettleExpiredTrades, 5000);

    const channel = supabase
      .channel('admin_option_trades')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'option_trades',
        },
        () => {
          fetchTrades();
        }
      )
      .subscribe();

    return () => {
      clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [fetchTrades, autoSettleExpiredTrades]);

  const handleSetResult = async (tradeId: string, result: 'win' | 'lose' | null) => {
    const { error } = await supabase
      .from('option_trades')
      .update({ admin_result: result, updated_at: new Date().toISOString() })
      .eq('id', tradeId);

    if (error) {
      toast({ title: 'Lỗi', description: 'Không thể cập nhật kết quả', variant: 'destructive' });
    } else {
      toast({ 
        title: 'Đã cập nhật', 
        description: result ? `Đặt kết quả: ${result === 'win' ? 'THẮNG' : 'THUA'}` : 'Đã xóa override'
      });
      fetchTrades();
    }
  };

  const handleForceSettle = async (trade: OptionTrade) => {
    const productInfo = products[trade.product_id];
    const exitPrice = productInfo?.price || trade.entry_price;

    const { error } = await supabase.rpc('settle_option_trade', {
      _trade_id: trade.id,
      _exit_price: exitPrice,
    });

    if (error) {
      console.error('Force settle error:', error);
      toast({ title: 'Lỗi', description: 'Không thể kết thúc giao dịch', variant: 'destructive' });
    } else {
      toast({ title: 'Đã kết thúc', description: 'Giao dịch đã được xử lý' });
      fetchTrades();
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = Date.now();
    const expires = new Date(expiresAt).getTime();
    const remaining = Math.max(0, Math.floor((expires - now) / 1000));
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return remaining > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : 'Hết giờ';
  };

  // Stats
  const activeTrades = trades.filter(t => t.status === 'active');
  const totalActiveAmount = activeTrades.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quản lý Option Trades</h1>
        <Button variant="outline" size="sm" onClick={fetchTrades}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Làm mới
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Giao dịch đang chạy</p>
                <p className="text-2xl font-bold">{activeTrades.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng tiền đang đặt</p>
                <p className="text-2xl font-bold">${totalActiveAmount.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cần can thiệp</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {activeTrades.filter(t => !t.admin_result).length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Lọc:</span>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Đang chạy</SelectItem>
            <SelectItem value="settled">Đã kết thúc</SelectItem>
            <SelectItem value="all">Tất cả</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : trades.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Không có giao dịch nào
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Người dùng</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Hướng</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Giá vào</TableHead>
                <TableHead>Thời gian</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Override</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} className={trade.status === 'active' ? 'bg-primary/5' : ''}>
                  <TableCell className="font-medium">
                    {profiles[trade.user_id] || trade.user_id.slice(0, 8)}
                  </TableCell>
                  <TableCell>{products[trade.product_id]?.name || trade.product_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <Badge variant={trade.direction === 'buy' ? 'default' : 'destructive'}>
                      {trade.direction === 'buy' ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {trade.direction === 'buy' ? 'MUA' : 'BÁN'}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">${trade.amount.toLocaleString()}</TableCell>
                  <TableCell>${trade.entry_price.toFixed(4)}</TableCell>
                  <TableCell>
                    {trade.status === 'active' ? (
                      <span className="font-mono text-blue-500">{getTimeRemaining(trade.expires_at)}</span>
                    ) : (
                      <span className="text-muted-foreground">{trade.duration_seconds}s</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[trade.status]}>
                      {statusLabels[trade.status]}
                    </Badge>
                    {trade.profit_loss !== null && (
                      <span className={cn(
                        "ml-2 text-sm font-medium",
                        trade.profit_loss >= 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {trade.profit_loss >= 0 ? '+' : ''}${trade.profit_loss.toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {trade.status === 'active' && (
                      <Select
                        value={trade.admin_result || 'none'}
                        onValueChange={(v) => handleSetResult(trade.id, v === 'none' ? null : v as 'win' | 'lose')}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue placeholder="Tự động" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Tự động</SelectItem>
                          <SelectItem value="win">
                            <span className="flex items-center gap-1 text-green-500">
                              <CheckCircle className="h-3 w-3" /> Thắng
                            </span>
                          </SelectItem>
                          <SelectItem value="lose">
                            <span className="flex items-center gap-1 text-red-500">
                              <XCircle className="h-3 w-3" /> Thua
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    {trade.admin_result && trade.status !== 'active' && (
                      <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                        Override: {trade.admin_result === 'win' ? 'Thắng' : 'Thua'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {trade.status === 'active' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleForceSettle(trade)}
                      >
                        Kết thúc ngay
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
