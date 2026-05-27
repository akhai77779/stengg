## Cách thức hoạt động của Live Chat (gửi tin)

```
User mở widget
    │
    ├─ Đã đăng nhập? → dùng user.id làm customerId
    │                   findOrCreateRoom() → tạo/lấy row trong live_chat_rooms
    │                   (customer_id = auth.uid()::text)
    │
    └─ Khách lạ → PreChatForm (tên, email, topic)
                  initGuestSession() gọi edge function `guest-chat-init`
                  → server tạo guest_id (`guest_xxx`), ký token,
                    set vào header `x-guest-token` của supabase client,
                    trả về room_id

User gõ + bấm Gửi
    │
    └─ useLiveChatMessages.sendMessage
         ├─ INSERT vào live_chat_messages
         │    (sender_id = customerId, sender_type = 'customer', ...)
         │    RLS đang bảo vệ:
         │      • Auth: "Authenticated users insert own room messages"
         │        sender_id = auth.uid()::text  HOẶC
         │        room.customer_id = auth.uid()::text
         │      • Guest (anon): "Guests insert messages by token"
         │        sender_id LIKE 'guest_%' AND verify_guest_session(...)
         │
         └─ UPDATE live_chat_rooms SET last_message,last_updated_at,status='active'
              RLS:
                • Auth: "Users update own rooms"  (customer_id = auth.uid())
                • Guest: "Guests update own room by token" (verify_guest_session)

Realtime
    • Auth user: postgres_changes channel `messages-{roomId}` (INSERT/UPDATE/DELETE)
    • Guest: không có realtime postgres_changes → fallback poll mỗi 2.5s
```

Khi mutation throw lỗi, hook show toast "Không thể gửi tin nhắn".

## Tình trạng kiểm tra hiện tại

Đã kiểm tra phía DB và RLS, **không phát hiện nguyên nhân rõ ràng**:
- GRANTs trên `live_chat_messages`, `live_chat_rooms`, `live_chat_typing` đầy đủ cho `anon`/`authenticated`/`service_role`
- Column-level INSERT/UPDATE đều OK
- Không có trigger nào fail
- Không có log ERROR/PANIC trong Postgres logs gần đây
- Tin nhắn customer cuối cùng là 19/03 (từ admin akhai77779) → có thể chưa ai thử gửi sau migration security gần đây, hoặc lỗi không log ra Postgres

→ Cần biết **chính xác** mutation fail ở bước nào (INSERT message hay UPDATE room) và message lỗi của Supabase trả về.

## Kế hoạch sửa

### Bước 1 — Bổ sung log lỗi chi tiết (để chẩn đoán)
File: `src/hooks/useLiveChatMessages.tsx`
- Trong `sendMessage.mutationFn`: log rõ kết quả INSERT (`error.message`, `error.code`, `error.details`, `error.hint`) trước khi throw, và tách thành 2 bước (insert + update room) để biết bước nào fail.
- Trong `sendMessage.onError`: hiển thị toast kèm `error.message` (rút gọn) thay vì chuỗi cứng "Không thể gửi tin nhắn", giúp user/dev thấy ngay lý do (ví dụ "new row violates row-level security policy" hoặc "permission denied").

### Bước 2 — Thử nghiệm
Sau khi deploy log:
1. Mở chat ở chế độ **khách** → gõ tin nhắn → đọc console + toast.
2. Mở chat ở chế độ **user đã đăng nhập** (không phải admin) → đọc console + toast.
3. Gửi lại lỗi cụ thể về cho tôi.

### Bước 3 — Khắc phục theo lỗi thu được
- Nếu là RLS violation → vá policy / kiểm tra `verify_guest_session` cho khách.
- Nếu là permission denied → bổ sung GRANT.
- Nếu là CORS edge function `guest-chat-init` → vá function.
- Nếu là client truyền sai `sender_id` (khi guest token refresh) → sửa `guestChatAuth.ts`.

## Không động đến
- Logic UI khác, không refactor lớn.
- Không thay đổi schema DB nếu chưa biết chắc lỗi.
