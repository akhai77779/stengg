# Plan: Chuyển nến LIVE sang engine nội bộ

Bỏ hoàn toàn phụ thuộc vào API `admin.stenggg.com` (đã chết). Nến 1 phút sẽ được sinh nội bộ từ `products.price` (giá do market engine hiện có đang cập nhật) và ghi thẳng vào `price_history`.

## Mục tiêu
- Nến 1M trong Live tự động chạy trở lại, không cần bên thứ 3.
- Giữ nguyên schema `price_history` và mọi UI đang đọc từ nó (không đổi frontend).
- Tương thích với `run-live-price-sync` (loop 5s) và cron `sync-price-history-every-minute`.

## Thay đổi

### 1. `supabase/functions/sync-price-history/index.ts`
- Bỏ toàn bộ đoạn fetch tới `admin.stenggg.com/api/app/option/getKline` và logic retry DNS.
- Thay bằng logic sinh candle nội bộ cho từng product:
  - Lấy `products.price` hiện tại (P).
  - Xác định "phút hiện tại" = `date_trunc('minute', now())`.
  - Đọc candle gần nhất của product trong `price_history` cho khung 1M.
  - Nếu candle của phút hiện tại **chưa tồn tại**: tạo mới với `open = close phút trước (hoặc P nếu chưa có)`, `high = low = close = P`.
  - Nếu **đã tồn tại**: update `close = P`, `high = max(high, P)`, `low = min(low, P)`, giữ `open` cũ.
  - `volume`: cộng thêm một lượng nhỏ ngẫu nhiên (vd. 1000–5000) để chart trông sinh động; hoặc để 0 nếu UI không dùng.
- Giữ nguyên phần auth (service-role JWT), CORS, log format `[Sync] …` đã hoàn thiện ở lượt trước.
- Trả về JSON `{ ok, updated: N, inserted: M }`.

### 2. `supabase/functions/run-live-price-sync/index.ts` (nếu cần)
- Function này chạy loop 5s x 12 vòng. Hiện tại đang tick giá vào `products.price`. Kiểm tra và đảm bảo mỗi tick nó cũng gọi cùng logic upsert candle như trên (hoặc gọi nội bộ `sync-price-history` mỗi vòng).
- Nếu đã có sẵn logic tick giá → chỉ cần append đoạn upsert candle 1M cùng transaction.

### 3. Không đổi database schema
- Không cần migration mới cho bảng. Chỉ dùng lại `price_history` hiện có.

### 4. Không backfill dữ liệu 11/06 → nay
- Theo mặc định KHÔNG backfill (nến gap là dữ liệu mock cũ, không quan trọng). Nếu sau này muốn, sẽ làm ở bước riêng.

## Kiểm thử
1. Deploy `sync-price-history` (auto).
2. Gọi thủ công 1 lần → xác nhận log `[Sync] inserted/updated N candles`.
3. Query `SELECT product_id, max(timestamp) FROM price_history GROUP BY product_id` → thấy timestamp là phút hiện tại.
4. Đợi 1–2 phút → thấy candle mới sinh tiếp.
5. Mở `/products` trong preview → chart 1M có nến chạy realtime.

## Ghi chú kỹ thuật
- Vì bản fix cron/auth ở lượt trước chưa publish lên Live, sau khi merge plan này người dùng cần **Publish** để cả 2 thay đổi (cron auth + engine nội bộ) cùng ra Live.
- Engine nội bộ = mock, không phải giá thị trường thật — phù hợp với bản chất "professional trading demo platform" của dự án.
