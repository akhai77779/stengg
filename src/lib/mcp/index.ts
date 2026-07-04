import { defineMcp } from "@lovable.dev/mcp-js";
import listProductsTool from "./tools/list-products";
import listNewsTool from "./tools/list-news";
import getProductPriceTool from "./tools/get-product-price";

export default defineMcp({
  name: "stengg-mcp",
  title: "ST Engineering MCP",
  version: "0.1.0",
  instructions:
    "Read-only tools for the ST Engineering trading platform. Use `list_products` to browse products, `get_product_price` to fetch a specific product's current price and 24h change, and `list_news` for the latest published articles.",
  tools: [listProductsTool, getProductPriceTool, listNewsTool],
});