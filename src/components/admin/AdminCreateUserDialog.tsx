import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Phone, UserPlus, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AdminCreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserCreated: () => void;
}

export function AdminCreateUserDialog({ open, onOpenChange, onUserCreated }: AdminCreateUserDialogProps) {
  const [method, setMethod] = useState<'phone' | 'email'>('phone');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+84');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const resetForm = () => {
    setFullName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setShowPassword(false);
  };

  const handleCreate = async () => {
    if (!fullName.trim()) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng nhập họ và tên' });
      return;
    }
    if (password.length < 6) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Mật khẩu phải có ít nhất 6 ký tự' });
      return;
    }
    if (method === 'email' && !email.trim()) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng nhập email' });
      return;
    }
    if (method === 'phone' && (!phone.trim() || phone.length < 8)) {
      toast({ variant: 'destructive', title: 'Lỗi', description: 'Vui lòng nhập SĐT hợp lệ' });
      return;
    }

    setIsCreating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: 'destructive', title: 'Lỗi', description: 'Phiên đăng nhập hết hạn' });
        setIsCreating(false);
        return;
      }

      const fullPhone = method === 'phone' ? phoneCountryCode + phone : undefined;

      const response = await supabase.functions.invoke('admin-create-user', {
        body: {
          method,
          fullName: fullName.trim(),
          email: method === 'email' ? email.trim() : undefined,
          phone: fullPhone,
          password,
        },
      });

      if (response.error) {
        toast({ variant: 'destructive', title: 'Lỗi', description: response.error.message || 'Không thể tạo tài khoản' });
      } else if (response.data?.error) {
        toast({ variant: 'destructive', title: 'Lỗi', description: response.data.error });
      } else {
        toast({
          title: 'Thành công',
          description: `Đã tạo tài khoản cho ${fullName}`,
        });
        resetForm();
        onOpenChange(false);
        onUserCreated();
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Lỗi', description: err.message || 'Lỗi không xác định' });
    }

    setIsCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Tạo tài khoản mới
          </DialogTitle>
          <DialogDescription>
            Tạo tài khoản cho người dùng bằng email hoặc số điện thoại.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Method selector */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={method === 'phone' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('phone')}
              className="flex-1 gap-2"
            >
              <Phone className="w-4 h-4" />
              Số điện thoại
            </Button>
            <Button
              type="button"
              variant={method === 'email' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMethod('email')}
              className="flex-1 gap-2"
            >
              <Mail className="w-4 h-4" />
              Email
            </Button>
          </div>

          {/* Full name */}
          <div>
            <Label>Họ và tên</Label>
            <Input
              placeholder="Nhập họ và tên"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={isCreating}
            />
          </div>

          {/* Email or Phone */}
          {method === 'email' ? (
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isCreating}
              />
            </div>
          ) : (
            <div>
              <Label>Số điện thoại</Label>
              <div className="flex gap-2">
                <select
                  value={phoneCountryCode}
                  onChange={(e) => setPhoneCountryCode(e.target.value)}
                  className="w-[80px] shrink-0 rounded-md border border-input bg-background px-2 py-2 text-sm"
                  disabled={isCreating}
                >
                  <option value="+84">+84</option>
                  <option value="+65">+65</option>
                  <option value="+66">+66</option>
                  <option value="+1">+1</option>
                </select>
                <Input
                  type="tel"
                  placeholder="982410306"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isCreating}
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div>
            <Label>Mật khẩu</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isCreating}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Hủy
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang tạo...
              </span>
            ) : (
              'Tạo tài khoản'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
