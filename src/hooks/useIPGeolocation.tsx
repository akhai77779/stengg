import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GeoLocation {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
  is_default?: boolean;
  localTime?: string;
}

interface UseIPGeolocationOptions {
  enabled?: boolean;
  cacheKey?: string; // Used to cache per customer
}

// Simple in-memory cache to avoid repeated calls
const geoCache = new Map<string, { data: GeoLocation; timestamp: number }>();
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

export function useIPGeolocation(options: UseIPGeolocationOptions = {}) {
  const { enabled = true, cacheKey = "default" } = options;
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLocation = useCallback(async (forceRefresh = false) => {
    // Check cache first
    const cached = geoCache.get(cacheKey);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setLocation(cached.data);
      return cached.data;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("ip-geolocation");

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error("Failed to get location");
      }

      const geoData: GeoLocation = {
        ...data.data,
        localTime: getLocalTime(data.data.timezone),
      };

      // Update cache
      geoCache.set(cacheKey, { data: geoData, timestamp: Date.now() });
      setLocation(geoData);
      return geoData;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Geolocation error:", errorMessage);
      setError(errorMessage);
      
      // Return default location on error
      const defaultLocation: GeoLocation = {
        ip: "unknown",
        country: "Vietnam",
        country_code: "VN",
        region: "Ho Chi Minh",
        city: "Ho Chi Minh City",
        lat: 10.8231,
        lon: 106.6297,
        timezone: "Asia/Ho_Chi_Minh",
        isp: "Unknown",
        is_default: true,
        localTime: getLocalTime("Asia/Ho_Chi_Minh"),
      };
      
      setLocation(defaultLocation);
      return defaultLocation;
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey]);

  // Fetch on mount if enabled
  useEffect(() => {
    if (enabled) {
      fetchLocation();
    }
  }, [enabled, fetchLocation]);

  // Update local time periodically
  useEffect(() => {
    if (!location?.timezone) return;

    const interval = setInterval(() => {
      setLocation(prev => prev ? {
        ...prev,
        localTime: getLocalTime(prev.timezone),
      } : null);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [location?.timezone]);

  return {
    location,
    isLoading,
    error,
    refetch: () => fetchLocation(true),
  };
}

function getLocalTime(timezone: string): string {
  try {
    return new Date().toLocaleTimeString("vi-VN", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return new Date().toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }
}

// Get flag emoji from country code
export function getCountryFlag(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🌍";
  
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0));
  
  return String.fromCodePoint(...codePoints);
}
