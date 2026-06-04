# Test cho cache productId + preserve visible range

## Mục tiêu
Đảm bảo 2 hành vi đã sửa hôm trước không bị regression:
1. Cache trong `useSharedProductRealtime` keyed theo `productId` thôi — đổi timeframe không tạo entry mới, không invalidate.
2. Khi `setData` (đổi timeframe / có nến mới), visible range của người dùng được giữ nguyên thay vì reset về đầu hoặc fit-content.

Cả hai test đều là pure unit tests (Vitest, không cần DOM/jsdom-canvas), chạy chung file hiện có.

## Thay đổi code (để có thể test)

### A. `src/hooks/useSharedProductRealtime.tsx`
Export thêm các helper test-only (không đổi behavior runtime):
- `export const cacheKey` (hiện đang là module-private function)
- `export function __getSharedProductCache()` → trả `sharedProductCache` (Map) để inspect.
- `export function __resetSharedProductCache()` → `sharedProductCache.clear()` để cô lập test.

Tên có prefix `__` để rõ là internal/test-only.

### B. `src/components/charts/CandlestickChart.tsx`
Trích logic tính visible range mới ra thành pure helper export được:

```ts
export function computeNextVisibleRange(
  prevRange: { from: number; to: number } | null,
  newTotal: number,
  mode: 'reset' | 'preserve',
  resetWindow = 60,
): { from: number; to: number } | null
```

- `mode='reset'`: trả `{ from: max(0, total-min(resetWindow,total)), to: total+2 }` (dùng cho first mount / đổi product).
- `mode='preserve'`: clamp `prevRange` vào `newTotal` (đúng logic hiện tại trong nhánh "length changed"). Nếu `prevRange` null → null (giữ nguyên).

`useEffect` trong component gọi helper này thay vì tính inline. Hành vi giữ nguyên 100%.

## Test mới

### `src/hooks/useSharedProductRealtime.test.ts` (mở rộng)

Mock `@/integrations/supabase/client` ở đầu file (tối thiểu, không cần real network):
```ts
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({}), channel: () => ({}) } }));
```

Thêm `describe('shared product cache key')`:
- `cacheKey(id, '1m') === cacheKey(id, '5m') === cacheKey(id, '1h')` — không phụ thuộc timeframe.
- `cacheKey(idA) !== cacheKey(idB)` — khác product khác key.

Thêm `describe('shared product cache storage')`:
- `__resetSharedProductCache()` trước mỗi test.
- Ghi entry cho `(id, '1m')` xong đọc lại bằng `(id, '5m')` → nhận đúng entry (chứng minh raw rows dùng chung mọi timeframe).
- Cache size không tăng khi cùng productId, chỉ tăng khi product khác.

### `src/components/charts/CandlestickChart.test.ts` (mới)

`describe('computeNextVisibleRange')`:
- `mode='reset'`, total=200 → `{ from: 140, to: 202 }`.
- `mode='reset'`, total=10 → `{ from: 0, to: 12 }` (ít hơn window).
- `mode='reset'`, total=0 → `null` hoặc range trống (theo impl — assert đúng cái đã chọn).
- `mode='preserve'`, prev `{from:100,to:160}`, newTotal=180 → `{from:100,to:160}` (vẫn nằm trong).
- `mode='preserve'`, prev `{from:100,to:160}`, newTotal=120 → clamp `to=122`, `from=62` (giữ width=60).
- `mode='preserve'`, prev=null → null (không can thiệp).
- Width của range được bảo toàn khi clamp.

## Không đụng tới
- Logic edge function, DB, market engine.
- Public API hook (`candles`, `latestPrice`, ...).
- Hành vi runtime của chart (chỉ refactor inline math thành helper export).

## Chạy test
`bunx vitest run src/hooks/useSharedProductRealtime.test.ts src/components/charts/CandlestickChart.test.ts`
