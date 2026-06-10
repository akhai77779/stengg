## Mục tiêu
Viết lại toàn bộ `supabase/functions/backfill-price-history/index.ts` theo spec phase-based mới để chart có xu hướng rõ ràng thay vì đi ngang.

## Cấu trúc file mới

1. **Hằng số BTC pattern** — giữ nguyên mảng `BTC_PCT` (real % changes từ Binance) làm micro-structure noise.

2. **Phase system**
   - `type Phase = "markup" | "pullback" | "markdown" | "relief" | "sideways" | "spike_up" | "spike_down"`
   - `PHASE_CFG`: drift + volMult + minLen/maxLen theo đúng spec
     - markup: drift +0.0012, len 60–240
     - pullback: -0.0008, 30–90
     - markdown: -0.0012, 60–200
     - relief: +0.0006, 30–80
     - sideways: 0, 120–360
     - spike_up: +0.005, 5–20
     - spike_down: -0.005, 5–20
   - `TRANSITIONS` table đúng spec (markup→[pullback×2,sideways,spike_up]…)
   - `START_PHASES` cho bullish/bearish/volatile/neutral

3. **PRODUCT_CONFIG** giữ nguyên 10 sản phẩm ST Engineering (AGIL, 360SA, MCS, SIM, COTM, IBMS, VICS, HED, C5ISR, WIG) với basePrice/volatility/trend như hiện tại.

4. **generateCandles(symbol, totalMinutes)**
   - `volScale = cfg.volatility / 0.005`
   - `nowMinute = floor(Date.now()/60000)*60000`
   - Chọn phase khởi đầu từ `START_PHASES[trend]`, set `phaseRemaining` ngẫu nhiên trong range
   - Loop `i = totalMinutes → 1`:
     - Nếu `phaseRemaining<=0`: chuyển phase qua transition table
     - `btcPct = BTC_PCT[(symbolHashOffset + idx) % len]`
     - `pctChange = btcPct * volScale * phase.volMult + phase.drift`
     - `close = open * (1 + pctChange)`
     - Hard clamp `base*0.3 … base*1.7`: nếu vượt, bounce 30% và đổi phase (vượt thấp → markup, vượt cao → markdown)
     - Wicks scale theo `phase.volMult`
     - Volume scale theo move size + phase.volMult
     - `recorded_at = new Date(nowMinute - i*60000).toISOString()`

5. **Deno.serve handler** giữ nguyên flow:
   - CORS preflight
   - Parse `{ days, productIds }` (default 30 ngày)
   - Query products available (lọc theo productIds nếu có)
   - Với mỗi product: delete cũ → generate → upsert chunk 500 vào `price_history` → update `products.price` bằng close cuối
   - Trả `{ ok, days, results }`

## Lưu ý
- Service role key, table `price_history` cột `product_id, recorded_at, open_price, high_price, low_price, close_price, volume` không đổi.
- Round giá 6 chữ số, volume 4 chữ số.
- Không sửa file khác.

## File thay đổi
- `supabase/functions/backfill-price-history/index.ts` — rewrite toàn bộ