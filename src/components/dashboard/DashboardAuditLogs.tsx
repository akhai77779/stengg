import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Search, Filter, Eye, RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
import { Json } from '@/integrations/supabase/types';
import { exportToCSV, exportToPDF } from '@/lib/exportAuditLogs';

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Json | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: {
    id: string;
    full_name: string | null;
  } | null;
}

const actionColors: Record<string, string> = {
  trade_completed: 'bg-green-500/20 text-green-500',
  trade_failed: 'bg-red-500/20 text-red-500',
  trade_error: 'bg-red-500/20 text-red-500',
  withdrawal_requested: 'bg-blue-500/20 text-blue-500',
  withdrawal_failed: 'bg-red-500/20 text-red-500',
  withdrawal_error: 'bg-red-500/20 text-red-500',
  deposit_approved: 'bg-green-500/20 text-green-500',
  deposit_rejected: 'bg-red-500/20 text-red-500',
  withdrawal_approved: 'bg-green-500/20 text-green-500',
  withdrawal_rejected: 'bg-red-500/20 text-red-500',
  rate_limit_exceeded: 'bg-yellow-500/20 text-yellow-500',
};

const actionLabels: Record<string, string> = {
  trade_completed: 'Giao dịch thành công',
  trade_failed: 'Giao dịch thất bại',
  trade_error: 'Lỗi giao dịch',
  withdrawal_requested: 'Yêu cầu rút tiền',
  withdrawal_failed: 'Rút tiền thất bại',
  withdrawal_error: 'Lỗi rút tiền',
  withdrawal_approved: 'Duyệt rút tiền',
  withdrawal_rejected: 'Từ chối rút tiền',
  deposit_approved: 'Duyệt nạp tiền',
  deposit_rejected: 'Từ chối nạp tiền',
  rate_limit_exceeded: 'Vượt giới hạn',
};

const actionIcons: Record<string, React.ReactNode> = {
  trade_completed: <CheckCircle className="w-4 h-4" />,
  trade_failed: <XCircle className="w-4 h-4" />,
  trade_error: <AlertTriangle className="w-4 h-4" />,
  withdrawal_requested: <Clock className="w-4 h-4" />,
  withdrawal_failed: <XCircle className="w-4 h-4" />,
  withdrawal_error: <AlertTriangle className="w-4 h-4" />,
  withdrawal_approved: <CheckCircle className="w-4 h-4" />,
  withdrawal_rejected: <XCircle className="w-4 h-4" />,
  deposit_approved: <CheckCircle className="w-4 h-4" />,
  deposit_rejected: <XCircle className="w-4 h-4" />,
  rate_limit_exceeded: <AlertTriangle className="w-4 h-4" />,
};

export function DashboardAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  
  // Filters
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter, startDate, endDate]);

  const fetchLogs = async () => {
    setIsLoading(true);
    
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    // Apply filters
    if (actionFilter !== 'all') {
      query = query.eq('action', actionFilter);
    }
    if (entityFilter !== 'all') {
      query = query.eq('entity_type', entityFilter);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    const { data: logsData, error } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      setIsLoading(false);
      return;
    }

    // Fetch profiles for unique user_ids - using profiles_safe view for security
    const userIds = [...new Set(logsData?.map(log => log.user_id) || [])];
    const { data: profilesData } = await supabase
      .from('profiles_safe')
      .select('id, full_name')
      .in('id', userIds);

    // Map profiles to logs
    const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
    const logsWithProfiles = logsData?.map(log => ({
      ...log,
      profiles: profilesMap.get(log.user_id) || null
    })) || [];

    setLogs(logsWithProfiles);
    setIsLoading(false);
  };

  const handleViewDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDialog(true);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    return (
      log.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.entity_type.toLowerCase().includes(searchLower) ||
      log.user_id.toLowerCase().includes(searchLower)
    );
  });

  const uniqueActions = [...new Set(logs.map(log => log.action))];
  const uniqueEntities = [...new Set(logs.map(log => log.entity_type))];

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
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Nhật ký Kiểm tra (Audit Logs)
            </CardTitle>
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    Xuất báo cáo
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportToCSV(filteredLogs)}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Xuất CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToPDF(filteredLogs)}>
                    <FileText className="w-4 h-4 mr-2" />
                    Xuất PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={fetchLogs}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Làm mới
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="search">Tìm kiếm</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Tên, hành động..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Loại hành động</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {uniqueActions.map(action => (
                    <SelectItem key={action} value={action}>
                      {actionLabels[action] || action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Đối tượng</Label>
              <Select value={entityFilter} onValueChange={setEntityFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Tất cả" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  {uniqueEntities.map(entity => (
                    <SelectItem key={entity} value={entity}>
                      {entity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">Từ ngày</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Đến ngày</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Hiển thị {filteredLogs.length} / {logs.length} bản ghi
          </div>

          {/* Logs Table */}
          {filteredLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Không có nhật ký nào</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Thời gian</TableHead>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Hành động</TableHead>
                    <TableHead>Đối tượng</TableHead>
                    <TableHead>Chi tiết</TableHead>
                    <TableHead>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {log.profiles?.full_name || log.user_id.slice(0, 8) + '...'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`flex items-center gap-1 w-fit ${actionColors[log.action] || 'bg-muted text-muted-foreground'}`}>
                          {actionIcons[log.action]}
                          {actionLabels[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.entity_type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {log.details && typeof log.details === 'object' && !Array.isArray(log.details) ? (
                          <>
                            {(log.details as Record<string, unknown>).trade_type && (
                              <span>{String((log.details as Record<string, unknown>).trade_type)}</span>
                            )}
                            {(log.details as Record<string, unknown>).amount && (
                              <span className="ml-1">{formatCurrency(Number((log.details as Record<string, unknown>).amount))}</span>
                            )}
                            {(log.details as Record<string, unknown>).total && (
                              <span className="ml-1">{formatCurrency(Number((log.details as Record<string, unknown>).total))}</span>
                            )}
                            {(log.details as Record<string, unknown>).reason && (
                              <span className="text-red-400">{String((log.details as Record<string, unknown>).reason)}</span>
                            )}
                          </>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(log)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Xem
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết Nhật ký</DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Người dùng</p>
                  <p className="font-medium">{selectedLog.profiles?.full_name || 'N/A'}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedLog.user_id}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Thời gian</p>
                  <p className="font-medium">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Hành động</p>
                  <Badge className={`${actionColors[selectedLog.action] || 'bg-muted'}`}>
                    {actionLabels[selectedLog.action] || selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Đối tượng</p>
                  <p className="font-medium">{selectedLog.entity_type}</p>
                </div>
                {selectedLog.entity_id && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Entity ID</p>
                    <p className="font-mono text-xs">{selectedLog.entity_id}</p>
                  </div>
                )}
                {selectedLog.ip_address && (
                  <div>
                    <p className="text-muted-foreground">IP Address</p>
                    <p className="font-mono text-xs">{selectedLog.ip_address}</p>
                  </div>
                )}
              </div>

              {selectedLog.details && (
                <div>
                  <p className="text-muted-foreground mb-2">Chi tiết JSON</p>
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
