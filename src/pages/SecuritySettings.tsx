import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft,
  Smartphone,
  Mail,
  ChevronRight,
  Check,
  AlertCircle,
  Loader2,
  UserCheck,
  Upload,
  X,
  Clock,
  XCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdentityVerification {
  id: string;
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
}

interface ProfileData {
  full_name: string | null;
}

export default function SecuritySettings() {
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isChangeTransactionPasswordOpen, setIsChangeTransactionPasswordOpen] = useState(false);
  const [isIdentityVerificationOpen, setIsIdentityVerificationOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Identity verification state
  const [identityVerification, setIdentityVerification] = useState<IdentityVerification | null>(null);
  const [documentType, setDocumentType] = useState<'cccd' | 'passport'>('cccd');
  const [documentNumber, setDocumentNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [address, setAddress] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [frontImage, setFrontImage] = useState<string>('');
  const [backImage, setBackImage] = useState<string>('');
  const [isUploadingFront, setIsUploadingFront] = useState(false);
  const [isUploadingBack, setIsUploadingBack] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user has verified phone/email
  const isPhoneVerified = !!user?.phone;
  const isEmailVerified = !!user?.email_confirmed_at;

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();
      
      if (!error && data) {
        setProfile(data);
      }
    };
    
    fetchProfile();
  }, [user?.id]);

  // Fetch existing identity verification
  useEffect(() => {
    const fetchVerification = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (!error && data) {
        setIdentityVerification(data as IdentityVerification);
      }
    };
    
    fetchVerification();
  }, [user?.id]);

  const handleChangeLoginPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('security.passwordMismatch'),
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('security.passwordTooShort'),
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: t('common.success'),
        description: t('security.passwordChanged')
      });
      setIsChangePasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeTransactionPassword = async () => {
    if (newPassword !== confirmPassword) {
      toast({
        title: t('common.error'),
        description: t('security.passwordMismatch'),
        variant: 'destructive'
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: t('common.error'),
        description: t('security.passwordTooShort'),
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      toast({
        title: t('common.success'),
        description: t('security.transactionPasswordChanged')
      });
      setIsChangeTransactionPasswordOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'front' | 'back'
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('identity.invalidImageType'),
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('identity.imageTooLarge'),
      });
      return;
    }

    const setUploading = type === 'front' ? setIsUploadingFront : setIsUploadingBack;
    const setImage = type === 'front' ? setFrontImage : setBackImage;

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${type}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('identity-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage
        .from('identity-documents')
        .getPublicUrl(fileName);

      setImage(publicUrl.publicUrl);

      toast({
        title: t('common.success'),
        description: t('identity.imageUploaded'),
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('identity.uploadFailed'),
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!user?.id || !profile?.full_name) return;

    if (!documentNumber || !dateOfBirth || !address || !expiryDate || !frontImage || !backImage) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: t('identity.fillAllFields'),
      });
      return;
    }

    setIsLoading(true);

    try {
      const verificationData = {
        user_id: user.id,
        document_type: documentType,
        document_number: documentNumber,
        full_name: profile.full_name,
        date_of_birth: dateOfBirth,
        address: address,
        expiry_date: expiryDate,
        front_image_url: frontImage,
        back_image_url: backImage,
        status: 'pending' as const,
      };

      if (identityVerification) {
        // Update existing
        const { error } = await supabase
          .from('identity_verifications')
          .update(verificationData)
          .eq('id', identityVerification.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('identity_verifications')
          .insert(verificationData);

        if (error) throw error;
      }

      toast({
        title: t('common.success'),
        description: t('identity.submitSuccess'),
      });

      setIsIdentityVerificationOpen(false);
      
      // Refresh verification data
      const { data } = await supabase
        .from('identity_verifications')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setIdentityVerification(data as IdentityVerification);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('common.error'),
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getVerificationStatus = () => {
    if (!identityVerification) return null;
    
    switch (identityVerification.status) {
      case 'approved':
        return {
          icon: Check,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          label: t('identity.statusApproved'),
        };
      case 'rejected':
        return {
          icon: XCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
          label: t('identity.statusRejected'),
        };
      default:
        return {
          icon: Clock,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
          label: t('identity.statusPending'),
        };
    }
  };

  const verificationStatus = getVerificationStatus();

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-8">
            {t('security.title')}
          </h1>

          {/* Two-Factor Authentication */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-foreground mb-2">
              {t('security.twoFactorAuth')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {t('security.twoFactorDesc')}
            </p>

            <div className="grid grid-cols-2 gap-3">
              {/* Phone Verification */}
              <Card className={cn(
                "bg-card border-border cursor-pointer transition-colors",
                isPhoneVerified ? "border-green-500/30" : "border-orange-500/30"
              )}>
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    <Smartphone className="w-8 h-8 text-muted-foreground" />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                      isPhoneVerified ? "bg-green-500" : "bg-orange-500"
                    )}>
                      {isPhoneVerified ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('security.verifyPhone')}
                  </span>
                </CardContent>
              </Card>

              {/* Email Verification */}
              <Card className={cn(
                "bg-card border-border cursor-pointer transition-colors",
                isEmailVerified ? "border-green-500/30" : "border-orange-500/30"
              )}>
                <CardContent className="p-4 flex flex-col items-center text-center">
                  <div className="relative mb-2">
                    <Mail className="w-8 h-8 text-muted-foreground" />
                    <div className={cn(
                      "absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center",
                      isEmailVerified ? "bg-green-500" : "bg-orange-500"
                    )}>
                      {isEmailVerified ? (
                        <Check className="w-3 h-3 text-white" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-white" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {t('security.verifyEmail')}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Identity Verification */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-foreground mb-2">
              {t('identity.title')}
            </h2>
            <p className="text-xs text-muted-foreground mb-4">
              {t('identity.description')}
            </p>

            <Card 
              className={cn(
                "bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors",
                verificationStatus?.borderColor
              )}
              onClick={() => {
                if (!identityVerification || identityVerification.status === 'rejected') {
                  if (identityVerification) {
                    // Pre-fill form with existing data
                    setDocumentType(identityVerification.document_type);
                    setDocumentNumber(identityVerification.document_number);
                    setDateOfBirth(identityVerification.date_of_birth);
                    setAddress(identityVerification.address);
                    setExpiryDate(identityVerification.expiry_date);
                    setFrontImage(identityVerification.front_image_url);
                    setBackImage(identityVerification.back_image_url);
                  }
                  setIsIdentityVerificationOpen(true);
                }
              }}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    verificationStatus?.bgColor || "bg-muted"
                  )}>
                    {verificationStatus ? (
                      <verificationStatus.icon className={cn("w-5 h-5", verificationStatus.color)} />
                    ) : (
                      <UserCheck className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <span className="text-sm text-foreground block">
                      {t('identity.verifyIdentity')}
                    </span>
                    {verificationStatus && (
                      <span className={cn("text-xs", verificationStatus.color)}>
                        {verificationStatus.label}
                      </span>
                    )}
                    {identityVerification?.status === 'rejected' && identityVerification.rejection_reason && (
                      <p className="text-xs text-red-400 mt-1">
                        {identityVerification.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
                {(!identityVerification || identityVerification.status === 'rejected') && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Password Settings */}
          <div className="space-y-3">
            {/* Login Password */}
            <Card 
              className="bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setIsChangePasswordOpen(true)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {t('security.loginPassword')}
                </span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs">{t('security.change')}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>

            {/* Transaction Password */}
            <Card 
              className="bg-card border-border cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => setIsChangeTransactionPasswordOpen(true)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm text-foreground">
                  {t('security.transactionPassword')}
                </span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs">{t('security.change')}</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      {/* Change Login Password Dialog */}
      <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('security.changeLoginPassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">{t('security.currentPassword')}</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.enterCurrentPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">{t('security.newPassword')}</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.enterNewPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">{t('security.confirmPassword')}</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('security.enterConfirmPassword')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleChangeLoginPassword} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Transaction Password Dialog */}
      <Dialog open={isChangeTransactionPasswordOpen} onOpenChange={setIsChangeTransactionPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('security.changeTransactionPassword')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tx-current-password">{t('security.currentPassword')}</Label>
              <Input
                id="tx-current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t('security.enterCurrentPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-new-password">{t('security.newPassword')}</Label>
              <Input
                id="tx-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t('security.enterNewPassword')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-confirm-password">{t('security.confirmPassword')}</Label>
              <Input
                id="tx-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('security.enterConfirmPassword')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChangeTransactionPasswordOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleChangeTransactionPassword} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Identity Verification Dialog */}
      <Dialog open={isIdentityVerificationOpen} onOpenChange={setIsIdentityVerificationOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('identity.verifyIdentity')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Document Type */}
            <div className="space-y-2">
              <Label>{t('identity.documentType')}</Label>
              <Select value={documentType} onValueChange={(v) => setDocumentType(v as 'cccd' | 'passport')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cccd">{t('identity.cccd')}</SelectItem>
                  <SelectItem value="passport">{t('identity.passport')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Document Number */}
            <div className="space-y-2">
              <Label>{documentType === 'cccd' ? t('identity.cccdNumber') : t('identity.passportNumber')}</Label>
              <Input
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={documentType === 'cccd' ? '012345678901' : 'B12345678'}
              />
            </div>

            {/* Full Name (Read-only) */}
            <div className="space-y-2">
              <Label>{t('identity.fullName')}</Label>
              <Input
                value={profile?.full_name || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">{t('identity.nameNote')}</p>
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label>{t('identity.dateOfBirth')}</Label>
              <Input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            {/* Address */}
            <div className="space-y-2">
              <Label>{t('identity.address')}</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('identity.addressPlaceholder')}
              />
            </div>

            {/* Expiry Date */}
            <div className="space-y-2">
              <Label>{t('identity.expiryDate')}</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>

            {/* Photo Upload Warning */}
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <p className="text-sm text-red-400 font-medium">
                ⚠️ {t('identity.photoWarning')}
              </p>
            </div>

            {/* Front Image */}
            <div className="space-y-2">
              <Label>{t('identity.frontPhoto')}</Label>
              {frontImage ? (
                <div className="relative group">
                  <img
                    src={frontImage}
                    alt="Front"
                    className="w-full h-40 object-cover rounded-lg border border-border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => frontInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setFrontImage('')}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => frontInputRef.current?.click()}
                >
                  {isUploadingFront ? (
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{t('identity.uploadFrontPhoto')}</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={frontInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'front')}
                className="hidden"
              />
            </div>

            {/* Back Image */}
            <div className="space-y-2">
              <Label>{t('identity.backPhoto')}</Label>
              {backImage ? (
                <div className="relative group">
                  <img
                    src={backImage}
                    alt="Back"
                    className="w-full h-40 object-cover rounded-lg border border-border"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => backInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {t('common.edit')}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => setBackImage('')}
                    >
                      <X className="w-4 h-4 mr-1" />
                      {t('common.delete')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div 
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => backInputRef.current?.click()}
                >
                  {isUploadingBack ? (
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">{t('identity.uploadBackPhoto')}</p>
                    </>
                  )}
                </div>
              )}
              <input
                ref={backInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => handleImageUpload(e, 'back')}
                className="hidden"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIdentityVerificationOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmitVerification} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {t('common.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
