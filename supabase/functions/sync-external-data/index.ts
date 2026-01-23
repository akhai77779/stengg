/// <reference lib="deno.ns" />

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXTERNAL_API_URL = "https://admin.stenggg.com/api/app/indexList";
const EXTERNAL_NEWS_API_URL = "https://admin.stenggg.com/api/app/getNews";
const EXTERNAL_COIN_LIST_API_URL = "https://admin.stenggg.com/api/app/option/getBetCoinList";
const EXTERNAL_OPTION_TIME_API_URL = "https://admin.stenggg.com/api/app/option/getOptionTime";

// Actual API structure based on response
interface OptionItem {
  pair_id?: number;
  pair_name?: string;
  symbol?: string;
  base_coin_name?: string;
  fullname?: string;
  introduction?: string;
  coin_icon?: string;
  price?: string | number;
  increase?: number;
  increaseStr?: string;
  status?: number;
  sort?: number;
  sort_index?: number;
}

interface NoticeItem {
  id?: number;
  title?: string;
  body?: string;
  excerpt?: string;
  cover?: string;
  full_cover?: string;
  category_name?: string;
  view_count?: number;
  is_recommend?: number;
  status?: number;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

interface HomeItem {
  id?: number;
  title?: string;
  image?: string;
  link?: string;
  order?: number;
  status?: number;
}

interface ExternalApiResponse {
  code?: number;
  message?: string;
  data?: {
    homeList?: HomeItem[];
    noticeList?: NoticeItem[];
    optionList?: OptionItem[];
    wilsonlink?: {
      kefu_link?: string;
    };
  };
}

interface NewsApiResponse {
  code?: number;
  message?: string;
  data?: {
    list?: NoticeItem[];
    total?: number;
  };
}

interface BetCoinItem {
  pair_id?: number;
  pair_name?: string;
  symbol?: string;
  base_coin_name?: string;
  fullname?: string;
  introduction?: string;
  coin_icon?: string;
  price?: string | number;
  increase?: number;
  increaseStr?: string;
  status?: number;
  sort?: number;
  high?: string | number;
  low?: string | number;
  vol?: string | number;
  high_24h?: string | number;
  low_24h?: string | number;
  turnover?: string | number;
}

interface BetCoinListResponse {
  code?: number;
  message?: string;
  data?: BetCoinItem[];
}

interface OptionTimeItem {
  id?: number;
  name?: string;
  seconds?: number;
  status?: number;
  sort?: number;
}

interface OptionTimeResponse {
  code?: number;
  message?: string;
  data?: OptionTimeItem[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Fetching data from external API:", EXTERNAL_API_URL);

    // Fetch from external API
    const response = await fetch(EXTERNAL_API_URL, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "ST-Engineering-Sync/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`External API returned ${response.status}: ${response.statusText}`);
    }

    const externalData: ExternalApiResponse = await response.json();
    console.log("API response code:", externalData.code, "message:", externalData.message);

    const dataContainer = externalData.data;
    if (!dataContainer) {
      throw new Error("No data container in API response");
    }

    // Extract data from actual API structure
    const homeList = dataContainer.homeList || [];
    const noticeList = dataContainer.noticeList || [];
    const optionList = dataContainer.optionList || [];

    console.log(`Found: ${homeList.length} banners (homeList), ${optionList.length} products (optionList), ${noticeList.length} news (noticeList)`);

    const results = {
      banners: { synced: 0, errors: 0, skipped: 0 },
      products: { synced: 0, errors: 0, skipped: 0 },
      news: { synced: 0, errors: 0, skipped: 0 },
    };

    // Sync banners from homeList
    for (let i = 0; i < homeList.length; i++) {
      const h = homeList[i];
      try {
        const bannerData = {
          title: h.title || `Banner ${i + 1}`,
          subtitle: null,
          image_url: h.image || "",
          link_url: h.link || null,
          display_order: h.order ?? i,
          is_active: h.status === 1,
        };

        if (!bannerData.image_url) {
          console.log(`Skipping banner ${i}: no image`);
          results.banners.skipped++;
          continue;
        }

        const { error } = await supabase
          .from("hero_banners")
          .insert(bannerData);

        if (error) {
          console.error(`Error inserting banner ${i}:`, error.message);
          results.banners.errors++;
        } else {
          results.banners.synced++;
        }
      } catch (err) {
        console.error(`Error processing banner ${i}:`, err);
        results.banners.errors++;
      }
    }

    // Sync products from optionList (trading pairs)
    for (let i = 0; i < optionList.length; i++) {
      const o = optionList[i];
      try {
        const productName = o.fullname || o.base_coin_name || o.pair_name || `Product ${i + 1}`;
        const price = parseFloat(String(o.price || 0)) || 0;
        const priceChange = o.increase ?? 0;
        // Build symbol for getKline API (e.g., "WIG/USDT")
        const pairName = o.pair_name || "";
        const symbol = pairName.includes("/") ? pairName : (pairName ? `${pairName}/USDT` : null);

        const productData = {
          name: productName,
          description: o.introduction || null,
          image_url: o.coin_icon || null,
          category: "crypto",
          price: price,
          volume: "0",
          price_change: priceChange,
          status: o.status === 1 ? "available" : "unavailable",
          symbol: symbol,
        };

        if (!productData.name) {
          console.log(`Skipping product ${i}: no name`);
          results.products.skipped++;
          continue;
        }

        // Check if product with same name exists
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("name", productData.name)
          .maybeSingle();

        if (existing) {
          // Update existing product
          const { error } = await supabase
            .from("products")
            .update({
              description: productData.description,
              image_url: productData.image_url,
              price: productData.price,
              price_change: productData.price_change,
              status: productData.status,
              symbol: productData.symbol,
            })
            .eq("id", existing.id);

          if (error) {
            console.error(`Error updating product ${productData.name}:`, error.message);
            results.products.errors++;
          } else {
          console.log(`Updated product: ${productData.name}`);
            results.products.synced++;
          }
        } else {
          // Skip creating new products - only update existing ones
          console.log(`Skipping new product (auto-create disabled): ${productData.name}`);
          results.products.skipped++;
        }
      } catch (err) {
        console.error(`Error processing product ${i}:`, err);
        results.products.errors++;
      }
    }

    // Sync news from noticeList
    for (let i = 0; i < noticeList.length; i++) {
      const n = noticeList[i];
      try {
        const newsData = {
          title: n.title || `Notice ${i + 1}`,
          content: n.body || n.excerpt || "",
          summary: n.excerpt || null,
          image_url: n.full_cover || n.cover || null,
          category: "company",
          views: n.view_count || 0,
          is_featured: n.is_recommend === 1,
        };

        if (!newsData.title || !newsData.content) {
          console.log(`Skipping news ${i}: missing title or content`);
          results.news.skipped++;
          continue;
        }

        // Check if news with same title exists
        const { data: existing } = await supabase
          .from("news")
          .select("id")
          .eq("title", newsData.title)
          .maybeSingle();

        if (existing) {
          // Update existing news
          const { error } = await supabase
            .from("news")
            .update({
              content: newsData.content,
              summary: newsData.summary,
              image_url: newsData.image_url,
              views: newsData.views,
              is_featured: newsData.is_featured,
            })
            .eq("id", existing.id);

          if (error) {
            console.error(`Error updating news ${newsData.title}:`, error.message);
            results.news.errors++;
          } else {
            console.log(`Updated news: ${newsData.title}`);
            results.news.synced++;
          }
        } else {
          // Insert new news
          const { error } = await supabase
            .from("news")
            .insert(newsData);

          if (error) {
            console.error(`Error inserting news ${newsData.title}:`, error.message);
            results.news.errors++;
          } else {
            console.log(`Inserted news: ${newsData.title}`);
            results.news.synced++;
          }
        }
      } catch (err) {
        console.error(`Error processing news ${i}:`, err);
        results.news.errors++;
      }
    }

    // Fetch additional news from getNews API
    console.log("Fetching additional news from:", EXTERNAL_NEWS_API_URL);
    try {
      const newsResponse = await fetch(EXTERNAL_NEWS_API_URL, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "ST-Engineering-Sync/1.0",
        },
      });

      if (newsResponse.ok) {
        const newsApiData: NewsApiResponse = await newsResponse.json();
        const newsList = newsApiData.data?.list || [];
        console.log(`Found ${newsList.length} additional news from getNews API`);

        for (let i = 0; i < newsList.length; i++) {
          const n = newsList[i];
          try {
            const newsData = {
              title: n.title || `News ${i + 1}`,
              content: n.body || n.excerpt || "",
              summary: n.excerpt || null,
              image_url: n.full_cover || n.cover || null,
              category: n.category_name || "company",
              views: n.view_count || 0,
              is_featured: n.is_recommend === 1,
            };

            if (!newsData.title || !newsData.content) {
              console.log(`Skipping getNews item ${i}: missing title or content`);
              continue;
            }

            // Check if news with same title exists
            const { data: existing } = await supabase
              .from("news")
              .select("id")
              .eq("title", newsData.title)
              .maybeSingle();

            if (existing) {
              const { error } = await supabase
                .from("news")
                .update({
                  content: newsData.content,
                  summary: newsData.summary,
                  image_url: newsData.image_url,
                  views: newsData.views,
                  is_featured: newsData.is_featured,
                })
                .eq("id", existing.id);

              if (error) {
                console.error(`Error updating news from getNews ${newsData.title}:`, error.message);
                results.news.errors++;
              } else {
                console.log(`Updated news from getNews: ${newsData.title}`);
                results.news.synced++;
              }
            } else {
              const { error } = await supabase
                .from("news")
                .insert(newsData);

              if (error) {
                console.error(`Error inserting news from getNews ${newsData.title}:`, error.message);
                results.news.errors++;
              } else {
                console.log(`Inserted news from getNews: ${newsData.title}`);
                results.news.synced++;
              }
            }
          } catch (err) {
            console.error(`Error processing getNews item ${i}:`, err);
            results.news.errors++;
          }
        }
      } else {
        console.warn(`getNews API returned ${newsResponse.status}`);
      }
    } catch (newsErr) {
      console.error("Error fetching from getNews API:", newsErr);
    }

    // Fetch products from getBetCoinList API
    console.log("Fetching products from:", EXTERNAL_COIN_LIST_API_URL);
    try {
      const coinListResponse = await fetch(EXTERNAL_COIN_LIST_API_URL, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "ST-Engineering-Sync/1.0",
        },
      });

      if (coinListResponse.ok) {
        const coinListData: BetCoinListResponse = await coinListResponse.json();
        const coinList = coinListData.data || [];
        console.log(`Found ${coinList.length} products from getBetCoinList API`);

        for (let i = 0; i < coinList.length; i++) {
          const coin = coinList[i];
          try {
            const productName = coin.fullname || coin.base_coin_name || coin.pair_name || `Coin ${i + 1}`;
            const price = parseFloat(String(coin.price || 0)) || 0;
            const priceChange = coin.increase ?? 0;
            const volume = String(coin.vol || "0");
            // Parse high/low 24h prices
            const high24h = parseFloat(String(coin.high_24h || coin.high || 0)) || null;
            const low24h = parseFloat(String(coin.low_24h || coin.low || 0)) || null;
            // Parse turnover (trading volume in money terms)
            const turnover = String(coin.turnover || "0");

            const productData = {
              name: productName,
              description: coin.introduction || null,
              image_url: coin.coin_icon || null,
              category: "crypto",
              price: price,
              volume: volume,
              turnover: turnover,
              price_change: priceChange,
              status: coin.status === 1 ? "available" : "unavailable",
              high_24h: high24h,
              low_24h: low24h,
            };

            if (!productData.name) {
              continue;
            }

            // Check if product with same name exists
            const { data: existing } = await supabase
              .from("products")
              .select("id")
              .eq("name", productData.name)
              .maybeSingle();

            if (existing) {
              const { error } = await supabase
                .from("products")
                .update({
                  description: productData.description,
                  image_url: productData.image_url,
                  price: productData.price,
                  volume: productData.volume,
                  turnover: productData.turnover,
                  price_change: productData.price_change,
                  status: productData.status,
                  high_24h: productData.high_24h,
                  low_24h: productData.low_24h,
                })
                .eq("id", existing.id);

              if (error) {
                console.error(`Error updating product from coinList ${productData.name}:`, error.message);
                results.products.errors++;
              } else {
                console.log(`Updated product from coinList: ${productData.name}`);
                results.products.synced++;
              }
            } else {
              // Skip creating new products - only update existing ones
              console.log(`Skipping new product from coinList (auto-create disabled): ${productData.name}`);
              results.products.skipped++;
            }
          } catch (err) {
            console.error(`Error processing coinList item ${i}:`, err);
            results.products.errors++;
          }
        }
      } else {
        console.warn(`getBetCoinList API returned ${coinListResponse.status}`);
      }
    } catch (coinErr) {
      console.error("Error fetching from getBetCoinList API:", coinErr);
    }

    // Fetch option times from getOptionTime API and save to app_settings
    console.log("Fetching option times from:", EXTERNAL_OPTION_TIME_API_URL);
    try {
      const optionTimeResponse = await fetch(EXTERNAL_OPTION_TIME_API_URL, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "User-Agent": "ST-Engineering-Sync/1.0",
        },
      });

      if (optionTimeResponse.ok) {
        const optionTimeData: OptionTimeResponse = await optionTimeResponse.json();
        const optionTimes = optionTimeData.data || [];
        console.log(`Found ${optionTimes.length} option times`);

        // Save option times to app_settings
        await supabase
          .from("app_settings")
          .upsert({
            key: "option_times",
            value: { times: optionTimes },
          }, { onConflict: "key" });
        console.log("Saved option times to app_settings");
      } else {
        console.warn(`getOptionTime API returned ${optionTimeResponse.status}`);
      }
    } catch (optionErr) {
      console.error("Error fetching from getOptionTime API:", optionErr);
    }

    // Save kefu_link to app_settings if available
    if (dataContainer.wilsonlink?.kefu_link) {
      try {
        await supabase
          .from("app_settings")
          .upsert({
            key: "live_chat_url",
            value: { url: dataContainer.wilsonlink.kefu_link },
          }, { onConflict: "key" });
        console.log("Updated live_chat_url:", dataContainer.wilsonlink.kefu_link);
      } catch {
        // Ignore
      }
    }

    // Log audit
    try {
      await supabase.from("audit_logs").insert({
        user_id: "00000000-0000-0000-0000-000000000000",
        action: "sync_external_data",
        entity_type: "system",
        details: {
          source: EXTERNAL_API_URL,
          results,
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      // Ignore audit log errors
    }

    console.log("Sync completed:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Đồng bộ dữ liệu thành công",
        results,
        source: EXTERNAL_API_URL,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
