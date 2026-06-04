## Tóm tắt chẩn đoán

Telegram nhận thông báo "lúc có lúc không" do **2 nguyên nhân độc lập**:

### 1. Trigger DB gửi qua `pg_net` thường xuyên timeout (nguyên nhân chính)

Hầu hết Telegram được gửi từ các trigger DB (`notify_telegram_on_notification`, `notify_admin_on_withdrawal_request`, `notify_admin_on_option_trade`) gọi edge function `telegram-notify` qua `net.http_post(...)`.

Khi kiểm tra `net._http_response` trong 10 phút gần nhất:

```text
status_code   |  số lượng
--------------+----------
200 (success) |   ~20
NULL (timeout)|   ~10   ← error_msg: "Timeout of 5000 ms reached, DNS time: 5001ms"
```

Tức ~30–50% lệnh gọi từ trigger bị **timeout 5s** (mặc định của `pg_net`, không đủ cho edge function cold-start hoặc khi gateway Telegram chậm). Những request timeout này KHÔNG retry → Telegram không bao giờ nhận. Đây là nguyên nhân chính người dùng thấy "lúc có lúc không".

### 2. LiveChat Telegram chỉ chạy khi admin đang mở panel

`src/components/admin/LiveChatAdminPanel.tsx` (dòng 234–264) gọi `telegram-notify` từ trình duyệt qua realtime subscription. Nếu **không có admin nào đang mở `/admin/live-chat`** (hoặc LiveChatAdminSheet) thì tin nhắn khách hàng sẽ không tạo Telegram nào hết. Đây là lý do tin chat khách hàng đôi khi mất hoàn toàn.

---

## Kế hoạch sửa

### A. Khắc phục timeout của trigger DB (ưu tiên cao)

Tạo migration mới:

1. Bọc `net.http_post` trong **một edge function relay** chạy bất đồng bộ (không chờ HTTP) — cách đơn giản nhất là nâng timeout pg_net + retry:
   - Truyền `timeout_milliseconds := 15000` vào tất cả `net.http_post` trong 3 function trigger (`notify_telegram_on_notification`, `notify_admin_on_withdrawal_request`, `notify_admin_on_option_trade`).
   - Thêm khối `BEGIN ... EXCEPTION WHEN OTHERS THEN ... END` để lỗi gửi Telegram không làm fail nghiệp vụ gốc.

2. Tạo cron job retry mỗi 1 phút quét `net._http_response` các request URL `telegram-notify` bị timeout/lỗi trong 10 phút gần nhất → gửi lại (cần lưu payload). Phương án nhẹ hơn: tạo bảng `telegram_outbox(id, payload jsonb, status, attempts, created_at)`; trigger insert vào outbox thay vì gọi pg_net trực tiếp; cron job mỗi 30s quét outbox `pending`/`failed` → gọi edge function → đánh dấu `sent`.

   Đề xuất chọn **phương án outbox** vì đảm bảo không mất tin và dễ debug. Có UI `/admin/data-health` để xem hàng đợi.

### B. Khắc phục LiveChat phụ thuộc trình duyệt admin

Chuyển việc gửi Telegram cho `live_chat_messages` từ phía client sang DB trigger:

1. Tạo trigger `AFTER INSERT ON public.live_chat_messages WHEN NEW.sender_type='customer'` đẩy 1 dòng vào `telegram_outbox` (hoặc gọi `telegram-notify` trực tiếp với timeout 15s).
2. Bỏ `sendTelegramNotification` trong `LiveChatAdminPanel.tsx` để tránh gửi double khi admin đang mở panel (hoặc giữ lại với cờ debounce theo `update_id`).

### C. Quan sát & xác minh

1. Thêm trang `/admin/data-health` mục mới "Telegram queue" hiển thị 20 outbox mới nhất + nút "Resend".
2. Sau khi deploy, kiểm tra `net._http_response` 10 phút: tỉ lệ timeout phải xuống <5%.
3. Test: tạo 1 notification giả → kỳ vọng Telegram nhận trong <10s. Tạo tin chat từ guest khi không có admin online → Telegram vẫn nhận.

---

## Các file dự kiến thay đổi

- `supabase/migrations/<new>.sql` — sửa 3 trigger functions (thêm `timeout_milliseconds`, EXCEPTION), tạo bảng `telegram_outbox`, trigger live_chat_messages, hàm xử lý outbox.
- `supabase/functions/process-telegram-outbox/index.ts` — function mới quét outbox và gửi.
- `supabase/config.toml` — `verify_jwt = false` cho function mới.
- Cron job `select cron.schedule('process-telegram-outbox', '*/30 * * * * *', ...)` (insert qua tool `supabase--insert`, không qua migration).
- `src/components/admin/LiveChatAdminPanel.tsx` — bỏ `sendTelegramNotification` gọi từ realtime.
- (Tùy chọn) `src/pages/admin/AdminDataHealth.tsx` — thêm panel monitor outbox.

## Câu hỏi cho bạn

1. Bạn muốn làm **phương án outbox đầy đủ** (chắc chắn nhất, không mất tin) hay chỉ làm **bản nhẹ**: nâng `timeout_milliseconds=15000` + thêm trigger DB cho live-chat? Bản nhẹ nhanh hơn nhưng vẫn có thể rớt ~1–2%.
2. Có muốn thêm UI giám sát outbox trong `/admin/data-health` không?
