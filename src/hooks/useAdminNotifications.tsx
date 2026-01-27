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

export interface NotificationItem {
  id: string;
  type: 'transaction' | 'verification';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
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

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

// Send desktop notification
const sendDesktopNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `admin-notification-${Date.now()}`,
      requireInteraction: false,
    });

    // Auto close after 5 seconds
    setTimeout(() => notification.close(), 5000);

    // Focus window when clicked
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }
};

export function useAdminNotifications() {
  const [pendingTransactionCount, setPendingTransactionCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [notificationHistory, setNotificationHistory] = useState<NotificationItem[]>([]);
  const isInitialLoad = useRef(true);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  // Request notification permission on mount
  useEffect(() => {
    if (isAdmin) {
      requestNotificationPermission();
    }
  }, [isAdmin]);

  // Add notification to history
  const addNotification = useCallback((
    type: 'transaction' | 'verification',
    title: string,
    description: string
  ) => {
    const newNotification: NotificationItem = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      timestamp: new Date(),
      read: false,
    };
    setNotificationHistory(prev => [newNotification, ...prev]);
  }, []);

  // Mark notification as read
  const markAsRead = useCallback((id: string) => {
    setNotificationHistory(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotificationHistory([]);
  }, []);

  // Get unread count
  const unreadNotificationCount = notificationHistory.filter(n => !n.read).length;

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

          const title = '💰 Giao dịch mới cần duyệt';
          const description = `Yêu cầu ${typeLabel} ${amount} đang chờ xử lý`;

          // Add to history
          addNotification('transaction', title, description);

          // Play notification sound and send desktop notification (only after initial load)
          if (!isInitialLoad.current) {
            playNotificationSound();
            sendDesktopNotification(title, description);
          }

          toast({ title, description });
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

          const title = '🪪 Yêu cầu xác minh mới';
          const description = `${newVerify.full_name} đã gửi ${docType} cần duyệt`;

          // Add to history
          addNotification('verification', title, description);

          // Play notification sound and send desktop notification (only after initial load)
          if (!isInitialLoad.current) {
            playNotificationSound();
            sendDesktopNotification(title, description);
          }

          toast({ title, description });
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
  }, [user, isAdmin, toast, fetchPendingCounts, addNotification]);

  // Total pending count for backward compatibility
  const pendingCount = pendingTransactionCount + pendingVerificationCount;

  return { 
    pendingCount,
    pendingTransactionCount, 
    pendingVerificationCount, 
    notificationHistory,
    unreadNotificationCount,
    markAsRead,
    clearAllNotifications,
    refetch: fetchPendingCounts 
  };
}
