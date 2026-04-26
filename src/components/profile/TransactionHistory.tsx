import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { ArrowDownToLine, ArrowUpFromLine, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  approved: 'bg-green-500/20 text-green-500',
  rejected: 'bg-red-500/20 text-red-500',
};

export function TransactionHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();

  const emptyStateCopy = language === 'vi'
    ? {
        title: 'Chưa có giao dịch nạp/rút',
        description: 'Các giao dịch nạp tiền và rút tiền của bạn sẽ xuất hiện tại đây sau khi được tạo.',
      }
    : {
        title: 'No deposit or withdrawal history yet',
        description: 'Your deposit and withdrawal transactions will appear here once they are created.',
      };

  const errorStateCopy = language === 'vi'
    ? {
        title: 'Không thể tải lịch sử giao dịch',
        description: 'Vui lòng kiểm tra kết nối và thử lại.',
        retry: 'Thử lại',
      }
    : {
        title: 'Could not load transaction history',
        description: 'Please check your connection and try again.',
        retry: 'Retry',
      };

  const statusLabels: Record<string, string> = {
    pending: t('transaction.pending'),
    approved: t('transaction.approved'),
    rejected: t('transaction.rejected'),
  };

  const dateLocales: Record<string, string> = {
    vi: 'vi-VN',
    en: 'en-US',
    zh: 'zh-CN',
    th: 'th-TH',
    ja: 'ja-JP',
    ko: 'ko-KR',
    id: 'id-ID',
    ms: 'ms-MY',
  };

  useEffect(() => {
    if (user) {
      fetchTransactions();
      
      // Subscribe to realtime updates
      const channel = supabase
        .channel('user-transactions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'transactions',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            fetchTransactions();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchTransactions = async () => {
    if (!user) return;

    setIsLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['deposit', 'withdraw'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
      setErrorMessage(error.message || errorStateCopy.description);
    } else {
      setTransactions(data || []);
    }
    setIsLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(dateLocales[language] || 'vi-VN');
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return t('transaction.deposit');
      case 'withdraw':
        return t('transaction.withdraw');
      default:
        return type;
    }
  };

  const depositWithdrawTransactions = transactions.filter(tx => tx.type === 'deposit' || tx.type === 'withdraw');

  const TransactionSkeleton = () => (
    <div className="divide-y divide-border overflow-hidden rounded-md border border-border/60">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex min-h-[76px] flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between md:p-4">
          <div className="flex min-w-0 items-start gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40 max-w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:block sm:min-w-28 sm:space-y-2 sm:text-right">
            <Skeleton className="h-4 w-24 sm:ml-auto" />
            <Skeleton className="h-5 w-16 rounded-full sm:ml-auto" />
          </div>
        </div>
      ))}
    </div>
  );

  const TransactionList = ({ items }: { items: Transaction[] }) => (
    <div className="divide-y divide-border overflow-hidden rounded-md border border-border/60">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">
            <Inbox className="h-6 w-6" />
          </div>
          <p className="text-sm font-medium text-foreground">{emptyStateCopy.title}</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            {emptyStateCopy.description}
          </p>
        </div>
      ) : (
        items.map((tx) => (
          <div key={tx.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between md:p-4">
            <div className="flex min-w-0 items-start gap-3">
              <div className="shrink-0 p-2 rounded-full bg-muted">
                {getIcon(tx.type)}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm">{getTypeLabel(tx.type)}</p>
                <p className="text-xs text-muted-foreground break-words">{formatDate(tx.created_at)}</p>
                {tx.network && (
                  <p className="text-xs text-muted-foreground break-words">{t('transaction.network')}: {tx.network}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
              <p className={`font-medium text-sm md:text-base ${tx.type === 'deposit' ? 'text-green-500' : 'text-red-500'}`}>
                {tx.type === 'deposit' ? '+' : '-'}{formatCurrency(tx.amount)}
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

  const ErrorState = () => (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
      <div className="mb-3 rounded-full bg-background p-3 text-destructive">
        <AlertCircle className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium text-foreground">{errorStateCopy.title}</p>
      <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
        {errorMessage || errorStateCopy.description}
      </p>
      <Button type="button" variant="outline" size="sm" onClick={fetchTransactions} className="mt-4 gap-2">
        <RefreshCw className="h-4 w-4" />
        {errorStateCopy.retry}
      </Button>
    </div>
  );

  return (
    <Card className="bg-card border-border">
      <CardHeader className="px-3 pb-2 pt-4 md:px-4">
        <CardTitle className="text-base md:text-lg">{t('profile.depositWithdraw')}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4 md:px-4">
        {isLoading ? <TransactionSkeleton /> : errorMessage ? <ErrorState /> : <TransactionList items={depositWithdrawTransactions} />}
      </CardContent>
    </Card>
  );
}