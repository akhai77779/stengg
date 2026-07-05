# Kiểm tra nến trong LIVE — Kết quả & Kế hoạch sửa

## Chẩn đoán

Nến trong LIVE **KHÔNG hoạt động**. Bảng `price_history` trong Live không có bản ghi mới nào trong 24h qua — cây nến cuối cùng là **2026-06-11 10:53** (đã dừng gần 24 ngày).

Nguyên nhân: hai cron job trong Live đang gọi URL của project **Test (dev)** thay vì URL của Live:

| Cron job | Đang gọi | Đúng ra phải gọi |
|---|---|---|
| `sync-price-history-every-minute` | `https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-price-history` | URL project Live |
| `run_live_price_sync_loop()` (gọi bởi `sync-live-price-loop`) | `https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/run-live-price-sync` | URL project Live |

Kết quả: cron báo "succeeded" mỗi phút vì HTTP request được gửi đi thành công, nhưng request lại rơi vào backend Test, nên edge function của Live không bao giờ chạy → không có bản ghi mới vào `price_history` của Live. Log edge function `sync-price-history` và `run-live-price-sync` trong Live rỗng, xác nhận điều này.

`products.price` trong Live vẫn được cập nhật gần đây (vd 02/07) vì được ghi bởi trình duyệt admin qua `useEngineSyncToDb`, chứ không phải cron. Nhưng lịch sử nến (`price_history`) hoàn toàn không được bồi.

## Kế hoạch sửa

Chỉ can thiệp phía backend trong LIVE, không đụng UI, không đụng logic engine.

1. **Cập nhật cron `sync-price-history-every-minute`** — thay `net.http_post` URL từ dev ref sang project ref của Live (tự đọc bằng biến, không hard-code).
2. **Cập nhật function `public.run_live_price_sync_loop()`** — thay URL trong `PERFORM net.http_post(...)` sang project ref của Live.
3. **Bồi lấp khoảng trống 11/06 → 05/07 (tuỳ chọn)** — chạy edge function `backfill-price-history` cho 10 sản phẩm sau khi cron đã hoạt động lại, hoặc chấp nhận để nến tiếp tục từ hiện tại (đề nghị hỏi bạn).
4. **Xác minh** — sau 1–2 phút, chạy `SELECT MAX(recorded_at) FROM price_history` trong Live để đảm bảo có bản ghi mới, và mở log của `sync-price-history` trong Live để thấy các lần chạy.

## Chi tiết kỹ thuật

- Migration sẽ chạy `cron.unschedule` + `cron.schedule` lại cho `sync-price-history-every-minute` với URL đúng, và `CREATE OR REPLACE FUNCTION public.run_live_price_sync_loop()` với URL đúng.
- Vì migration Lovable chạy vào Test trước rồi mới sync sang Live khi publish, sẽ cần **publish** để fix có hiệu lực trên Live. Sau publish, cron cũ trong Live sẽ được thay thế.
- Không thay đổi edge function code, không thay đổi schema bảng.

## Câu hỏi cần bạn xác nhận trước khi triển khai

- Có cần **backfill** dữ liệu nến từ 11/06 đến hiện tại không, hay chỉ cần cho nến chạy tiếp từ bây giờ?
