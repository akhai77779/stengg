import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface PendingTransaction {
  id: string;
  type: string;
  amount: number;
  user_id: string;
  created_at: string;
}

interface PendingVerification {
  id: string;
  user_id: string;
  full_name: string;
  document_type: string;
  status: string;
  created_at: string;
}

export function useAdminNotifications() {
  const [pendingTransactionCount, setPendingTransactionCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const fetchPendingCounts = useCallback(async () => {
    if (!user || !isAdmin) return;
    
    const [txResult, verifyResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('identity_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
    ]);
    
    setPendingTransactionCount(txResult.count || 0);
    setPendingVerificationCount(verifyResult.count || 0);
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Initial fetch
    fetchPendingCounts();

    // Set up real-time subscription for transactions
    const txChannel = supabase
      .channel('admin-pending-transactions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: 'status=eq.pending'
        },
        (payload) => {
          const newTx = payload.new as PendingTransaction;
          const typeLabel = newTx.type === 'deposit' ? 'nạp tiền' : 'rút tiền';
          const amount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(newTx.amount);

          toast({
            title: '💰 Giao dịch mới cần duyệt',
            description: `Yêu cầu ${typeLabel} ${amount} đang chờ xử lý`,
          });

          setPendingTransactionCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'transactions',
        },
        (payload) => {
          const oldStatus = (payload.old as { status: string })?.status;
          const newStatus = (payload.new as { status: string })?.status;
          
          if (oldStatus === 'pending' && newStatus !== 'pending') {
            setPendingTransactionCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for identity verifications
    const verifyChannel = supabase
      .channel('admin-pending-verifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'identity_verifications',
          filter: 'status=eq.pending'
        },
        (payload) => {
          const newVerify = payload.new as PendingVerification;
          const docType = newVerify.document_type === 'cccd' ? 'CCCD' : 'Passport';

          toast({
            title: '🪪 Yêu cầu xác minh mới',
            description: `${newVerify.full_name} đã gửi ${docType} cần duyệt`,
          });

          setPendingVerificationCount(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'identity_verifications',
        },
        (payload) => {
          const oldStatus = (payload.old as { status: string })?.status;
          const newStatus = (payload.new as { status: string })?.status;
          
          if (oldStatus === 'pending' && newStatus !== 'pending') {
            setPendingVerificationCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(verifyChannel);
    };
  }, [user, isAdmin, toast, fetchPendingCounts]);

  // Total pending count for backward compatibility
  const pendingCount = pendingTransactionCount + pendingVerificationCount;

  return { 
    pendingCount,
    pendingTransactionCount, 
    pendingVerificationCount, 
    refetch: fetchPendingCounts 
  };
}
