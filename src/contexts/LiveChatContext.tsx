import { createContext, useContext, useCallback, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface LiveChatContextType {
  isOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
}

const LiveChatContext = createContext<LiveChatContextType | undefined>(undefined);

/**
 * Live chat điều hướng sang trang full-page /support thay vì mở widget popup.
 * Phải được render BÊN TRONG BrowserRouter để useNavigate hoạt động.
 */
export function LiveChatProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isOpen = location.pathname.startsWith('/support');

  const openChat = useCallback(() => {
    if (location.pathname !== '/support') {
      navigate('/support');
    }
  }, [navigate, location.pathname]);

  const closeChat = useCallback(() => {
    if (location.pathname.startsWith('/support')) {
      navigate(-1);
    }
  }, [navigate, location.pathname]);

  const toggleChat = useCallback(() => {
    if (isOpen) closeChat();
    else openChat();
  }, [isOpen, openChat, closeChat]);

  return (
    <LiveChatContext.Provider value={{ isOpen, openChat, closeChat, toggleChat }}>
      {children}
    </LiveChatContext.Provider>
  );
}

export function useLiveChat() {
  const context = useContext(LiveChatContext);
  if (!context) {
    throw new Error('useLiveChat must be used within a LiveChatProvider');
  }
  return context;
}
