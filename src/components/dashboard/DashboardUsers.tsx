import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Shield, User, Eye, Key, Copy, Check, DollarSign, Mail, Phone, Globe, Ban, Lock, Unlock, TrendingUp, Landmark, CreditCard } from 'lucide-react';
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
  user_code: number | null;
  is_frozen: boolean | null;
  is_trade_frozen: boolean | null;
  frozen_reason: string | null;
}

interface UserRole {
  user_id: string;
  role: AppRole;
}

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
  branch: string | null;
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

  // Add balance dialog
  const [addBalanceUser, setAddBalanceUser] = useState<Profile | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [isAddingBalance, setIsAddingBalance] = useState(false);

  // Subtract balance dialog
  const [subtractBalanceUser, setSubtractBalanceUser] = useState<Profile | null>(null);
  const [subtractAmount, setSubtractAmount] = useState('');
  const [isSubtractingBalance, setIsSubtractingBalance] = useState(false);

  // Change password dialog
  const [passwordUser, setPasswordUser] = useState<Profile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Freeze reason dialog
  const [freezeUser, setFreezeUser] = useState<Profile | null>(null);
  const [freezeReason, setFreezeReason] = useState('');
  const [freezeType, setFreezeType] = useState<'account' | 'trade'>('account');
  const [isUpdatingFreeze, setIsUpdatingFreeze] = useState(false);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bank accounts for selected user
  const [userBankAccounts, setUserBankAccounts] = useState<BankAccount[]>([]);
  const [isLoadingBankAccounts, setIsLoadingBankAccounts] = useState(false);

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
      p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user_code?.toString().includes(searchQuery)
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

  const getUserCode = (profile: Profile) => {
    return profile.user_code?.toString().padStart(5, '0') || '-----';
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchUserBankAccounts = async (userId: string) => {
    setIsLoadingBankAccounts(true);
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bank accounts:', error);
    } else {
      setUserBankAccounts(data || []);
    }
    setIsLoadingBankAccounts(false);
  };

  const handleShowUserDetail = (profile: Profile) => {
    setSelectedUser(profile);
    setShowDetailDialog(true);
    fetchUserBankAccounts(profile.id);
  };

  const handleAddBalance = async () => {
    if (!addBalanceUser) return;

    const amount = parseFloat(addAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Lỗi', description: 'Số tiền không hợp lệ', variant: 'destructive' });
      return;
    }

    setIsAddingBalance(true);

    try {
      // Get current user session for admin ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Lỗi', description: 'Không tìm thấy phiên đăng nhập', variant: 'destructive' });
        setIsAddingBalance(false);
        return;
      }

      // Use atomic RPC function to prevent race conditions
      const { data, error } = await supabase.rpc('admin_add_balance', {
        _admin_id: user.id,
        _user_id: addBalanceUser.id,
        _amount: amount
      });

      if (error) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      } else if (data && typeof data === 'object' && 'success' in data && !(data as { success: boolean }).success) {
        const errorMsg = (data as { error?: string }).error || 'Không thể cộng tiền';
        toast({ title: 'Lỗi', description: errorMsg, variant: 'destructive' });
      } else {
        const result = data as { new_balance?: number } | null;
        const newBalance = result?.new_balance ?? (addBalanceUser.balance || 0) + amount;
        toast({ title: 'Thành công', description: `Đã cộng $${amount.toFixed(2)} vào tài khoản` });
        setProfiles(profiles.map(p => p.id === addBalanceUser.id ? { ...p, balance: newBalance } : p));
        setAddBalanceUser(null);
        setAddAmount('');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định';
      toast({ title: 'Lỗi', description: errorMessage, variant: 'destructive' });
    }

    setIsAddingBalance(false);
  };

  const handleSubtractBalance = async () => {
    if (!subtractBalanceUser) return;

    const amount = parseFloat(subtractAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Lỗi', description: 'Số tiền không hợp lệ', variant: 'destructive' });
      return;
    }

    const currentBalance = subtractBalanceUser.balance || 0;
    if (amount > currentBalance) {
      toast({ title: 'Lỗi', description: 'Số tiền trừ không được lớn hơn số dư hiện tại', variant: 'destructive' });
      return;
    }

    setIsSubtractingBalance(true);

    try {
      // Get current user session for admin ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Lỗi', description: 'Không tìm thấy phiên đăng nhập', variant: 'destructive' });
        setIsSubtractingBalance(false);
        return;
      }

      // Use atomic RPC function to prevent race conditions
      const { data, error } = await supabase.rpc('admin_subtract_balance', {
        _admin_id: user.id,
        _user_id: subtractBalanceUser.id,
        _amount: amount
      });

      if (error) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      } else if (data && typeof data === 'object' && 'success' in data && !(data as { success: boolean }).success) {
        const errorMsg = (data as { error?: string }).error || 'Không thể trừ tiền';
        toast({ title: 'Lỗi', description: errorMsg, variant: 'destructive' });
      } else {
        const result = data as { new_balance?: number } | null;
        const newBalance = result?.new_balance ?? currentBalance - amount;
        toast({ title: 'Thành công', description: `Đã trừ $${amount.toFixed(2)} khỏi tài khoản` });
        setProfiles(profiles.map(p => p.id === subtractBalanceUser.id ? { ...p, balance: newBalance } : p));
        setSubtractBalanceUser(null);
        setSubtractAmount('');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Lỗi không xác định';
      toast({ title: 'Lỗi', description: errorMessage, variant: 'destructive' });
    }

    setIsSubtractingBalance(false);
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

  const handleToggleAccountFreeze = async (profile: Profile) => {
    const newFrozenState = !profile.is_frozen;
    
    if (newFrozenState) {
      // Show dialog for reason
      setFreezeUser(profile);
      setFreezeType('account');
      setFreezeReason('');
    } else {
      // Unfreeze directly
      const { error } = await supabase
        .from('profiles')
        .update({ is_frozen: false, frozen_reason: null })
        .eq('id', profile.id);

      if (error) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Thành công', description: 'Đã mở khóa tài khoản' });
        setProfiles(profiles.map(p => p.id === profile.id ? { ...p, is_frozen: false, frozen_reason: null } : p));
      }
    }
  };

  const handleToggleTradeFreeze = async (profile: Profile) => {
    const newFrozenState = !profile.is_trade_frozen;
    
    if (newFrozenState) {
      // Show dialog for reason
      setFreezeUser(profile);
      setFreezeType('trade');
      setFreezeReason('');
    } else {
      // Unfreeze directly
      const { error } = await supabase
        .from('profiles')
        .update({ is_trade_frozen: false })
        .eq('id', profile.id);

      if (error) {
        toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Thành công', description: 'Đã mở khóa giao dịch' });
        setProfiles(profiles.map(p => p.id === profile.id ? { ...p, is_trade_frozen: false } : p));
      }
    }
  };

  const handleConfirmFreeze = async () => {
    if (!freezeUser) return;

    setIsUpdatingFreeze(true);

    const updateData = freezeType === 'account' 
      ? { is_frozen: true, frozen_reason: freezeReason || 'Tài khoản bị khóa bởi admin' }
      : { is_trade_frozen: true };

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', freezeUser.id);

    if (error) {
      toast({ title: 'Lỗi', description: error.message, variant: 'destructive' });
    } else {
      const message = freezeType === 'account' ? 'Đã khóa tài khoản' : 'Đã đóng băng giao dịch';
      toast({ title: 'Thành công', description: message });
      setProfiles(profiles.map(p => {
        if (p.id === freezeUser.id) {
          return freezeType === 'account'
            ? { ...p, is_frozen: true, frozen_reason: freezeReason || 'Tài khoản bị khóa bởi admin' }
            : { ...p, is_trade_frozen: true };
        }
        return p;
      }));
      setFreezeUser(null);
    }

    setIsUpdatingFreeze(false);
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
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Người dùng</TableHead>
                    <TableHead>Email/SĐT</TableHead>
                    <TableHead>Số dư</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>IP cuối</TableHead>
                    <TableHead className="text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => (
                    <TableRow key={profile.id} className={profile.is_frozen ? 'opacity-60 bg-destructive/5' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono font-bold">
                            {getUserCode(profile)}
                          </code>
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
                          <div>
                            <span className="font-medium block">
                              {profile.full_name || 'Chưa cập nhật'}
                            </span>
                            {roles[profile.id] === 'admin' && (
                              <Badge className="bg-primary/20 text-primary border-primary/50 text-[10px] h-4">
                                <Shield className="w-2.5 h-2.5 mr-0.5" />
                                Admin
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          {profile.email && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Mail className="w-3 h-3" />
                              <span className="truncate max-w-[150px]">{profile.email}</span>
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
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => {
                              setSubtractBalanceUser(profile);
                              setSubtractAmount('');
                            }}
                            title="Trừ tiền"
                          >
                            <span className="text-lg font-bold">−</span>
                          </Button>
                          <span className="font-mono font-medium text-green-500 min-w-[80px] text-center">
                            ${(profile.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                            onClick={() => {
                              setAddBalanceUser(profile);
                              setAddAmount('');
                            }}
                            title="Cộng tiền"
                          >
                            <span className="text-lg font-bold">+</span>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {profile.is_frozen && (
                            <Badge variant="destructive" className="text-[10px] h-5">
                              <Ban className="w-2.5 h-2.5 mr-0.5" />
                              Đã khóa
                            </Badge>
                          )}
                          {profile.is_trade_frozen && (
                            <Badge variant="outline" className="text-[10px] h-5 border-orange-500 text-orange-500">
                              <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                              Đóng băng GD
                            </Badge>
                          )}
                          {!profile.is_frozen && !profile.is_trade_frozen && (
                            <Badge variant="outline" className="text-[10px] h-5 text-green-500 border-green-500">
                              Hoạt động
                            </Badge>
                          )}
                        </div>
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
                            onClick={() => handleShowUserDetail(profile)}
                            title="Chi tiết"
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
                            title="Đổi mật khẩu"
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${profile.is_trade_frozen ? 'text-orange-500' : ''}`}
                            onClick={() => handleToggleTradeFreeze(profile)}
                            title={profile.is_trade_frozen ? 'Mở khóa giao dịch' : 'Đóng băng giao dịch'}
                          >
                            <TrendingUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${profile.is_frozen ? 'text-destructive' : ''}`}
                            onClick={() => handleToggleAccountFreeze(profile)}
                            title={profile.is_frozen ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                          >
                            {profile.is_frozen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
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
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">ID: {getUserCode(selectedUser)}</Badge>
                    {roles[selectedUser.id] === 'admin' && (
                      <Badge className="bg-primary/20 text-primary border-primary/50">Admin</Badge>
                    )}
                    {selectedUser.is_frozen && (
                      <Badge variant="destructive">Đã khóa</Badge>
                    )}
                    {selectedUser.is_trade_frozen && (
                      <Badge variant="outline" className="border-orange-500 text-orange-500">Đóng băng GD</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">User ID (System)</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono break-all">
                      {selectedUser.id.slice(0, 8)}...
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

                {selectedUser.frozen_reason && (
                  <div className="col-span-2 space-y-1">
                    <p className="text-muted-foreground">Lý do khóa</p>
                    <p className="text-destructive">{selectedUser.frozen_reason}</p>
                  </div>
                )}
              </div>

              {/* Bank Accounts Section */}
              <div className="border-t pt-4">
                <p className="text-muted-foreground text-sm mb-2 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Tài khoản ngân hàng đã lưu
                </p>
                {isLoadingBankAccounts ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                ) : userBankAccounts.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Chưa có tài khoản ngân hàng nào</p>
                ) : (
                  <div className="space-y-2">
                    {userBankAccounts.map((account) => (
                      <div key={account.id} className="bg-muted/50 rounded-lg p-3 text-sm">
                        <div className="font-medium">{account.bank_name}</div>
                        <div className="text-muted-foreground">
                          STK: <span className="font-mono">{account.account_number}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Chủ TK: {account.account_holder}
                        </div>
                        {account.branch && (
                          <div className="text-muted-foreground text-xs">
                            Chi nhánh: {account.branch}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Wallet Addresses Section */}
              <div className="border-t pt-4">
                <p className="text-muted-foreground text-sm mb-2 flex items-center gap-2">
                  <Landmark className="w-4 h-4" />
                  Địa chỉ ví USDT
                </p>
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

              {/* Quick Actions in Detail Dialog */}
              <div className="border-t pt-4">
                <p className="text-muted-foreground text-sm mb-3">Thao tác nhanh</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedUser.is_frozen ? "default" : "destructive"}
                    size="sm"
                    onClick={() => handleToggleAccountFreeze(selectedUser)}
                  >
                    {selectedUser.is_frozen ? (
                      <><Unlock className="w-4 h-4 mr-2" />Mở khóa tài khoản</>
                    ) : (
                      <><Lock className="w-4 h-4 mr-2" />Khóa tài khoản</>
                    )}
                  </Button>
                  <Button
                    variant={selectedUser.is_trade_frozen ? "default" : "outline"}
                    size="sm"
                    className={!selectedUser.is_trade_frozen ? "border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white" : ""}
                    onClick={() => handleToggleTradeFreeze(selectedUser)}
                  >
                    {selectedUser.is_trade_frozen ? (
                      <><Unlock className="w-4 h-4 mr-2" />Mở khóa GD</>
                    ) : (
                      <><TrendingUp className="w-4 h-4 mr-2" />Đóng băng GD</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Balance Dialog */}
      <Dialog open={!!addBalanceUser} onOpenChange={(open) => !open && setAddBalanceUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <span className="text-2xl">+</span> Cộng tiền
            </DialogTitle>
            <DialogDescription>
              Cộng tiền cho {addBalanceUser?.full_name || addBalanceUser?.email} (ID: {addBalanceUser && getUserCode(addBalanceUser)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số dư hiện tại</Label>
              <p className="font-mono text-lg text-green-500">
                ${(addBalanceUser?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="addAmount">Số tiền cộng thêm ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="addAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>
            {addAmount && parseFloat(addAmount) > 0 && (
              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-sm text-muted-foreground">Số dư sau khi cộng:</p>
                <p className="font-mono text-lg text-green-500 font-semibold">
                  ${((addBalanceUser?.balance || 0) + parseFloat(addAmount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBalanceUser(null)}>
              Hủy
            </Button>
            <Button onClick={handleAddBalance} disabled={isAddingBalance} className="bg-green-600 hover:bg-green-700">
              {isAddingBalance && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cộng tiền
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subtract Balance Dialog */}
      <Dialog open={!!subtractBalanceUser} onOpenChange={(open) => !open && setSubtractBalanceUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-500">
              <span className="text-2xl">−</span> Trừ tiền
            </DialogTitle>
            <DialogDescription>
              Trừ tiền từ {subtractBalanceUser?.full_name || subtractBalanceUser?.email} (ID: {subtractBalanceUser && getUserCode(subtractBalanceUser)})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Số dư hiện tại</Label>
              <p className="font-mono text-lg text-green-500">
                ${(subtractBalanceUser?.balance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtractAmount">Số tiền trừ đi ($)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="subtractAmount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={subtractBalanceUser?.balance || 0}
                  value={subtractAmount}
                  onChange={(e) => setSubtractAmount(e.target.value)}
                  className="pl-10"
                  placeholder="0.00"
                />
              </div>
            </div>
            {subtractAmount && parseFloat(subtractAmount) > 0 && (
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <p className="text-sm text-muted-foreground">Số dư sau khi trừ:</p>
                <p className="font-mono text-lg text-red-500 font-semibold">
                  ${Math.max(0, (subtractBalanceUser?.balance || 0) - parseFloat(subtractAmount || '0')).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubtractBalanceUser(null)}>
              Hủy
            </Button>
            <Button onClick={handleSubtractBalance} disabled={isSubtractingBalance} variant="destructive">
              {isSubtractingBalance && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Trừ tiền
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
              Đổi mật khẩu cho {passwordUser?.full_name || passwordUser?.email} (ID: {passwordUser && getUserCode(passwordUser)})
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

      {/* Freeze Reason Dialog */}
      <Dialog open={!!freezeUser} onOpenChange={(open) => !open && setFreezeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {freezeType === 'account' ? 'Khóa tài khoản' : 'Đóng băng giao dịch'}
            </DialogTitle>
            <DialogDescription>
              {freezeType === 'account' 
                ? `Người dùng ${freezeUser?.full_name || freezeUser?.email} sẽ không thể đăng nhập.`
                : `Người dùng ${freezeUser?.full_name || freezeUser?.email} sẽ không thể thực hiện giao dịch trade hoặc rút tiền.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {freezeType === 'account' && (
              <div className="space-y-2">
                <Label htmlFor="freezeReason">Lý do khóa (hiển thị cho người dùng)</Label>
                <Input
                  id="freezeReason"
                  value={freezeReason}
                  onChange={(e) => setFreezeReason(e.target.value)}
                  placeholder="VD: Vi phạm điều khoản sử dụng"
                />
              </div>
            )}
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              <p className="font-medium">Cảnh báo:</p>
              <p>
                {freezeType === 'account' 
                  ? 'Người dùng sẽ bị đăng xuất và không thể đăng nhập lại cho đến khi được mở khóa.'
                  : 'Người dùng sẽ không thể thực hiện bất kỳ giao dịch trade hoặc rút tiền nào.'
                }
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFreezeUser(null)}>
              Hủy
            </Button>
            <Button variant="destructive" onClick={handleConfirmFreeze} disabled={isUpdatingFreeze}>
              {isUpdatingFreeze && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Xác nhận
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
