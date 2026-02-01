import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface GeoLocation {
  ip: string;
  country: string;
  country_code: string;
  region: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  isp: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get client IP from headers
    const clientIp = req.headers.get("cf-connecting-ip") ||
                     req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     null;

    // Parse request body for optional IP override
    let requestedIp = clientIp;
    try {
      const body = await req.json();
      if (body.ip) {
        requestedIp = body.ip;
      }
    } catch {
      // No body or invalid JSON, use client IP
    }

    // Skip geolocation for local/private IPs
    const isPrivateIp = !requestedIp || 
      requestedIp === "unknown" ||
      requestedIp.startsWith("192.168.") ||
      requestedIp.startsWith("10.") ||
      requestedIp.startsWith("172.") ||
      requestedIp === "127.0.0.1" ||
      requestedIp === "::1";

    if (isPrivateIp) {
      console.log("Private/local IP detected, returning default location");
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ip: requestedIp || "unknown",
            country: "Vietnam",
            country_code: "VN",
            region: "Ho Chi Minh",
            city: "Ho Chi Minh City",
            lat: 10.8231,
            lon: 106.6297,
            timezone: "Asia/Ho_Chi_Minh",
            isp: "Unknown",
            is_default: true,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call ip-api.com (free, no API key needed, 45 requests/minute limit)
    const geoResponse = await fetch(
      `http://ip-api.com/json/${requestedIp}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,query`,
      { headers: { "Accept": "application/json" } }
    );

    if (!geoResponse.ok) {
      throw new Error(`Geo API returned ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();

    if (geoData.status === "fail") {
      console.error("Geo API error:", geoData.message);
      throw new Error(geoData.message);
    }

    const location: GeoLocation = {
      ip: geoData.query,
      country: geoData.country,
      country_code: geoData.countryCode,
      region: geoData.regionName || geoData.region,
      city: geoData.city,
      lat: geoData.lat,
      lon: geoData.lon,
      timezone: geoData.timezone,
      isp: geoData.isp,
    };

    console.log("Geolocation resolved:", location.city, location.country);

    return new Response(
      JSON.stringify({ success: true, data: location }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Geolocation error:", errorMessage);
    
    // Return default Vietnam location on error
    return new Response(
      JSON.stringify({
        success: true,
        data: {
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
          error: errorMessage,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
