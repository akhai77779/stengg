# Rà soát & sửa logic biểu đồ ở /products/:id

## Vấn đề phát hiện

### 1. Hai pipeline dữ liệu chạy song song và xung đột nhau
`ProductDetail.tsx` vừa dùng `useSharedProductRealtime` (nguồn đang được render ra chart qua `effectiveCandleData`), vừa giữ nguyên pipeline cũ:
- `fetchProduct`, `fetchPriceHistory` → `fetchLocalPriceHistory` → `processLocalCandles`
- `refreshLatestCandles` + `fallbackIntervalRef` (polling 5s)
- `handleCandleUpdate` (định nghĩa nhưng **không** truyền cho chart, dead code)
- `candleCache`, `CACHE_TTL`, `nextCursor`, `loadMoreHistory`, `aggregateCandles` cục bộ
- `useEffect` copy `sharedRealtime.lineData` → `setChartData`, nhưng `chartData` cũng bị `fetchLocalPriceHistory`/`refreshLatestCandles` ghi đè

Hậu quả: query DB trùng lặp (hook đã fetch initial rows), state `highPrice/lowPrice` bị tranh chấp, polling chạy vô ích trong khi realtime đã connected, logic khó debug.

### 2. High/Low từ `product.high_24h ?? max(candles)` dùng nullish coalescing
Khi DB lưu `high_24h = 0` (đã từng xảy ra), `??` giữ lại `0` thay vì fallback sang candles → hiển thị `$0.00` hoặc lệch.

### 3. `CandlestickChart` reset zoom mỗi tick
`useEffect` cập nhật data luôn gọi `chartRef.current.timeScale().fitContent()` → người dùng zoom/pan xong tick kế tiếp bị kéo lại fitContent. Cần chỉ fit lần đầu hoặc khi đổi timeframe/sản phẩm.

### 4. `CandlestickChart` setData full thay vì update incremental
Đã có API `updateCandle` (incremental) nhưng `ProductDetail` không dùng — mỗi tick re-flatten cả mảng → lag khi data nhiều.

### 5. Synthetic row trong hook có thể đè real row
`buildSyntheticLiveRow` set `recorded_at` = đầu phút hiện tại. Nếu DB có row thật cùng phút, map key trùng → real row bị synthetic ghi đè (và ngược lại). Cần đánh dấu/tách synthetic ra khỏi map chính, hoặc chỉ append khi không có real row trong cùng bucket.

### 6. Synthetic interval recreate liên tục
`useEffect` synthetic phụ thuộc `product?.price` → mỗi lần product update interval bị dispose & dựng lại → có thể bỏ lỡ tick. Nên đọc qua ref.

### 7. AnimatedStat high/low trên page có 3 tầng fallback song song với hook
Header dùng `product.high_24h ? ... : highPrice ? ... : max(effectiveCandleData)`. Trong khi hook cũng trả ra `highPrice/lowPrice`. Trùng logic, dễ lệch.

## Thay đổi đề xuất

### A. `src/pages/ProductDetail.tsx` — gỡ pipeline cũ, dùng hook làm single source
- Xoá: `candleCache`, `CACHE_TTL`, `THROTTLE_MS` (đã pass vào hook, giữ tại 1 chỗ), `fetchProduct` riêng, `fetchPriceHistory`, `fetchLocalPriceHistory`, `processLocalCandles`, `refreshLatestCandles`, `loadMoreHistory`, `aggregateCandles`, `handleCandleUpdate`, `handleProductUpdate`, `fallbackIntervalRef`, `lastCandleTimeRef`, `candleFlash`, `nextCursor`, `paging`, `priceHistoryLoading` state cục bộ, các `useEffect` liên quan.
- Giữ: `useSharedProductRealtime` + `useUserTradesRealtime` + `fetchActivePositionCount`.
- `product`, `chartData`, `highPrice`, `lowPrice`, `isLoading` đọc trực tiếp từ hook (không copy vào state).
- `OptionsTradeSheet`/`ActiveOptionTrade` lấy `product` từ hook (cần `name`/`symbol`/`id` — bổ sung select nếu thiếu, đã có sẵn trong hook).
- Header high/low chỉ dùng `highPrice`/`lowPrice` từ hook, không tự fallback nữa.

### B. `src/hooks/useSharedProductRealtime.tsx`
- Đổi `product?.high_24h ?? ...` → helper `pickValid(value, fallback)` coi `null/0/NaN/Infinity` là invalid.
- `buildSyntheticLiveRow`: gắn `synthetic: true` (đã có) và **không** ghi đè row đã tồn tại tại cùng `recorded_at` nếu row đó không phải synthetic. Sửa `mergeRow`: nếu `row.synthetic` và map có key trùng không synthetic → bỏ qua.
- Synthetic interval: thay deps `product?.price` bằng ref (`productPriceRef`) để interval ổn định.

### C. `src/components/charts/CandlestickChart.tsx`
- Tách logic init data lần đầu vs update tiếp theo:
  - Lần đầu (`prevSeriesEmpty` hoặc đổi key data theo `timeframe/productId`) → `setData(...)` + `fitContent()`.
  - Tick tiếp theo cùng dataset → chỉ `series.update(lastCandle)` cho candle cuối, không gọi `fitContent`.
- Cho phép caller truyền `resetZoomKey` (string) — chỉ khi key thay đổi mới fitContent (ProductDetail sẽ truyền `${productId}-${timeframe}`).
- MA/EMA series: chỉ `setData` khi mảng indicator thực sự thay đổi (so length + last point).

### D. Test
- Mở rộng `useSharedProductRealtime.test.ts`:
  - `pickValid` coi 0/NaN là invalid.
  - `mergeRow`: synthetic không đè real cùng `recorded_at`.
- Thêm test snapshot logic cho `ProductDetail` (mock hook) để đảm bảo high/low/price hiển thị đúng khi `high_24h = 0`.

## Phạm vi không đụng
- `MiniPriceChart`, `MiniCandleChart`, market-engine, `useProductEngineData`, edge functions `ohlc`/`run-live-price-sync` — không thay đổi.
- Không đổi schema DB, không migration.

## Rủi ro
- Gỡ `loadMoreHistory` đồng nghĩa hết tính năng paging cũ. Hiện UI cũng không có nút gọi nó → an toàn xoá.
- Polling fallback bị loại; nếu realtime disconnected lâu, chart không tự refresh. Hook đã có synthetic loop 3s + nút reconnect → chấp nhận được; nếu cần, bổ sung 1 polling đơn giản trong hook khi `status==='disconnected'`.
