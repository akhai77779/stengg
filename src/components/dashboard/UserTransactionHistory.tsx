import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  status: string;
  network: string | null;
  wallet_address: string | null;
  notes: string | null;
  created_at: string;
}

interface UserTransactionHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  userCode: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  approved: 'bg-green-500/20 text-green-500',
  rejected: 'bg-red-500/20 text-red-500',
};

const statusLabels: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

export function UserTransactionHistory({
  open,
  onOpenChange,
  userId,
  userName,
  userCode,
}: UserTransactionHistoryProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchTransactions();
    }
  }, [open, userId]);

  const fetchTransactions = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
    } else {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const depositTransactions = transactions.filter(tx => tx.type === 'deposit');
  const withdrawTransactions = transactions.filter(tx => tx.type === 'withdraw');

  // Calculate summaries
  const depositSummary = {
    total: depositTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    approved: depositTransactions.filter(tx => tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0),
    pending: depositTransactions.filter(tx => tx.status === 'pending').reduce((sum, tx) => sum + tx.amount, 0),
    rejected: depositTransactions.filter(tx => tx.status === 'rejected').reduce((sum, tx) => sum + tx.amount, 0),
    count: depositTransactions.length,
  };

  const withdrawSummary = {
    total: withdrawTransactions.reduce((sum, tx) => sum + tx.amount, 0),
    approved: withdrawTransactions.filter(tx => tx.status === 'approved').reduce((sum, tx) => sum + tx.amount, 0),
    pending: withdrawTransactions.filter(tx => tx.status === 'pending').reduce((sum, tx) => sum + tx.amount, 0),
    rejected: withdrawTransactions.filter(tx => tx.status === 'rejected').reduce((sum, tx) => sum + tx.amount, 0),
    count: withdrawTransactions.length,
  };

  const formatAmount = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm');
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownToLine className="w-4 h-4 text-green-500" />;
      case 'withdraw':
        return <ArrowUpFromLine className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  const TransactionList = ({ items }: { items: Transaction[] }) => (
    <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">Không có giao dịch</p>
      ) : (
        items.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between py-3 px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                {getIcon(tx.type)}
              </div>
              <div>
                <p className="font-medium text-sm">
                  {tx.type === 'deposit' ? 'Nạp tiền' : 'Rút tiền'}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                {tx.network && (
                  <p className="text-xs text-muted-foreground">Mạng: {tx.network}</p>
                )}
                {tx.notes && (
                  <p className="text-xs text-muted-foreground italic">"{tx.notes}"</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`font-medium ${tx.type === 'deposit' ? 'text-green-500' : 'text-orange-500'}`}>
                {tx.type === 'deposit' ? '+' : '-'}{formatAmount(tx.amount)}
              </p>
              <Badge className={`text-[10px] ${statusColors[tx.status]}`}>
                {statusLabels[tx.status]}
              </Badge>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const SummaryCard = ({ title, summary, type }: { 
    title: string; 
    summary: typeof depositSummary;
    type: 'deposit' | 'withdraw';
  }) => (
    <Card className="mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          {type === 'deposit' ? (
            <ArrowDownToLine className="w-5 h-5 text-green-500" />
          ) : (
            <ArrowUpFromLine className="w-5 h-5 text-orange-500" />
          )}
          <h4 className="font-semibold">{title}</h4>
          <Badge variant="outline" className="ml-auto">{summary.count} giao dịch</Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground">Tổng cộng</p>
            <p className={`font-bold text-lg ${type === 'deposit' ? 'text-green-500' : 'text-orange-500'}`}>
              {formatAmount(summary.total)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Đã duyệt</p>
            <p className="font-semibold text-green-500">{formatAmount(summary.approved)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Chờ duyệt</p>
            <p className="font-semibold text-yellow-500">{formatAmount(summary.pending)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">Từ chối</p>
            <p className="font-semibold text-red-500">{formatAmount(summary.rejected)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Net balance calculation (approved deposits - approved withdrawals)
  const netBalance = depositSummary.approved - withdrawSummary.approved;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Lịch sử giao dịch
          </DialogTitle>
          <DialogDescription>
            {userName} (ID: {userCode})
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {/* Net Balance Summary */}
            <Card className="mb-4 bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Tổng kết (Nạp đã duyệt - Rút đã duyệt)</p>
                    <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Tổng giao dịch</p>
                    <p className="font-semibold">{transactions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="all" className="flex-1">
              <TabsList className="w-full bg-muted/50 mb-4">
                <TabsTrigger value="all" className="flex-1">
                  Tất cả ({transactions.length})
                </TabsTrigger>
                <TabsTrigger value="deposit" className="flex-1">
                  Nạp tiền ({depositTransactions.length})
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="flex-1">
                  Rút tiền ({withdrawTransactions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <SummaryCard title="Nạp tiền" summary={depositSummary} type="deposit" />
                  <SummaryCard title="Rút tiền" summary={withdrawSummary} type="withdraw" />
                </div>
                <TransactionList items={transactions.filter(tx => tx.type === 'deposit' || tx.type === 'withdraw')} />
              </TabsContent>

              <TabsContent value="deposit" className="mt-0">
                <SummaryCard title="Nạp tiền" summary={depositSummary} type="deposit" />
                <TransactionList items={depositTransactions} />
              </TabsContent>

              <TabsContent value="withdraw" className="mt-0">
                <SummaryCard title="Rút tiền" summary={withdrawSummary} type="withdraw" />
                <TransactionList items={withdrawTransactions} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
