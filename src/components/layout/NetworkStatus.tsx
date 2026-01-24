import { useState, useEffect } from "react";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

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
  );
}
