import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, CheckCircle, XCircle, Clock, Eye } from 'lucide-react';
interface Transaction {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  status: string;
  network: string | null;
  wallet_address: string | null;
  tx_hash: string | null;
  notes: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
  } | null;
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

const typeLabels: Record<string, string> = {
  deposit: 'Nạp tiền',
  withdraw: 'Rút tiền',
  buy: 'Mua',
  sell: 'Bán',
};

export function DashboardTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    // Fetch transactions
    const { data: txData, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      setIsLoading(false);
      return;
    }

    // Fetch profiles for unique user_ids - using profiles_safe view for security
    const userIds = [...new Set(txData?.map(tx => tx.user_id) || [])];
    const { data: profilesData } = await supabase
      .from('profiles_safe')
      .select('id, full_name')
      .in('id', userIds);

    // Map profiles to transactions
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const transactionsWithProfiles = txData?.map(tx => ({
      ...tx,
      profiles: profilesMap.get(tx.user_id) || null
    })) || [];

    setTransactions(transactionsWithProfiles);
    setIsLoading(false);
  };

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setAdminNotes(transaction.notes || '');
    setShowDialog(true);
  };

  const handleApprove = async () => {
    if (!selectedTransaction || !user) return;
    setIsProcessing(true);

    try {
      // Use secure server-side RPC function for atomic transaction processing
      const rpcFunction = selectedTransaction.type === 'deposit' 
        ? 'admin_approve_deposit'
        : 'admin_approve_withdrawal';
      
      const { data, error } = await supabase.rpc(rpcFunction, {
        _admin_id: user.id,
        _transaction_id: selectedTransaction.id,
        _notes: adminNotes || null
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        toast({
          title: 'Lỗi',
          description: result.error || 'Không thể duyệt giao dịch',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      toast({
        title: 'Thành công',
        description: 'Giao dịch đã được duyệt',
      });
      setShowDialog(false);
      fetchTransactions();
    } catch (error) {
      console.error('Error approving transaction:', error);
      toast({
        title: 'Lỗi',
        description: error instanceof Error ? error.message : 'Không thể duyệt giao dịch',
        variant: 'destructive',
      });
    }
    setIsProcessing(false);
  };

  const handleReject = async () => {
    if (!selectedTransaction || !user) return;
    setIsProcessing(true);

    try {
      // Use secure server-side RPC function for atomic rejection
      const { data, error } = await supabase.rpc('admin_reject_transaction', {
        _admin_id: user.id,
        _transaction_id: selectedTransaction.id,
        _notes: adminNotes || null
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };

      if (!result.success) {
        toast({
          title: 'Lỗi',
          description: result.error || 'Không thể từ chối giao dịch',
          variant: 'destructive',
        });
        setIsProcessing(false);
        return;
      }

      toast({
        title: 'Thành công',
        description: 'Giao dịch đã bị từ chối',
      });
      setShowDialog(false);
      fetchTransactions();
    } catch (error) {
      console.error('Error rejecting transaction:', error);
      toast({
        title: 'Lỗi',
        description: error instanceof Error ? error.message : 'Không thể từ chối giao dịch',
        variant: 'destructive',
      });
    }
    setIsProcessing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('vi-VN');
  };

  if (isLoading) {
    return (
      <Card className="bg-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Quản lý Giao dịch Nạp/Rút tiền</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Chưa có giao dịch nào</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Loại</TableHead>
                  <TableHead>Số tiền</TableHead>
                  <TableHead>Mạng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">
                      {tx.profiles?.full_name || tx.user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={tx.type === 'deposit' ? 'text-green-500' : 'text-orange-500'}>
                        {typeLabels[tx.type] || tx.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(tx.amount)}</TableCell>
                    <TableCell className="text-muted-foreground">{tx.network || '-'}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[tx.status]}>
                        {statusLabels[tx.status] || tx.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(tx.created_at)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(tx)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Chi tiết
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chi tiết giao dịch</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Người dùng</p>
                  <p className="font-medium">{selectedTransaction.profiles?.full_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Loại giao dịch</p>
                  <p className="font-medium">{typeLabels[selectedTransaction.type]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Số tiền</p>
                  <p className="font-medium text-primary">{formatCurrency(selectedTransaction.amount)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mạng</p>
                  <p className="font-medium">{selectedTransaction.network || 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Địa chỉ ví</p>
                  <p className="font-mono text-xs break-all">{selectedTransaction.wallet_address || 'N/A'}</p>
                </div>
                {selectedTransaction.tx_hash && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">TX Hash</p>
                    <p className="font-mono text-xs break-all">{selectedTransaction.tx_hash}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Trạng thái</p>
                  <Badge className={statusColors[selectedTransaction.status]}>
                    {statusLabels[selectedTransaction.status]}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Thời gian</p>
                  <p className="font-medium text-sm">{formatDate(selectedTransaction.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground mb-2">Ghi chú admin</p>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Nhập ghi chú..."
                  disabled={selectedTransaction.status !== 'pending'}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {selectedTransaction?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={handleReject}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Từ chối
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                  Duyệt
                </Button>
              </>
            )}
            {selectedTransaction?.status !== 'pending' && (
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Đóng
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
