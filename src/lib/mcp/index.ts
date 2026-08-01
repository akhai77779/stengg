import { defineMcp, auth } from "@lovable.dev/mcp-js";
import listProductsTool from "./tools/list-products";
import listNewsTool from "./tools/list-news";
import getProductPriceTool from "./tools/get-product-price";

const SUPABASE_URL = "https://nptiddcelyxfbyvslotv.supabase.co";

export default defineMcp({
  name: "stengg-mcp",
  title: "ST Engineering MCP",
  version: "0.1.0",
  auth: auth.oauth.issuer({
    issuer: `${SUPABASE_URL}/auth/v1`,
    resource: `${SUPABASE_URL}/functions/v1/mcp`,
    acceptedAudiences: ["authenticated"],
    resourceName: "ST Engineering MCP",
  }),
  instructions:
    "Read-only tools for the ST Engineering trading platform. Use `list_products` to browse products, `get_product_price` to fetch a specific product's current price and 24h change, and `list_news` for the latest published articles.",
  tools: [listProductsTool, getProductPriceTool, listNewsTool],
});