## Vấn đề tìm thấy

Đúng, **đang có 2 nguồn dữ liệu nến chạy chồng nhau** ở 2 trang khác nhau:

### 1. Trang `/products` — Hiện tượng "nhảy biểu đồ khi F5"

Mỗi card sản phẩm đang đọc nến từ **2 chỗ**:

- **Nguồn A** (`useProductsData` ở `Products.tsx`): fetch **30 nến thô gần nhất** (1 phút mỗi nến) từ `price_history` → render ngay khi F5.
- **Nguồn B** (`useSharedProductRealtime` với `timeframe: '30m'` ở `LiveProductCard`): query lại `price_history`, **gộp thành nến 30 phút**, rồi thay thế Nguồn A khi load xong (`liveCandles.length >= 2`).

→ Vì 2 nguồn dùng **khung thời gian khác nhau** (1m vs 30m), khi F5 user thấy chart 1m trước, ~1 giây sau bị thay bằng chart 30m → cảm giác "nhảy biểu đồ", giá H/L/% cũng đổi.

### 2. Trang `/admin/products-monitor` — Shock Event không hoạt động trực quan

`AdminProductsMonitor.tsx` cũng có **2 nguồn**:

- **Nguồn A** (Market Engine local, `useMarketEngine`): nơi Shock Event được apply ngay lập tức.
- **Nguồn B** (`useSharedProductRealtime` đọc từ DB `price_history`): data đã được DB Sync ghi xuống.

Code ưu tiên Nguồn B:
```ts
const displayCandles = sharedRealtime.engineCandles.length > 0
  ? sharedRealtime.engineCandles    // ← DB (delay 3s + chỉ ghi khi sync ON)
  : aggregateCandles(getCandles(...)); // ← engine local (chỉ làm fallback)
```

→ Khi bấm Shock Event:
- Engine local đổi giá ngay lập tức.
- Nhưng chart đang vẽ Nguồn B (DB), nên bạn không thấy gì cho đến khi DB Sync ghi xuống (mỗi 3s) và Realtime push lại.
- Nếu DB Sync OFF, Shock Event không bao giờ xuất hiện trên chart ở trang admin.
- `currentPrice` cũng ưu tiên DB → giá hiển thị/target lệch so với engine thật.

## Cách sửa

### A. Trang `/products` — gộp về 1 nguồn

**File:** `src/hooks/useProductsData.tsx`
- Bỏ phần fetch 30 nến thô (đoạn `candlePromises` + `setProducts(... candles: candleMap[p.id])`). Khởi tạo `candles: []` và để `useSharedProductRealtime` lo toàn bộ.

**File:** `src/components/product/ProductList.tsx` (`LiveProductCard`)
- Khi `realtime.isLoading === true` hoặc `realtime.candles.length < 2`: hiển thị skeleton/`—` thay vì rơi về `product.candles` cũ. Chỉ render nến khi data 30m thực sự sẵn sàng.
- Bỏ điều kiện fallback `liveCandles.length >= 2 ? liveCandles : product.candles` (vì product.candles giờ luôn rỗng).

Kết quả: F5 → loading skeleton ngắn → render 1 lần duy nhất bằng nến 30m. Không nhảy.

### B. Trang `/admin/products-monitor` — đảo thứ tự ưu tiên về Engine local

**File:** `src/pages/admin/AdminProductsMonitor.tsx`
- Đổi `displayCandles` để ưu tiên **engine local** (vì admin là người điều khiển engine):
  ```ts
  const baseCandles = effectiveProductId ? getCandles(effectiveProductId) : [];
  const localCandles = timeInterval === '1M' ? baseCandles : aggregateCandles(baseCandles, timeInterval);
  const displayCandles = localCandles.length > 0 ? localCandles : sharedRealtime.engineCandles;
  ```
- Đổi `currentPrice` ưu tiên engine local: `getCurrentPrice(effectiveProductId) ?? sharedRealtime.latestPrice`.
- Giữ `useSharedProductRealtime` chỉ làm fallback khi engine chưa ready.

Kết quả: bấm Shock Event → giá engine đổi ngay → chart admin đổi ngay (không đợi DB Sync). User-side `/products` vẫn nhận được data qua DB Sync như cũ.

## Tác động

- `/products`: chỉ load nhanh hơn 1 chút (bỏ được N query parallel), không còn flash chart 1m → 30m.
- `/admin/products-monitor`: Shock Event hoạt động trực quan ngay lập tức, scenario sliders cũng phản ánh tức thì.
- Không đụng tới DB schema, edge functions, hay luồng DB Sync. Chỉ sửa logic ưu tiên ở client.
