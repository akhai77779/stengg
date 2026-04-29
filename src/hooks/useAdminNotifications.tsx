import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
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

interface PendingOptionTrade {
  id: string;
  user_id: string;
  product_id?: string;
  amount: number;
  direction: string;
  status: string;
  created_at: string;
}

interface NewProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  type: 'transaction' | 'verification' | 'option_trade' | 'new_user';
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
}

interface AdminNotificationsValue {
  pendingCount: number;
  pendingTransactionCount: number;
  pendingVerificationCount: number;
  pendingOptionTradeCount: number;
  newUserCount: number;
  notificationHistory: NotificationItem[];
  unreadNotificationCount: number;
  markAsRead: (id: string) => void;
  clearAllNotifications: () => void;
  refetch: () => Promise<void>;
}

const AdminNotificationsContext = createContext<AdminNotificationsValue | null>(null);

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

export function AdminNotificationsProvider({ children }: { children: ReactNode }) {
  const [pendingTransactionCount, setPendingTransactionCount] = useState(0);
  const [pendingVerificationCount, setPendingVerificationCount] = useState(0);
  const [pendingOptionTradeCount, setPendingOptionTradeCount] = useState(0);
  const [newUserCount, setNewUserCount] = useState(0);
  const [notificationHistory, setNotificationHistory] = useState<NotificationItem[]>([]);
  const isInitialLoad = useRef(true);
  const processedAdminNotificationKeys = useRef<Set<string>>(new Set());
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
    type: 'transaction' | 'verification' | 'option_trade' | 'new_user',
    title: string,
    description: string,
    dedupeKey?: string,
    timestamp: Date = new Date()
  ) => {
    const key = dedupeKey || `${type}:${title}:${description}`;
    if (processedAdminNotificationKeys.current.has(key)) return false;
    processedAdminNotificationKeys.current.add(key);

    const newNotification: NotificationItem = {
      id: `${type}-${key}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      description,
      timestamp,
      read: false,
    };
    setNotificationHistory(prev => [newNotification, ...prev]);
    return true;
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

  const buildOptionTradeNotification = useCallback((trade: PendingOptionTrade) => {
    const direction = trade.direction === 'buy' ? '📈 Mua' : trade.direction === 'sell' ? '📉 Bán' : trade.direction;
    const amount = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Number(trade.amount || 0));
    return {
      title: '⚡ Option Trade mới',
      description: `Đặt lệnh ${direction} với ${amount} • ${trade.status}`,
    };
  }, []);

  const fetchPendingCounts = useCallback(async () => {
    if (!user || !isAdmin) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    
    const [txResult, verifyResult, optionTradeResult, todayOptionTradesResult] = await Promise.all([
      supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('identity_verifications')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('option_trades')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('option_trades')
        .select('id, user_id, product_id, amount, direction, status, created_at')
        .gte('created_at', startOfDay.toISOString())
        .order('created_at', { ascending: false })
        .limit(50)
    ]);
    
    setPendingTransactionCount(txResult.count || 0);
    setPendingVerificationCount(verifyResult.count || 0);
    setPendingOptionTradeCount(optionTradeResult.count || 0);

    if (todayOptionTradesResult.data) {
      (todayOptionTradesResult.data as PendingOptionTrade[]).reverse().forEach((trade) => {
        const { title, description } = buildOptionTradeNotification(trade);
        addNotification('option_trade', title, description, `option_trade:${trade.id}`, new Date(trade.created_at));
      });
    }
  }, [user, isAdmin, addNotification, buildOptionTradeNotification]);

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

    // Set up real-time subscription for option trades
    const optionTradeChannel = supabase
      .channel('admin-option-trades')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'option_trades'
        },
        (payload) => {
          const newTrade = payload.new as PendingOptionTrade;
          const direction = newTrade.direction === 'up' ? '📈 Lên' : '📉 Xuống';
          const amount = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(newTrade.amount);

          const title = '⚡ Option Trade mới';
          const description = `Đặt lệnh ${direction} với ${amount}`;

          // Add to history
          addNotification('option_trade', title, description);

          // Play notification sound and send desktop notification (only after initial load)
          if (!isInitialLoad.current) {
            playNotificationSound();
            sendDesktopNotification(title, description);
          }

          toast({ title, description });
          if (newTrade.status === 'active') {
            setPendingOptionTradeCount(prev => prev + 1);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'option_trades',
        },
        (payload) => {
          const oldStatus = (payload.old as { status: string })?.status;
          const newStatus = (payload.new as { status: string })?.status;
          
          if (oldStatus === 'active' && newStatus !== 'active') {
            setPendingOptionTradeCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    // Set up real-time subscription for new user registrations (profiles table)
    const userChannel = supabase
      .channel('admin-new-users')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        (payload) => {
          const newProfile = payload.new as NewProfile;
          const userName = newProfile.full_name || newProfile.email || 'Người dùng mới';

          const title = '👤 Người dùng mới đăng ký';
          const description = `${userName} vừa tạo tài khoản`;

          // Add to history
          addNotification('new_user', title, description);

          // Play notification sound and send desktop notification (only after initial load)
          if (!isInitialLoad.current) {
            playNotificationSound();
            sendDesktopNotification(title, description);
          }

          toast({ title, description });
          setNewUserCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(txChannel);
      supabase.removeChannel(verifyChannel);
      supabase.removeChannel(optionTradeChannel);
      supabase.removeChannel(userChannel);
    };
  }, [user, isAdmin, toast, fetchPendingCounts, addNotification]);

  // Total pending count for backward compatibility
  const pendingCount = pendingTransactionCount + pendingVerificationCount;

  return { 
    pendingCount,
    pendingTransactionCount, 
    pendingVerificationCount,
    pendingOptionTradeCount,
    newUserCount,
    notificationHistory,
    unreadNotificationCount,
    markAsRead,
    clearAllNotifications,
    refetch: fetchPendingCounts 
  };
}
