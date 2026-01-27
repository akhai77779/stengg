import { useEffect, useState, useCallback, useRef } from 'react';
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

// Create notification sound using Web Audio API
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for the notification sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Configure a pleasant notification tone
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    oscillator.type = 'sine';
    
    // Fade in and out for a smooth sound
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
    
    // Play a second tone for a "ding-dong" effect
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.setValueAtTime(1174.66, audioContext.currentTime); // D6 note
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0, audioContext.currentTime);
      gain2.gain.linearRampToValueAtTime(0.25, audioContext.currentTime + 0.05);
      gain2.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.4);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.4);
    }, 150);
  } catch (error) {
    console.log('Audio notification not supported:', error);
  }
};

export function useAdminNotifications() {
  const [pendingTransactionCount, setPendingTransactionCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const isInitialLoad = useRef(true);
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
    fetchPendingCounts().then(() => {
      // Mark initial load as complete after first fetch
      setTimeout(() => {
        isInitialLoad.current = false;
      }, 1000);
    });

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

          // Play notification sound (only after initial load)
          if (!isInitialLoad.current) {
            playNotificationSound();
          }

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

          // Play notification sound (only after initial load)
          if (!isInitialLoad.current) {
            playNotificationSound();
          }

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
