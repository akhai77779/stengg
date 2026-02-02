import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, DollarSign, Plus } from 'lucide-react';
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

interface AuditLog {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
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
  const [withdrawTransactions, setWithdrawTransactions] = useState<Transaction[]>([]);
  const [adminAddedBalances, setAdminAddedBalances] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && userId) {
      fetchData();
    }
  }, [open, userId]);

  const fetchData = async () => {
    setIsLoading(true);
    
    // Fetch withdraw transactions
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'withdraw')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
    } else {
      setWithdrawTransactions(txData || []);
    }

    // Fetch admin added balances from audit_logs
    const { data: auditData, error: auditError } = await supabase
      .from('audit_logs')
      .select('id, action, details, created_at')
      .eq('entity_id', userId)
      .eq('action', 'admin_add_balance')
      .order('created_at', { ascending: false });

    if (auditError) {
      console.error('Error fetching audit logs:', auditError);
    } else {
      setAdminAddedBalances((auditData || []) as AuditLog[]);
    }

    setIsLoading(false);
  };

  // Calculate summaries for admin added balances
  const adminAddedSummary = {
    total: adminAddedBalances.reduce((sum, log) => {
      const details = log.details as { amount?: number } | null;
      return sum + (details?.amount || 0);
    }, 0),
    count: adminAddedBalances.length,
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

  // Net balance calculation (admin added - approved withdrawals)
  const netBalance = adminAddedSummary.total - withdrawSummary.approved;

  const AdminAddedList = () => (
    <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
      {adminAddedBalances.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">Không có giao dịch</p>
      ) : (
        adminAddedBalances.map((log) => {
          const details = log.details as { amount?: number; notes?: string } | null;
          const amount = details?.amount || 0;
          return (
            <div key={log.id} className="flex items-center justify-between py-3 px-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-green-500/10">
                  <Plus className="w-4 h-4 text-green-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Admin cộng tiền</p>
                  <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  {details?.notes && (
                    <p className="text-xs text-muted-foreground italic">"{details.notes}"</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-green-500">
                  +{formatAmount(amount)}
                </p>
                <Badge className="text-[10px] bg-green-500/20 text-green-500">
                  Đã cộng
                </Badge>
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const WithdrawList = () => (
    <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
      {withdrawTransactions.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">Không có giao dịch</p>
      ) : (
        withdrawTransactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between py-3 px-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-muted">
                <ArrowUpFromLine className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="font-medium text-sm">Rút tiền</p>
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
              <p className="font-medium text-orange-500">
                -{formatAmount(tx.amount)}
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
                    <p className="text-sm text-muted-foreground">Tổng kết (Admin cộng - Rút đã duyệt)</p>
                    <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Tổng giao dịch</p>
                    <p className="font-semibold">{adminAddedBalances.length + withdrawTransactions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="all" className="flex-1">
              <TabsList className="w-full bg-muted/50 mb-4">
                <TabsTrigger value="all" className="flex-1">
                  Tất cả ({adminAddedBalances.length + withdrawTransactions.length})
                </TabsTrigger>
                <TabsTrigger value="added" className="flex-1">
                  Admin cộng ({adminAddedBalances.length})
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="flex-1">
                  Rút tiền ({withdrawTransactions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Admin Added Summary */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Plus className="w-5 h-5 text-green-500" />
                        <h4 className="font-semibold">Admin cộng</h4>
                        <Badge variant="outline" className="ml-auto">{adminAddedSummary.count} giao dịch</Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Tổng cộng</p>
                        <p className="font-bold text-lg text-green-500">
                          {formatAmount(adminAddedSummary.total)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Withdraw Summary */}
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <ArrowUpFromLine className="w-5 h-5 text-orange-500" />
                        <h4 className="font-semibold">Rút tiền</h4>
                        <Badge variant="outline" className="ml-auto">{withdrawSummary.count} giao dịch</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Tổng</p>
                          <p className="font-semibold text-orange-500">{formatAmount(withdrawSummary.total)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Đã duyệt</p>
                          <p className="font-semibold text-green-500">{formatAmount(withdrawSummary.approved)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Chờ duyệt</p>
                          <p className="font-semibold text-yellow-500">{formatAmount(withdrawSummary.pending)}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">Từ chối</p>
                          <p className="font-semibold text-red-500">{formatAmount(withdrawSummary.rejected)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Combined list sorted by date */}
                <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                  {adminAddedBalances.length === 0 && withdrawTransactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6 text-sm">Không có giao dịch</p>
                  ) : (
                    [...adminAddedBalances.map(log => ({
                      id: log.id,
                      type: 'admin_add' as const,
                      amount: (log.details as { amount?: number } | null)?.amount || 0,
                      notes: (log.details as { notes?: string } | null)?.notes,
                      created_at: log.created_at,
                      status: 'approved'
                    })), ...withdrawTransactions.map(tx => ({
                      id: tx.id,
                      type: 'withdraw' as const,
                      amount: tx.amount,
                      notes: tx.notes,
                      created_at: tx.created_at,
                      status: tx.status,
                      network: tx.network
                    }))]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((item) => (
                        <div key={item.id} className="flex items-center justify-between py-3 px-2">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${item.type === 'admin_add' ? 'bg-green-500/10' : 'bg-muted'}`}>
                              {item.type === 'admin_add' ? (
                                <Plus className="w-4 h-4 text-green-500" />
                              ) : (
                                <ArrowUpFromLine className="w-4 h-4 text-orange-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {item.type === 'admin_add' ? 'Admin cộng tiền' : 'Rút tiền'}
                              </p>
                              <p className="text-xs text-muted-foreground">{formatDate(item.created_at)}</p>
                              {'network' in item && item.network && (
                                <p className="text-xs text-muted-foreground">Mạng: {item.network}</p>
                              )}
                              {item.notes && (
                                <p className="text-xs text-muted-foreground italic">"{item.notes}"</p>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${item.type === 'admin_add' ? 'text-green-500' : 'text-orange-500'}`}>
                              {item.type === 'admin_add' ? '+' : '-'}{formatAmount(item.amount)}
                            </p>
                            <Badge className={`text-[10px] ${item.type === 'admin_add' ? 'bg-green-500/20 text-green-500' : statusColors[item.status]}`}>
                              {item.type === 'admin_add' ? 'Đã cộng' : statusLabels[item.status]}
                            </Badge>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </TabsContent>

              <TabsContent value="added" className="mt-0">
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Plus className="w-5 h-5 text-green-500" />
                      <h4 className="font-semibold">Admin cộng tiền</h4>
                      <Badge variant="outline" className="ml-auto">{adminAddedSummary.count} giao dịch</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Tổng cộng</p>
                      <p className="font-bold text-lg text-green-500">
                        {formatAmount(adminAddedSummary.total)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <AdminAddedList />
              </TabsContent>

              <TabsContent value="withdraw" className="mt-0">
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowUpFromLine className="w-5 h-5 text-orange-500" />
                      <h4 className="font-semibold">Rút tiền</h4>
                      <Badge variant="outline" className="ml-auto">{withdrawSummary.count} giao dịch</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Tổng cộng</p>
                        <p className="font-bold text-lg text-orange-500">
                          {formatAmount(withdrawSummary.total)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Đã duyệt</p>
                        <p className="font-semibold text-green-500">{formatAmount(withdrawSummary.approved)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Chờ duyệt</p>
                        <p className="font-semibold text-yellow-500">{formatAmount(withdrawSummary.pending)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-muted-foreground">Từ chối</p>
                        <p className="font-semibold text-red-500">{formatAmount(withdrawSummary.rejected)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <WithdrawList />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}