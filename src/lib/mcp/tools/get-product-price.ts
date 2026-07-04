import { createClient } from "@supabase/supabase-js";
import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";

declare const process: { env: Record<string, string | undefined> };

export default defineTool({
  name: "get_product_price",
  title: "Get product price",
  description:
    "Return the current market price and 24h change for a single ST Engineering trading product, looked up by id or symbol.",
  inputSchema: {
    idOrSymbol: z
      .string()
      .min(1)
      .describe("Product id (e.g. 'agil') or trading symbol (e.g. 'AGIL/USDT')."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ idOrSymbol }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase
      .from("products")
      .select("id, name, symbol, category, current_price, price_change_24h, updated_at")
      .or(`id.eq.${idOrSymbol},symbol.eq.${idOrSymbol}`)
      .maybeSingle();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    if (!data) {
      return {
        content: [{ type: "text", text: `No product found matching "${idOrSymbol}".` }],
        isError: true,
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { product: data },
    };
  },
});