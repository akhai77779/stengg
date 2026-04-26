import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Loader2, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';

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
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { formatCurrency } = useCurrency();

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

    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)
      .in('type', ['deposit', 'withdraw'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transactions:', error);
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

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const TransactionList = ({ items }: { items: Transaction[] }) => (
    <div className="divide-y divide-border overflow-hidden rounded-md border border-border/60">
      {items.length === 0 ? (
        <p className="text-muted-foreground text-center px-3 py-8 text-sm">{t('transaction.noTransactions')}</p>
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

  return (
    <Card className="bg-card border-border">
      <CardHeader className="px-3 pb-2 pt-4 md:px-4">
        <CardTitle className="text-base md:text-lg">{t('profile.depositWithdraw')}</CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-4 md:px-4">
        <TransactionList items={depositWithdrawTransactions} />
      </CardContent>
    </Card>
  );
}