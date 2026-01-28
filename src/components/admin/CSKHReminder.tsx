import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, ExternalLink, X, Bell, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';

const REMINDER_INTERVAL = 15 * 60 * 1000; // 15 minutes
const SNOOZE_DURATION = 30 * 60 * 1000; // 30 minutes

// Notification sound for CSKH reminder
const playReminderSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Pleasant chime sound
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.log('Audio not supported:', error);
  }
};

// Desktop notification for CSKH
const sendCSKHDesktopNotification = () => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('💬 Nhắc nhở CSKH', {
      body: 'Đã đến lúc kiểm tra tin nhắn từ khách hàng!',
      icon: '/favicon.ico',
      tag: 'cskh-reminder',
      requireInteraction: false,
    });

    setTimeout(() => notification.close(), 8000);

    notification.onclick = () => {
      window.open('https://support.stengg.it.com/admin', '_blank');
      notification.close();
    };
  }
};

export function CSKHReminder() {
  const [showReminder, setShowReminder] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<Date | null>(null);
  const [reminderCount, setReminderCount] = useState(0);
  const { toast } = useToast();

  const handleOpenCSKH = useCallback(() => {
    window.open('https://support.stengg.it.com/admin', '_blank', 'noopener,noreferrer');
    setLastChecked(new Date());
    setShowReminder(false);
    setReminderCount(0);
  }, []);

  const handleSnooze = useCallback(() => {
    const snoozeTime = new Date(Date.now() + SNOOZE_DURATION);
    setSnoozedUntil(snoozeTime);
    setShowReminder(false);
    toast({
      title: '⏰ Đã tạm hoãn',
      description: 'Sẽ nhắc lại sau 30 phút',
    });
  }, [toast]);

  const handleDismiss = useCallback(() => {
    setShowReminder(false);
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Reminder interval
  useEffect(() => {
    const checkReminder = () => {
      const now = new Date();
      
      // Skip if snoozed
      if (snoozedUntil && now < snoozedUntil) {
        return;
      }
      
      // Reset snooze if expired
      if (snoozedUntil && now >= snoozedUntil) {
        setSnoozedUntil(null);
      }

      // Show reminder
      setShowReminder(true);
      setReminderCount(prev => prev + 1);
      playReminderSound();
      sendCSKHDesktopNotification();
      
      toast({
        title: '💬 Nhắc nhở CSKH',
        description: 'Hãy kiểm tra tin nhắn từ khách hàng!',
        action: (
          <Button size="sm" onClick={handleOpenCSKH}>
            Mở CSKH
          </Button>
        ),
      });
    };

    // Initial reminder after 5 minutes
    const initialTimeout = setTimeout(checkReminder, 5 * 60 * 1000);
    
    // Then every REMINDER_INTERVAL
    const interval = setInterval(checkReminder, REMINDER_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [snoozedUntil, toast, handleOpenCSKH]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <MessageCircle className="h-5 w-5" />
          {(showReminder || reminderCount > 0) && (
            <Badge 
              variant="default" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs bg-blue-500 animate-pulse"
            >
              !
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-blue-500" />
              CSKH Admin
            </h4>
            {snoozedUntil && (
              <Badge variant="secondary" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Đã tạm hoãn
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground">
            Kiểm tra và trả lời tin nhắn từ khách hàng qua hệ thống hỗ trợ trực tuyến.
          </p>

          {lastChecked && (
            <p className="text-xs text-muted-foreground">
              Lần kiểm tra cuối: {lastChecked.toLocaleTimeString('vi-VN')}
            </p>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleOpenCSKH}
              className="flex-1 gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Mở CSKH
              <ExternalLink className="h-3 w-3" />
            </Button>
            
            {showReminder && (
              <>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleSnooze}
                  title="Nhắc lại sau 30 phút"
                >
                  <Clock className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={handleDismiss}
                  title="Bỏ qua"
                >
                  <X className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Bell className="h-3 w-3" />
              Tự động nhắc nhở mỗi 15 phút
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
