import { MessageCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function LiveChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChat = () => {
    window.open('https://direct.lc.chat/19460523/', '_blank', 'width=400,height=600');
  };

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-6">
      {isOpen && (
        <div className="mb-3 bg-card border border-border rounded-lg shadow-lg p-4 w-72 animate-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground">Hỗ trợ khách hàng</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mb-3">
            Xin chào! Chúng tôi luôn sẵn sàng hỗ trợ bạn 24/7.
          </p>
          <div className="space-y-2">
            <Button 
              className="w-full bg-primary hover:bg-primary/90"
              onClick={handleOpenChat}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Bắt đầu trò chuyện
            </Button>
            <a 
              href="tel:+84123456789" 
              className="block"
            >
              <Button variant="outline" className="w-full">
                Hotline: 1900 xxxx
              </Button>
            </a>
          </div>
        </div>
      )}
      
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
        size="icon"
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>
    </div>
  );
}
