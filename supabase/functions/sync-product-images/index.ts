/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://stengg.it.com",
  "https://www.stengg.it.com",
  "https://stengg-it-com.lovable.app",
  "https://id-preview--f9a00261-b7fb-4428-ad85-88f8d5788c27.lovable.app",
  "https://f9a00261-b7fb-4428-ad85-88f8d5788c27.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:8080",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await authClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin role
    const { data: roleData } = await authClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get all products with image_url from external domain
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, image_url, symbol")
      .not("image_url", "is", null);

    if (productsError || !products) {
      return new Response(JSON.stringify({ error: "Failed to fetch products" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[ImageSync] Processing ${products.length} products`);

    const stats = { synced: 0, skipped: 0, errors: 0, alreadyLocal: 0 };
    const SUPABASE_STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/uploads/product-icons/`;

    for (const product of products) {
      try {
        const currentUrl = product.image_url || "";

        // Skip if already a local Supabase storage URL
        if (currentUrl.includes("/storage/v1/object/public/uploads/")) {
          console.log(`[ImageSync] ${product.name}: already local, skipping`);
          stats.alreadyLocal++;
          continue;
        }

        // Skip if not from the external API domain
        if (!currentUrl.includes("stenggg.com") && !currentUrl.includes("stengg.com")) {
          console.log(`[ImageSync] ${product.name}: URL not from external API, skipping`);
          stats.skipped++;
          continue;
        }

        console.log(`[ImageSync] Downloading image for ${product.name}: ${currentUrl}`);

        // Download the image from external URL
        const imageResponse = await fetch(currentUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; ST-Engineering-Bot/1.0)",
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!imageResponse.ok) {
          console.warn(`[ImageSync] Failed to download ${product.name}: HTTP ${imageResponse.status}`);
          stats.errors++;
          continue;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        
        // Determine extension
        const ext = contentType.includes("png") ? "png" : contentType.includes("gif") ? "gif" : "jpg";
        
        // Create filename from symbol or product id
        const symbol = (product.symbol || product.id).replace(/[^A-Za-z0-9]/g, "_");
        const fileName = `${symbol}.${ext}`;
        const storagePath = `product-icons/${fileName}`;

        console.log(`[ImageSync] Uploading ${product.name} as ${storagePath}`);

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from("uploads")
          .upload(storagePath, imageBuffer, {
            contentType,
            upsert: true,
          });

        if (uploadError) {
          console.error(`[ImageSync] Upload error for ${product.name}:`, uploadError.message);
          stats.errors++;
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from("uploads")
          .getPublicUrl(storagePath);

        // Update product image_url in database
        const { error: updateError } = await supabase
          .from("products")
          .update({ image_url: publicUrl })
          .eq("id", product.id);

        if (updateError) {
          console.error(`[ImageSync] DB update error for ${product.name}:`, updateError.message);
          stats.errors++;
        } else {
          console.log(`[ImageSync] ✓ ${product.name}: ${publicUrl}`);
          stats.synced++;
        }

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ImageSync] Error processing ${product.name}:`, msg);
        stats.errors++;
      }
    }

    console.log(`[ImageSync] Done: ${stats.synced} synced, ${stats.alreadyLocal} already local, ${stats.skipped} skipped, ${stats.errors} errors`);

    return new Response(JSON.stringify({
      success: true,
      stats,
      message: `Synced ${stats.synced} images, ${stats.alreadyLocal} already up to date`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ImageSync] Fatal error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
