import { useState, useEffect } from "react";
import { Wifi, WifiOff, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type NetworkState = "online" | "offline" | "slow";

export function NetworkStatus() {
  const [networkState, setNetworkState] = useState<NetworkState>("online");
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (navigator.onLine) {
        setNetworkState("online");
        // Hide banner after 2s when back online
        setTimeout(() => setShowBanner(false), 2000);
      } else {
        setNetworkState("offline");
        setShowBanner(true);
      }
    };

    // Check connection speed using Network Information API
    const checkConnectionSpeed = () => {
      const connection = (navigator as Navigator & { connection?: { effectiveType?: string; downlink?: number } }).connection;
      if (connection) {
        const { effectiveType, downlink } = connection;
        // Consider slow if 2g, slow-2g, or downlink < 1.5 Mbps
        if (effectiveType === "slow-2g" || effectiveType === "2g" || (downlink && downlink < 1.5)) {
          setNetworkState("slow");
          setShowBanner(true);
        }
      }
    };

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    
    // Initial check
    updateOnlineStatus();
    checkConnectionSpeed();

    // Listen for connection changes
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    if (connection) {
      connection.addEventListener("change", checkConnectionSpeed);
    }

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
      if (connection) {
        connection.removeEventListener("change", checkConnectionSpeed);
      }
    };
  }, []);

  const handleDismiss = () => {
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] py-2 px-4 text-center text-sm font-medium safe-area-inset-top",
        "flex items-center justify-center gap-2 transition-all duration-300",
        networkState === "offline" && "network-offline bg-destructive text-destructive-foreground",
        networkState === "slow" && "network-slow",
        networkState === "online" && "network-online"
      )}
    >
      <div className="flex items-center gap-2">
        {networkState === "offline" && (
          <>
            <WifiOff className="h-4 w-4" />
            <span>Mất kết nối mạng</span>
          </>
        )}
        {networkState === "slow" && (
          <>
            <AlertTriangle className="h-4 w-4" />
            <span>Kết nối chậm</span>
          </>
        )}
        {networkState === "online" && (
          <>
            <Wifi className="h-4 w-4" />
            <span>Đã kết nối lại</span>
          </>
        )}
      </div>
      
      {/* Close button - only show for slow connection (offline should stay visible) */}
      {networkState !== "offline" && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 h-6 w-6 min-h-0 min-w-0 p-0 hover:bg-white/20"
          onClick={handleDismiss}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Đóng</span>
        </Button>
      )}
    </div>
  );
}
