import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, ArrowDownToLine, ArrowUpFromLine, DollarSign, Plus, FileSpreadsheet, FileText } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const [adminSubtractedBalances, setAdminSubtractedBalances] = useState<AuditLog[]>([]);
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
    const { data: auditAddData, error: auditAddError } = await supabase
      .from('audit_logs')
      .select('id, action, details, created_at')
      .eq('entity_id', userId)
      .eq('action', 'admin_balance_add')
      .order('created_at', { ascending: false });

    if (auditAddError) {
      console.error('Error fetching audit logs (add):', auditAddError);
    } else {
      setAdminAddedBalances((auditAddData || []) as AuditLog[]);
    }

    // Fetch admin subtracted balances from audit_logs
    const { data: auditSubData, error: auditSubError } = await supabase
      .from('audit_logs')
      .select('id, action, details, created_at')
      .eq('entity_id', userId)
      .eq('action', 'admin_balance_subtract')
      .order('created_at', { ascending: false });

    if (auditSubError) {
      console.error('Error fetching audit logs (subtract):', auditSubError);
    } else {
      setAdminSubtractedBalances((auditSubData || []) as AuditLog[]);
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

  // Calculate summaries for admin subtracted balances
  const adminSubtractedSummary = {
    total: adminSubtractedBalances.reduce((sum, log) => {
      const details = log.details as { amount?: number } | null;
      return sum + (details?.amount || 0);
    }, 0),
    count: adminSubtractedBalances.length,
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

  // Net balance calculation (admin added - admin subtracted - approved withdrawals)
  const netBalance = adminAddedSummary.total - adminSubtractedSummary.total - withdrawSummary.approved;

  // Prepare data for export
  const getExportData = () => {
    const allTransactions = [
      ...adminAddedBalances.map(log => {
        const details = log.details as { amount?: number; notes?: string } | null;
        return {
          type: 'Admin cộng tiền',
          amount: details?.amount || 0,
          status: 'Đã cộng',
          notes: details?.notes || '',
          created_at: log.created_at,
          network: '',
        };
      }),
      ...adminSubtractedBalances.map(log => {
        const details = log.details as { amount?: number; notes?: string } | null;
        return {
          type: 'Admin trừ tiền',
          amount: -(details?.amount || 0),
          status: 'Đã trừ',
          notes: details?.notes || '',
          created_at: log.created_at,
          network: '',
        };
      }),
      ...withdrawTransactions.map(tx => ({
        type: 'Rút tiền',
        amount: -tx.amount,
        status: statusLabels[tx.status] || tx.status,
        notes: tx.notes || '',
        created_at: tx.created_at,
        network: tx.network || '',
      })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return allTransactions;
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = getExportData();
    
    // Create worksheet data
    const wsData = [
      ['BÁO CÁO LỊCH SỬ GIAO DỊCH'],
      [`Người dùng: ${userName} (ID: ${userCode})`],
      [`Ngày xuất: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`],
      [],
      ['Loại giao dịch', 'Số tiền ($)', 'Trạng thái', 'Mạng', 'Ghi chú', 'Thời gian'],
      ...data.map(tx => [
        tx.type,
        tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        tx.status,
        tx.network,
        tx.notes,
        format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm'),
      ]),
      [],
      ['TỔNG KẾT'],
      ['Tổng Admin cộng', formatAmount(adminAddedSummary.total)],
      ['Tổng Admin trừ', formatAmount(adminSubtractedSummary.total)],
      ['Tổng rút tiền (đã duyệt)', formatAmount(withdrawSummary.approved)],
      ['Tổng rút tiền (chờ duyệt)', formatAmount(withdrawSummary.pending)],
      ['Tổng rút tiền (từ chối)', formatAmount(withdrawSummary.rejected)],
      ['Số dư ròng', formatAmount(netBalance)],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Set column widths
    ws['!cols'] = [
      { wch: 18 },
      { wch: 15 },
      { wch: 12 },
      { wch: 10 },
      { wch: 30 },
      { wch: 18 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lịch sử giao dịch');
    
    XLSX.writeFile(wb, `lich-su-giao-dich-${userCode}-${format(new Date(), 'yyyyMMdd-HHmm')}.xlsx`);
  };

  // Export to PDF
  const handleExportPDF = () => {
    const data = getExportData();
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(16);
    doc.text('BAO CAO LICH SU GIAO DICH', 14, 20);
    
    doc.setFontSize(10);
    doc.text(`Nguoi dung: ${userName} (ID: ${userCode})`, 14, 30);
    doc.text(`Ngay xuat: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 36);
    
    // Transaction table
    const tableData = data.map(tx => [
      tx.type,
      tx.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      tx.status,
      tx.network,
      format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm'),
    ]);

    autoTable(doc, {
      head: [['Loai GD', 'So tien ($)', 'Trang thai', 'Mang', 'Thoi gian']],
      body: tableData,
      startY: 42,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Summary
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    
    doc.setFontSize(12);
    doc.text('TONG KET', 14, finalY);
    
    doc.setFontSize(10);
    doc.text(`Tong Admin cong: ${formatAmount(adminAddedSummary.total)}`, 14, finalY + 8);
    doc.text(`Tong Admin tru: ${formatAmount(adminSubtractedSummary.total)}`, 14, finalY + 14);
    doc.text(`Tong rut tien (da duyet): ${formatAmount(withdrawSummary.approved)}`, 14, finalY + 20);
    doc.text(`Tong rut tien (cho duyet): ${formatAmount(withdrawSummary.pending)}`, 14, finalY + 26);
    doc.text(`Tong rut tien (tu choi): ${formatAmount(withdrawSummary.rejected)}`, 14, finalY + 32);
    doc.text(`So du rong: ${formatAmount(netBalance)}`, 14, finalY + 38);
    
    doc.save(`lich-su-giao-dich-${userCode}-${format(new Date(), 'yyyyMMdd-HHmm')}.pdf`);
  };

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

  const AdminSubtractedList = () => (
    <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
      {adminSubtractedBalances.length === 0 ? (
        <p className="text-muted-foreground text-center py-6 text-sm">Không có giao dịch</p>
      ) : (
        adminSubtractedBalances.map((log) => {
          const details = log.details as { amount?: number; notes?: string } | null;
          const amount = details?.amount || 0;
          return (
            <div key={log.id} className="flex items-center justify-between py-3 px-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-red-500/10">
                  <ArrowUpFromLine className="w-4 h-4 text-red-500" />
                </div>
                <div>
                  <p className="font-medium text-sm">Admin trừ tiền</p>
                  <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
                  {details?.notes && (
                    <p className="text-xs text-muted-foreground italic">"{details.notes}"</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium text-red-500">
                  -{formatAmount(amount)}
                </p>
                <Badge className="text-[10px] bg-red-500/20 text-red-500">
                  Đã trừ
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
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                Lịch sử giao dịch
              </DialogTitle>
              <DialogDescription>
                {userName} (ID: {userCode})
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="text-green-600 border-green-600/50 hover:bg-green-600/10"
                disabled={adminAddedBalances.length === 0 && withdrawTransactions.length === 0}
              >
                <FileSpreadsheet className="w-4 h-4 mr-1" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="text-red-500 border-red-500/50 hover:bg-red-500/10"
                disabled={adminAddedBalances.length === 0 && withdrawTransactions.length === 0}
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF
              </Button>
            </div>
          </div>
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
                    <p className="text-sm text-muted-foreground">Tổng kết (Cộng - Trừ - Rút đã duyệt)</p>
                    <p className={`text-2xl font-bold ${netBalance >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-muted-foreground">Tổng giao dịch</p>
                    <p className="font-semibold">{adminAddedBalances.length + adminSubtractedBalances.length + withdrawTransactions.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="all" className="flex-1">
              <TabsList className="w-full bg-muted/50 mb-4">
                <TabsTrigger value="all" className="flex-1 text-xs">
                  Tất cả ({adminAddedBalances.length + adminSubtractedBalances.length + withdrawTransactions.length})
                </TabsTrigger>
                <TabsTrigger value="added" className="flex-1 text-xs">
                  Cộng ({adminAddedBalances.length})
                </TabsTrigger>
                <TabsTrigger value="subtracted" className="flex-1 text-xs">
                  Trừ ({adminSubtractedBalances.length})
                </TabsTrigger>
                <TabsTrigger value="withdraw" className="flex-1 text-xs">
                  Rút ({withdrawTransactions.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-0">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {/* Admin Added Summary */}
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Plus className="w-4 h-4 text-green-500" />
                        <h4 className="font-semibold text-sm">Cộng</h4>
                      </div>
                      <p className="font-bold text-green-500">
                        +{formatAmount(adminAddedSummary.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">{adminAddedSummary.count} GD</p>
                    </CardContent>
                  </Card>

                  {/* Admin Subtracted Summary */}
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowUpFromLine className="w-4 h-4 text-red-500" />
                        <h4 className="font-semibold text-sm">Trừ</h4>
                      </div>
                      <p className="font-bold text-red-500">
                        -{formatAmount(adminSubtractedSummary.total)}
                      </p>
                      <p className="text-xs text-muted-foreground">{adminSubtractedSummary.count} GD</p>
                    </CardContent>
                  </Card>

                  {/* Withdraw Summary */}
                  <Card>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <ArrowUpFromLine className="w-4 h-4 text-orange-500" />
                        <h4 className="font-semibold text-sm">Rút</h4>
                      </div>
                      <p className="font-bold text-orange-500">
                        -{formatAmount(withdrawSummary.approved)}
                      </p>
                      <p className="text-xs text-muted-foreground">{withdrawSummary.count} GD</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Combined list sorted by date */}
                <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                  {adminAddedBalances.length === 0 && adminSubtractedBalances.length === 0 && withdrawTransactions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-6 text-sm">Không có giao dịch</p>
                  ) : (
                    [...adminAddedBalances.map(log => ({
                      id: log.id,
                      type: 'admin_add' as const,
                      amount: (log.details as { amount?: number } | null)?.amount || 0,
                      notes: (log.details as { notes?: string } | null)?.notes,
                      created_at: log.created_at,
                      status: 'approved'
                    })), ...adminSubtractedBalances.map(log => ({
                      id: log.id,
                      type: 'admin_subtract' as const,
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
                            <div className={`p-2 rounded-full ${
                              item.type === 'admin_add' ? 'bg-green-500/10' : 
                              item.type === 'admin_subtract' ? 'bg-red-500/10' : 'bg-muted'
                            }`}>
                              {item.type === 'admin_add' ? (
                                <Plus className="w-4 h-4 text-green-500" />
                              ) : item.type === 'admin_subtract' ? (
                                <ArrowUpFromLine className="w-4 h-4 text-red-500" />
                              ) : (
                                <ArrowUpFromLine className="w-4 h-4 text-orange-500" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-sm">
                                {item.type === 'admin_add' ? 'Admin cộng tiền' : 
                                 item.type === 'admin_subtract' ? 'Admin trừ tiền' : 'Rút tiền'}
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
                            <p className={`font-medium ${
                              item.type === 'admin_add' ? 'text-green-500' : 
                              item.type === 'admin_subtract' ? 'text-red-500' : 'text-orange-500'
                            }`}>
                              {item.type === 'admin_add' ? '+' : '-'}{formatAmount(item.amount)}
                            </p>
                            <Badge className={`text-[10px] ${
                              item.type === 'admin_add' ? 'bg-green-500/20 text-green-500' : 
                              item.type === 'admin_subtract' ? 'bg-red-500/20 text-red-500' : 
                              statusColors[item.status]
                            }`}>
                              {item.type === 'admin_add' ? 'Đã cộng' : 
                               item.type === 'admin_subtract' ? 'Đã trừ' : statusLabels[item.status]}
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

              <TabsContent value="subtracted" className="mt-0">
                <Card className="mb-4">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowUpFromLine className="w-5 h-5 text-red-500" />
                      <h4 className="font-semibold">Admin trừ tiền</h4>
                      <Badge variant="outline" className="ml-auto">{adminSubtractedSummary.count} giao dịch</Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Tổng trừ</p>
                      <p className="font-bold text-lg text-red-500">
                        -{formatAmount(adminSubtractedSummary.total)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <AdminSubtractedList />
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