# Sửa hành vi chart ở /products/:id

## Vấn đề

1. **Đổi timeframe (1m/5m/15m...) refetch DB không cần thiết**
   `useSharedProductRealtime` có `timeframe` trong deps của effect fetch initial. Mỗi lần bấm sang timeframe khác (cache key khác) → `setRows([])` → chart blank → fetch lại Supabase. Trong khi `aggregateOHLCData` đã có khả năng nén cùng một `rows` thành mọi timeframe ở client.

2. **Chart luôn reset zoom khi `resetZoomKey` đổi**
   `CandlestickChart` đang gọi đồng thời `setVisibleLogicalRange({from: total-60, to: total+2})` + `scrollToRealTime()`. Hai lệnh đánh nhau, đôi khi nhảy giật. Mỗi lần đổi timeframe key đổi → reset. Mỗi lần unmount/remount (rời trang quay lại) → `hasInitialDataRef` mất → `isFirstLoad=true` → lại reset.

3. **Khi candle mới khiến `data.length` tăng** code chạy nhánh "full setData" (vì `!sameLength`). `setData` của lightweight-charts có thể auto-shift visible range → cảm giác nhảy.

## Thay đổi

### A. `src/hooks/useSharedProductRealtime.tsx` — Tách fetch khỏi timeframe

- **Cache theo `productId` thôi**, không kèm timeframe. Raw `rows` từ `price_history` dùng chung cho mọi timeframe.
- Effect `fetchInitial` deps đổi từ `[isActive, productId, timeframe]` → `[isActive, productId]`. Khi đổi timeframe không refetch, không clear rows, không blank chart.
- Lookback ban đầu: dùng lookback của timeframe **lớn nhất user có khả năng chọn** (`1d` = 60 ngày) hoặc lazy-extend: nếu sau khi đổi sang timeframe lớn hơn thấy `aggregateOHLCData(rows, tf).length < MIN_AGGREGATED_CANDLES[tf]` thì fetch bổ sung 1 lần. Triển khai đơn giản: luôn fetch với `LOOKBACK_MS['1d']` + `limit(1000)`. Nếu cần tiết kiệm, thêm effect riêng `[timeframe]` chỉ trigger fetch bổ sung khi candles không đủ.
- Khi `productId` đổi mà cache có → hydrate ngay; không xoá rows trước khi fetch xong (đã làm).
- Synthetic interval giữ nguyên.

### B. `src/components/charts/CandlestickChart.tsx` — Reset có chủ đích và không xung đột

- Bỏ `scrollToRealTime()`. Chỉ dùng `setVisibleLogicalRange` 1 lần khi cần reset.
- Logic mới:
  - **First mount** (chưa có data lần nào): set visible range = last `min(60, total)` candles.
  - **`resetZoomKey` đổi**: tương tự — set visible range last 60. Nhưng `resetZoomKey` ProductDetail sẽ truyền chỉ `${productId}` (xem mục C) → chỉ reset khi đổi sản phẩm, không reset khi đổi timeframe.
  - **Cùng key, data update**: dùng `series.update(last)` nếu length không đổi; nếu length tăng (candle mới) dùng `update()` cho candle cuối (vẫn incremental) — chỉ fallback `setData` khi length giảm hoặc out-of-order.
- Lưu visible logical range vào `useRef` trước khi `setData` (khi buộc phải setData) và restore sau khi setData để khỏi giật.
- Bỏ `hasInitialDataRef` reset theo unmount: vẫn cần local, nhưng kết hợp với restore range ở trên để remount không nhảy.

### C. `src/pages/ProductDetail.tsx`

- Đổi `resetZoomKey` từ `${id}-${timeframe}` → chỉ `${id}`. Đổi timeframe không kích hoạt reset zoom (chart tự tái aggregate, chỉ là dataset khác).
- Không cần đổi gì khác.

## Kết quả mong đợi

- Đổi 1m → 5m → 15m: chart đổi candle mượt, không blank, không nhảy về cuối, không refetch DB.
- Quay ra rồi vào lại `/products/:id`: hydrate từ cache, hiển thị đúng nơi đang xem (60 nến cuối) không "chạy từ đầu".
- Candle realtime mới về: chỉ update nến cuối, người dùng đang pan/zoom không bị kéo.

## Phạm vi không đụng

- Edge function, DB schema, market engine, `MiniCandleChart`, `ProductList` — không thay đổi.
- API public của hook (`candles`, `latestPrice`, ...) giữ nguyên.

## Rủi ro

- Fetch ban đầu với lookback 60 ngày + limit 1000 có thể nặng hơn cho sản phẩm ít hoạt động. Mitigate: vẫn `.limit(1000)` như hiện tại, chỉ thay đổi `since`. Có thể thêm lazy-extend nếu cần sau.
