import { useState, useEffect, useCallback } from 'react';
import { MessageCircle, ExternalLink, X, Maximize2, Minimize2, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const CSKH_URL = 'https://support.stengg.it.com';
const CSKH_ADMIN_URL = 'https://support.stengg.it.com/admin';
const REMINDER_INTERVAL_MS = 5 * 60 * 1000; // 5 phút

// Create reminder sound using Web Audio API
const playReminderSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5 note
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0, audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.2, audioContext.currentTime + 0.05);
    gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.log('Audio reminder not supported:', error);
  }
};

interface CSKHWidgetProps {
  className?: string;
}

export function CSKHWidget({ className }: CSKHWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(() => {
    const saved = localStorage.getItem('cskh_reminder_enabled');
    return saved !== null ? saved === 'true' : true;
  });
  const [lastReminder, setLastReminder] = useState<Date | null>(null);

  // Send desktop notification
  const sendReminderNotification = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notification = new Notification('🔔 Nhắc nhở CSKH', {
        body: 'Đã đến lúc kiểm tra tin nhắn khách hàng!',
        icon: '/favicon.ico',
        tag: 'cskh-reminder',
        requireInteraction: false,
      });

      setTimeout(() => notification.close(), 5000);

      notification.onclick = () => {
        window.open(CSKH_ADMIN_URL, '_blank', 'noopener,noreferrer');
        notification.close();
      };
    }
    
    playReminderSound();
    setLastReminder(new Date());
  }, []);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Set up reminder interval
  useEffect(() => {
    if (!reminderEnabled) return;

    const interval = setInterval(() => {
      sendReminderNotification();
    }, REMINDER_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [reminderEnabled, sendReminderNotification]);

  // Save reminder preference
  useEffect(() => {
    localStorage.setItem('cskh_reminder_enabled', String(reminderEnabled));
  }, [reminderEnabled]);

  const handleOpenAdmin = () => {
    window.open(CSKH_ADMIN_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Hỗ trợ khách hàng (CSKH)
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setReminderEnabled(!reminderEnabled)}
              title={reminderEnabled ? 'Tắt nhắc nhở' : 'Bật nhắc nhở'}
            >
              {reminderEnabled ? (
                <Bell className="h-4 w-4 text-primary" />
              ) : (
                <BellOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? 'Thu nhỏ' : 'Mở rộng'}
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Status & reminder info */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant={reminderEnabled ? "default" : "secondary"} className="text-xs">
              {reminderEnabled ? '🔔 Nhắc nhở mỗi 5 phút' : '🔕 Đã tắt nhắc nhở'}
            </Badge>
          </div>
          {lastReminder && (
            <span className="text-xs text-muted-foreground">
              Lần nhắc gần nhất: {lastReminder.toLocaleTimeString('vi-VN')}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleOpenAdmin}
            className="flex-1 gap-2"
            variant="default"
          >
            <MessageCircle className="h-4 w-4" />
            Mở Admin CSKH
            <ExternalLink className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(CSKH_URL, '_blank', 'noopener,noreferrer')}
            className="gap-2"
          >
            Xem trang chat
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>

        {/* Iframe preview */}
        {isExpanded && (
          <div className="relative mt-3 border rounded-lg overflow-hidden bg-muted/30">
            <div className="absolute top-2 right-2 z-10">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-7 gap-1 text-xs"
              >
                <X className="h-3 w-3" />
                Đóng
              </Button>
            </div>
            <iframe
              src={CSKH_ADMIN_URL}
              className="w-full h-[500px] border-0"
              title="CSKH Admin Panel"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
        )}

        {/* Quick tips */}
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 space-y-1">
          <p className="font-medium">💡 Mẹo:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Nhắc nhở sẽ phát âm thanh và gửi thông báo desktop mỗi 5 phút</li>
            <li>Click vào thông báo để mở trực tiếp Admin CSKH</li>
            <li>Bấm "Mở rộng" để xem preview ngay trong dashboard</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
