import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BankConfig {
  bank_name: string;
  account_number: string;
  account_holder: string;
  branch?: string;
}

export interface CryptoWallet {
  network: string;
  address: string;
  currency: string;
}

export interface CryptoConfig {
  wallets: CryptoWallet[];
}

export interface QRConfig {
  qr_image_url: string;
  bank_name: string;
  account_number: string;
  account_holder: string;
}

export interface DepositSetting {
  id: string;
  method_type: 'bank' | 'crypto' | 'qr';
  is_active: boolean;
  display_order: number;
  config: BankConfig | CryptoConfig | QRConfig;
  created_at: string;
  updated_at: string;
}

export function useDepositSettings() {
  const [settings, setSettings] = useState<DepositSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('deposit_settings')
        .select('*')
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;
      
      // Type assertion since Supabase types may not be updated yet
      setSettings((data || []) as unknown as DepositSetting[]);
    } catch (err) {
      console.error('Error fetching deposit settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch deposit settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateSetting = async (methodType: string, updates: Partial<DepositSetting>) => {
    try {
      const { error: updateError } = await supabase
        .from('deposit_settings')
        .update(updates as never)
        .eq('method_type', methodType);

      if (updateError) throw updateError;
      
      toast.success('Cập nhật thành công');
      await fetchSettings();
      return true;
    } catch (err) {
      console.error('Error updating deposit setting:', err);
      toast.error('Cập nhật thất bại');
      return false;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    isLoading,
    error,
    refetch: fetchSettings,
    updateSetting,
  };
}
