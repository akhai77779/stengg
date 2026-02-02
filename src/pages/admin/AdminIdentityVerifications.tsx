import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Eye, 
  Check, 
  X, 
  Loader2,
  Clock,
  UserCheck,
  XCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface IdentityVerification {
  id: string;
  user_id: string;
  document_type: 'cccd' | 'passport';
  document_number: string;
  full_name: string;
  date_of_birth: string;
  address: string;
  expiry_date: string;
  front_image_url: string;
  back_image_url: string;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
}

export default function AdminIdentityVerifications() {
  const [verifications, setVerifications] = useState<IdentityVerification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVerification, setSelectedVerification] = useState<IdentityVerification | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchVerifications();
  }, []);

  const fetchVerifications = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('identity_verifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching verifications:', error);
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể tải danh sách xác minh.',
      });
    } else {
      setVerifications((data || []) as IdentityVerification[]);
    }
    setIsLoading(false);
  };

  const handleApprove = async (id: string) => {
    if (!selectedVerification) return;
    
    setIsProcessing(true);
    const { error } = await supabase
      .from('identity_verifications')
      .update({ 
        status: 'approved',
        rejection_reason: null 
      })
      .eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể duyệt yêu cầu.',
      });
    } else {
      // Send notification to user
      await supabase.from('user_notifications').insert({
        user_id: selectedVerification.user_id,
        title: 'Xác minh danh tính thành công',
        message: `Yêu cầu xác minh danh tính của bạn đã được duyệt. Tài khoản của bạn đã được xác thực.`,
        type: 'kyc_approved',
        metadata: { verification_id: id, full_name: selectedVerification.full_name }
      });
      
      toast({
        title: 'Thành công',
        description: 'Đã duyệt xác minh danh tính.',
      });
      fetchVerifications();
      setIsDetailOpen(false);
    }
    setIsProcessing(false);
  };

  const handleReject = async (id: string) => {
    if (!selectedVerification) return;
    
    if (!rejectionReason.trim()) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Vui lòng nhập lý do từ chối.',
      });
      return;
    }

    setIsProcessing(true);
    const { error } = await supabase
      .from('identity_verifications')
      .update({ 
        status: 'rejected',
        rejection_reason: rejectionReason 
      })
      .eq('id', id);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Lỗi',
        description: 'Không thể từ chối yêu cầu.',
      });
    } else {
      // Send notification to user
      await supabase.from('user_notifications').insert({
        user_id: selectedVerification.user_id,
        title: 'Xác minh danh tính bị từ chối',
        message: `Yêu cầu xác minh danh tính của bạn đã bị từ chối.\n\nLý do: ${rejectionReason}\n\nVui lòng kiểm tra lại thông tin và gửi lại yêu cầu.`,
        type: 'kyc_rejected',
        metadata: { verification_id: id, rejection_reason: rejectionReason }
      });
      
      toast({
        title: 'Thành công',
        description: 'Đã từ chối yêu cầu xác minh.',
      });
      fetchVerifications();
      setIsDetailOpen(false);
      setRejectionReason('');
    }
    setIsProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Đã duyệt</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Từ chối</Badge>;
      default:
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Chờ duyệt</Badge>;
    }
  };

  const filteredVerifications = verifications.filter((v) => {
    const matchesSearch = 
      v.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.document_number.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const pendingCount = verifications.filter(v => v.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Xác minh danh tính</h1>
          <p className="text-sm text-muted-foreground">
            Quản lý yêu cầu xác minh danh tính của người dùng.
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge variant="destructive" className="text-sm">
            {pendingCount} chờ duyệt
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Tìm theo tên hoặc số giấy tờ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Trạng thái" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="pending">Chờ duyệt</SelectItem>
            <SelectItem value="approved">Đã duyệt</SelectItem>
            <SelectItem value="rejected">Từ chối</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredVerifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Không có yêu cầu xác minh nào.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Họ tên</TableHead>
                  <TableHead>Loại giấy tờ</TableHead>
                  <TableHead>Số giấy tờ</TableHead>
                  <TableHead>Ngày gửi</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVerifications.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.full_name}</TableCell>
                    <TableCell>
                      {v.document_type === 'cccd' ? 'CCCD/CMND' : 'Hộ chiếu'}
                    </TableCell>
                    <TableCell>{v.document_number}</TableCell>
                    <TableCell>
                      {format(new Date(v.created_at), 'dd/MM/yyyy HH:mm')}
                    </TableCell>
                    <TableCell>{getStatusBadge(v.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedVerification(v);
                          setRejectionReason(v.rejection_reason || '');
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Xem
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Chi tiết xác minh danh tính</DialogTitle>
          </DialogHeader>
          
          {selectedVerification && (
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Trạng thái:</span>
                {getStatusBadge(selectedVerification.status)}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Họ tên</p>
                  <p className="font-medium">{selectedVerification.full_name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Loại giấy tờ</p>
                  <p className="font-medium">
                    {selectedVerification.document_type === 'cccd' ? 'CCCD/CMND' : 'Hộ chiếu'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Số giấy tờ</p>
                  <p className="font-medium">{selectedVerification.document_number}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ngày sinh</p>
                  <p className="font-medium">
                    {format(new Date(selectedVerification.date_of_birth), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Địa chỉ</p>
                  <p className="font-medium">{selectedVerification.address}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ngày hết hạn</p>
                  <p className="font-medium">
                    {format(new Date(selectedVerification.expiry_date), 'dd/MM/yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ngày gửi</p>
                  <p className="font-medium">
                    {format(new Date(selectedVerification.created_at), 'dd/MM/yyyy HH:mm')}
                  </p>
                </div>
              </div>

              {/* Images */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Ảnh mặt trước</p>
                  <img
                    src={selectedVerification.front_image_url}
                    alt="Front"
                    className="w-full h-40 object-cover rounded-lg border border-border cursor-pointer"
                    onClick={() => window.open(selectedVerification.front_image_url, '_blank')}
                  />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-2">Ảnh mặt sau</p>
                  <img
                    src={selectedVerification.back_image_url}
                    alt="Back"
                    className="w-full h-40 object-cover rounded-lg border border-border cursor-pointer"
                    onClick={() => window.open(selectedVerification.back_image_url, '_blank')}
                  />
                </div>
              </div>

              {/* Rejection reason (for rejected or when rejecting) */}
              {selectedVerification.status === 'pending' && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Lý do từ chối (nếu từ chối)</p>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Nhập lý do từ chối..."
                    rows={3}
                  />
                </div>
              )}

              {selectedVerification.status === 'rejected' && selectedVerification.rejection_reason && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400">
                    <strong>Lý do từ chối:</strong> {selectedVerification.rejection_reason}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
              Đóng
            </Button>
            {selectedVerification?.status === 'pending' && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => handleReject(selectedVerification.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  Từ chối
                </Button>
                <Button
                  onClick={() => handleApprove(selectedVerification.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Duyệt
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
