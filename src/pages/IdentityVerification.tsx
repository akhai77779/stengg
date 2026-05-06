import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft,
  Loader2,
  Upload,
  X,
  Clock,
  XCircle,
  Check,
  UserCheck
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

export default function IdentityVerification() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  
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
  const [signedFrontUrl, setSignedFrontUrl] = useState<string>('');
  const [signedBackUrl, setSignedBackUrl] = useState<string>('');
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const generateSignedUrl = useCallback(async (url: string): Promise<string> => {
    const match = url.match(/\/storage\/v1\/object\/(?:public|sign)\/identity-documents\/(.+)/);
    if (!match) return url;
    const { data } = await supabase.storage
      .from('identity-documents')
      .createSignedUrl(match[1], 3600);
    return data?.signedUrl || url;
  }, []);

  // Fetch profile data - using profiles_safe view for security
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      
      const { data, error } = await supabase
        .from('profiles_safe')
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
        const verification = data as IdentityVerification;
        setIdentityVerification(verification);
        // Pre-fill form
        setDocumentType(verification.document_type);
        setDocumentNumber(verification.document_number);
        setDateOfBirth(verification.date_of_birth);
        setAddress(verification.address);
        setExpiryDate(verification.expiry_date);
        setFrontImage(verification.front_image_url);
        setBackImage(verification.back_image_url);
        // Generate signed URLs for display
        generateSignedUrl(verification.front_image_url).then(setSignedFrontUrl);
        generateSignedUrl(verification.back_image_url).then(setSignedBackUrl);
      }
      setIsFetching(false);
    };
    
    fetchVerification();
  }, [user?.id]);

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

      // Generate signed URL for display
      const { data: signedData } = await supabase.storage
        .from('identity-documents')
        .createSignedUrl(fileName, 3600);
      if (signedData?.signedUrl) {
        if (type === 'front') setSignedFrontUrl(signedData.signedUrl);
        else setSignedBackUrl(signedData.signedUrl);
      }

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

      // Notify admin via Telegram bot
      try {
        const docTypeLabel = documentType === 'cccd' ? 'CCCD' : 'Passport';
        await supabase.functions.invoke('telegram-notify', {
          body: {
            type: 'notification',
            title: '🪪 Yêu cầu xác minh danh tính mới',
            message: `${profile.full_name} đã gửi ${docTypeLabel} (${documentNumber}) cần được duyệt.`,
            notification_type: 'info',
            user_email: profile?.email || user.email || undefined,
          },
        });
      } catch (notifyError) {
        console.warn('Telegram notify failed:', notifyError);
      }

      toast({
        title: t('common.success'),
        description: t('identity.submitSuccess'),
      });

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
  const canEdit = !identityVerification || identityVerification.status === 'rejected';

  if (isFetching) {
    return (
      <Layout hideFooter>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout hideFooter>
      <div className="min-h-screen pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-6 max-w-lg">
          
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/profile')}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold text-foreground">
              {t('identity.title')}
            </h1>
          </div>

          {/* Status Card */}
          {verificationStatus && (
            <Card className={cn("mb-6 border", verificationStatus.borderColor)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center",
                  verificationStatus.bgColor
                )}>
                  <verificationStatus.icon className={cn("w-6 h-6", verificationStatus.color)} />
                </div>
                <div>
                  <p className={cn("font-medium", verificationStatus.color)}>
                    {verificationStatus.label}
                  </p>
                  {identityVerification?.status === 'rejected' && identityVerification.rejection_reason && (
                    <p className="text-sm text-red-400 mt-1">
                      {identityVerification.rejection_reason}
                    </p>
                  )}
                  {identityVerification?.status === 'approved' && (
                    <p className="text-sm text-muted-foreground">
                      {t('identity.verifiedMessage')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Form */}
          <Card className="bg-card border-border">
            <CardContent className="p-4 space-y-4">
              {/* Document Type */}
              <div className="space-y-2">
                <Label>{t('identity.documentType')}</Label>
                <Select 
                  value={documentType} 
                  onValueChange={(v) => setDocumentType(v as 'cccd' | 'passport')}
                  disabled={!canEdit}
                >
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
                  disabled={!canEdit}
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
                  disabled={!canEdit}
                />
              </div>

              {/* Address */}
              <div className="space-y-2">
                <Label>{t('identity.address')}</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t('identity.addressPlaceholder')}
                  disabled={!canEdit}
                />
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <Label>{t('identity.expiryDate')}</Label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  disabled={!canEdit}
                />
              </div>

              {/* Photo Upload Warning */}
              {canEdit && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                  <p className="text-sm text-red-400 font-medium">
                    ⚠️ {t('identity.photoWarning')}
                  </p>
                </div>
              )}

              {/* Front Image */}
              <div className="space-y-2">
                <Label>{t('identity.frontPhoto')}</Label>
                {frontImage ? (
                  <div className="relative group">
                    {signedFrontUrl ? (
                    <img
                      src={signedFrontUrl}
                      alt="Front"
                      className="w-full h-40 object-cover rounded-lg border border-border"
                    />
                    ) : (
                      <div className="w-full h-40 rounded-lg border border-border flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {canEdit && (
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
                    )}
                  </div>
                ) : canEdit ? (
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
                ) : null}
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
                    {signedBackUrl ? (
                    <img
                      src={signedBackUrl}
                      alt="Back"
                      className="w-full h-40 object-cover rounded-lg border border-border"
                    />
                    ) : (
                      <div className="w-full h-40 rounded-lg border border-border flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    {canEdit && (
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
                    )}
                  </div>
                ) : canEdit ? (
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
                ) : null}
                <input
                  ref={backInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'back')}
                  className="hidden"
                />
              </div>

              {/* Submit Button */}
              {canEdit && (
                <Button 
                  onClick={handleSubmitVerification} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {t('common.submit')}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
