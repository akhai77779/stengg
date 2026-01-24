import { memo } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ConnectionStatus } from '@/hooks/useProductRealtime';

interface RealtimeStatusIndicatorProps {
  status: ConnectionStatus;
  updateCount: number;
  reconnectCount?: number;
  onReconnect?: () => void;
  showReconnectButton?: boolean;
}

/**
 * Memoized realtime connection status indicator
 * Prevents unnecessary re-renders when parent updates
 */
export const RealtimeStatusIndicator = memo(function RealtimeStatusIndicator({
  status,
  updateCount,
  reconnectCount = 0,
  onReconnect,
  showReconnectButton = false,
}: RealtimeStatusIndicatorProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          dotClass: 'bg-green-500 animate-pulse-dot',
          iconClass: 'text-green-500',
          Icon: Wifi,
          label: `Đang kết nối (${updateCount} updates)`,
        };
      case 'connecting':
        return {
          dotClass: 'bg-yellow-500 animate-pulse',
          iconClass: 'text-yellow-500',
          Icon: Wifi,
          label: 'Đang kết nối...',
        };
      case 'reconnecting':
        return {
          dotClass: 'bg-orange-500 animate-pulse',
          iconClass: 'text-orange-500',
          Icon: RefreshCw,
          label: `Đang kết nối lại... (${reconnectCount} lần)`,
        };
      case 'disconnected':
      default:
        return {
          dotClass: 'bg-red-500',
          iconClass: 'text-red-500',
          Icon: WifiOff,
          label: 'Mất kết nối',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.Icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${config.dotClass}`} />
            <Icon className={`h-3 w-3 ${config.iconClass}`} />
            {showReconnectButton && status === 'disconnected' && onReconnect && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onReconnect}
                className="h-5 px-1 text-xs"
              >
                Kết nối lại
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Realtime: {config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
