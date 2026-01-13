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

export function useAdminNotifications() {
  const [pendingCount, setPendingCount] = useState(0);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const fetchPendingCount = useCallback(async () => {
    if (!user || !isAdmin) return;
    
    const { count } = await supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    setPendingCount(count || 0);
  }, [user, isAdmin]);

  useEffect(() => {
    if (!user || !isAdmin) return;

    // Initial fetch
    fetchPendingCount();

    // Set up real-time subscription for new pending transactions
    const channel = supabase
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

          // Show toast notification
          toast({
            title: '🔔 Giao dịch mới cần duyệt',
            description: `Yêu cầu ${typeLabel} ${amount} đang chờ xử lý`,
          });

          // Update pending count
          setPendingCount(prev => prev + 1);
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
          
          // If a pending transaction was approved/rejected, decrement count
          if (oldStatus === 'pending' && newStatus !== 'pending') {
            setPendingCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isAdmin, toast, fetchPendingCount]);

  return { pendingCount, refetch: fetchPendingCount };
}
