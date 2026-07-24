## Mục tiêu
Đối chiếu nến giữa **DB `price_history`** (nguồn thật, do cron DB tick) và **client engine** (`useMarketEngine` chạy trong `/admin/products-monitor`) để phát hiện khi client bị lệch giá / lệch phút / lệch OHLC so với server, và cảnh báo ngay trên UI admin.

Ngoài admin engine, mình cũng thêm một cảnh báo nhẹ ở luồng public (`useSharedProductRealtime`): nếu `anchorPrice` client giữ lệch quá nhiều so với nến DB mới về thì log + soft-reset về giá DB (đã có logic `isPriceSane` ±50%, sẽ hạ ngưỡng và log rõ khi lệch).

## Phạm vi
- Không đổi cron/DB. Chỉ dùng dữ liệu `price_history` + `products` đã có.
- Không đụng UI người dùng cuối; công cụ đối chiếu nằm trong `/admin/products-monitor` (đã có `MarketEngineProvider` scope tại đây).
- Reuse script `scripts/reconcile-price-history.ts` sẵn có cho kiểm tra offline sâu hơn.

## Việc sẽ làm

### 1. Hook `useEngineDbReconciler`
`src/hooks/useEngineDbReconciler.tsx`
- Đầu vào: `engines: Record<productId, EngineState>` từ `useMarketEngine`, `mappings` (localId ↔ dbId) từ `useEngineSyncToDb`.
- Mỗi 15s: fetch 30 nến 1M gần nhất từ `price_history` cho từng dbId (1 câu `select` gom `in(product_id, [...])`).
- Với mỗi product, so sánh khớp theo `recorded_at` (giây làm tròn phút) với `engine.candles`:
  - **priceDriftPct** = |engineClose − dbClose| / dbClose ở nến 1M mới nhất chung.
  - **minuteLag** = số phút chênh giữa nến mới nhất DB và engine.
  - **ohlcMismatch** trên N nến overlap (đếm số nến |Δclose|>0.5%).
  - **missingInEngine / missingInDb**: phút DB có nhưng engine thiếu và ngược lại.
- Trả `ReconcileReport[]` + tổng trạng thái `ok | warn | drift`.

### 2. Panel `EngineDbReconcilePanel`
`src/components/admin/EngineDbReconcilePanel.tsx`, mount trong `AdminProductsMonitor.tsx`:
- Bảng: Symbol | DB last | Engine last | Δclose % | Minute lag | Mismatch/30 | Trạng thái
- Badge màu: xanh <0.3%, vàng 0.3–1%, đỏ >1% hoặc `minuteLag ≥ 2`.
- Nút **"Sync engine ← DB"**: gọi hàm mới trên `MarketEngineProvider` (bước 3) để reset engine của các product bị lệch bằng dữ liệu DB.
- Nút **"Chạy đối chiếu ngay"** (bỏ qua interval).

### 3. Mở rộng `MarketEngineProvider`
`src/hooks/useMarketEngine.ts`:
- Thêm `resyncFromDb(productIds: string[]): Promise<void>` — với mỗi product: fetch tối đa 1440 nến 1M từ `price_history` theo dbId map, chuyển sang `Candle[]`, ghi đè `engineState.candles`, reset `momentum=0`, `consecutiveTicks=0`, `lastUpdatedAt=Date.now()`. Persist snapshot như flow hiện tại.
- Không thay đổi vòng tick, không đụng shock events.

### 4. Nhấn mạnh cảnh báo drift ở luồng public
`src/hooks/useSharedProductRealtime.tsx`:
- Khi nhận row `price_history` real từ realtime, so `close_price` với `anchorPriceRef`. Nếu lệch >5% trong khi cả hai đều "sane" → `console.warn` với productId + Δ (log để debug, không đổi logic hiển thị).
- Không thay đổi UI / không đổi cơ chế throttle.

### 5. Ghi chú tài liệu
- `docs/SECURITY.md` không đổi.
- Thêm mục ngắn trong `README.md` "Đối chiếu engine ↔ DB" hướng dẫn dùng panel admin và script offline.

## Cách đo "đúng"
- Sau khi mount panel: với 10 sản phẩm, ở trạng thái bình thường, `Δclose%` phải ≤ 0.3% và `minuteLag = 0` sau ~15s.
- Bấm **Sync engine ← DB** thì tất cả các dòng đỏ chuyển xanh ngay lần đối chiếu kế tiếp.
- Script `deno run scripts/reconcile-price-history.ts --hours 1` chạy không lỗi (chỉ để verify DB tự thân, không phần của UI).

## Ngoài phạm vi (không làm)
- Không thay đổi cron DB, không đụng `sync_price_history_tick`.
- Không tự động resync định kỳ — chỉ thủ công qua nút, để tránh ghi đè state khi admin đang test scenario.
- Không thêm route mới ngoài admin.
