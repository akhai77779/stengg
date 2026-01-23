import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Shield, User, Eye, Edit2, Key, Copy, Check, DollarSign, Mail, Phone, Globe } from 'lucide-react';
import { format } from 'date-fns';
import { Database } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type AppRole = Database['public']['Enums']['app_role'];

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  department: string | null;
  position: string | null;
  created_at: string;
  balance: number | null;
  email: string | null;
  phone: string | null;
  last_login_ip: string | null;
  last_login_at: string | null;
  wallet_address_bep20: string | null;
  wallet_address_trc20: string | null;
  wallet_address_erc20: string | null;
}

interface UserRole {
  user_id: string;
  role: AppRole;
}

export function DashboardUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, AppRole>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  // Detail dialog
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  // Edit balance dialog
  const [editBalanceUser, setEditBalanceUser] = useState<Profile | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [isSavingBalance, setIsSavingBalance] = useState(false);

  // Change password dialog
  const [passwordUser, setPasswordUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [profilesResult, rolesResult] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('user_roles').select('user_id, role'),
    ]);

    if (profilesResult.error) {
      console.error('Error fetching profiles:', profilesResult.error);
    } else {
      setProfiles(profilesResult.data || []);
    }

    if (rolesResult.error) {
      console.error('Error fetching roles:', rolesResult.error);
    } else {
      const rolesMap: Record<string, AppRole> = {};
      rolesResult.data?.forEach((r) => {
        rolesMap[r.user_id] = r.role;
      });
      setRoles(rolesMap);
    }

    setIsLoading(false);
  };

  const filteredProfiles = profiles.filter(
    (p) =>
      p.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveBalance = async () => {
    if (!editBalanceUser) return;

    const balanceNum = parseFloat(newBalance);
    if (isNaN(balanceNum) || balanceNum < 0) {
      toast({ title: 'Lỗi', description: 'Số dư không hợp lệ', variant: 'destructive' });
      return;
    }

    setIsSavingBalance(true);

    const { error } = await supabase
      .from('profiles')
      .update({ balance: balanceNum })
      .eq('id', editBalanceUser.id);

    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Thành công', description: 'Đã cập nhật số dư' });
      setProfiles(profiles.map(p => p.id === editBalanceUser.id ? { ...p, balance: balanceNum } : p));
      setEditBalanceUser(null);
    }

    setIsSavingBalance(false);
  };

  const handleChangePassword = async () => {
    if (!passwordUser) return;

    if (newPassword.length < 6) {
      toast({ title: 'Lỗi', description: 'Mật khẩu phải có ít nhất 6 ký tự', variant: 'destructive' });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({ title: 'Lỗi', description: 'Mật khẩu không khớp', variant: 'destructive' });
      return;
    }

    setIsChangingPassword(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-update-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          userId: passwordUser.id,
          newPassword: newPassword,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Đổi mật khẩu thất bại');
      }

      toast({ title: 'Thành công', description: 'Đã đổi mật khẩu cho người dùng' });
      setPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    }

    setIsChangingPassword(false);
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle>Quản lý Người dùng</CardTitle>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm theo tên, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filteredProfiles.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {searchQuery ? 'Không tìm thấy người dùng nào.' : 'Chưa có người dùng nào.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">ID</TableHead>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Email/SĐT</TableHead>
                    <TableHead>Số dư</TableHead>
                    <TableHead>Vai trò</TableHead>
                    <TableHead>IP cuối</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                            {profile.id.slice(0, 8)}...
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyToClipboard(profile.id, profile.id)}
                          >
                            {copiedId === profile.id ? (
                              <Check className="w-3 h-3 text-green-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={profile.avatar_url || ''} />
                            <AvatarFallback className="bg-muted text-foreground text-xs">
                              {getInitials(profile.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">
                            {profile.full_name || 'Chưa cập nhật'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {profile.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <span>{profile.email}</span>
                            </div>
                          )}
                          {profile.phone && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Phone className="w-3 h-3" />
                              <span>{profile.phone}</span>
                            </div>
                          )}
                          {!profile.email && !profile.phone && '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-green-500">
                            ${(profile.balance || 0).toLocaleString()}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => {
                              setEditBalanceUser(profile);
                              setNewBalance((profile.balance || 0).toString());
                            }}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {roles[profile.id] === 'admin' ? (
                          <Badge className="bg-primary/20 text-primary border-primary/50">
                            <Shield className="w-3 h-3 mr-1" />
                            Admin
                          </Badge>
                        ) : (
                          <Badge variant="outline">
                            <User className="w-3 h-3 mr-1" />
                            User
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {profile.last_login_ip ? (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Globe className="w-3 h-3" />
                            <span className="font-mono">{profile.last_login_ip}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedUser(profile);
                              setShowDetailDialog(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setPasswordUser(profile);
                              setNewPassword('');
                              setConfirmPassword('');
                            }}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                        </div>
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
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Chi tiết người dùng</DialogTitle>
            <DialogDescription>Thông tin đầy đủ của người dùng</DialogDescription>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage src={selectedUser.avatar_url || ''} />
                  <AvatarFallback className="bg-muted text-foreground text-lg">
                    {getInitials(selectedUser.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{selectedUser.full_name || 'Chưa cập nhật'}</h3>
                  <p className="text-sm text-muted-foreground">
                    {roles[selectedUser.id] === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">User ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                      {selectedUser.id}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => copyToClipboard(selectedUser.id, 'detail-' + selectedUser.id)}
                    >
                      {copiedId === 'detail-' + selectedUser.id ? (
                        <Check className="w-3 h-3 text-green-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Số dư</p>
                  <p className="font-mono font-semibold text-green-500">
                    ${(selectedUser.balance || 0).toLocaleString()}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Email</p>
                  <p>{selectedUser.email || '-'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Số điện thoại</p>
                  <p>{selectedUser.phone || '-'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Phòng ban</p>
                  <p>{selectedUser.department || '-'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Chức vụ</p>
                  <p>{selectedUser.position || '-'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Ngày tham gia</p>
                  <p>{format(new Date(selectedUser.created_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-muted-foreground">Đăng nhập cuối</p>
                  <p>
                    {selectedUser.last_login_at
                      ? format(new Date(selectedUser.last_login_at), 'dd/MM/yyyy HH:mm')
                      : '-'}
                  </p>
                </div>

                <div className="col-span-2 space-y-1">
                  <p className="text-muted-foreground">IP cuối cùng</p>
                  <p className="font-mono text-xs">{selectedUser.last_login_ip || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <p className="text-muted-foreground text-sm mb-2">Địa chỉ ví</p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-14 justify-center">BEP20</Badge>
                    <code className="flex-1 bg-muted px-2 py-1 rounded font-mono truncate">
                      {selectedUser.wallet_address_bep20 || '-'}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-14 justify-center">TRC20</Badge>
                    <code className="flex-1 bg-muted px-2 py-1 rounded font-mono truncate">
                      {selectedUser.wallet_address_trc20 || '-'}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-14 justify-center">ERC20</Badge>
                    <code className="flex-1 bg-muted px-2 py-1 rounded font-mono truncate">
                      {selectedUser.wallet_address_erc20 || '-'}
                    </code>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Balance Dialog */}
      <Dialog open={!!editBalanceUser} onOpenChange={(open) => !open && setEditBalanceUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chỉnh sửa số dư</DialogTitle>
            <DialogDescription>
              Thay đổi số dư cho {editBalanceUser?.full_name || editBalanceUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số dư hiện tại</Label>
              <p className="font-mono text-lg text-green-500">
                ${(editBalanceUser?.balance || 0).toLocaleString()}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="newBalance">Số dư mới ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="newBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value)}
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBalanceUser(null)}>
              Hủy
            </Button>
            <Button onClick={handleSaveBalance} disabled={isSavingBalance}>
              {isSavingBalance && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Đổi mật khẩu</DialogTitle>
            <DialogDescription>
              Đổi mật khẩu cho {passwordUser?.full_name || passwordUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Mật khẩu mới</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordUser(null)}>
              Hủy
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Đổi mật khẩu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
