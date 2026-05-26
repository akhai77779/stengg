# Plan: Live chat kiểu LiveChat.com

Nâng cấp hệ thống live chat hiện tại để có trải nghiệm gần với LiveChat.com — giữ nguyên hạ tầng (Lovable Cloud, RLS, guest token, realtime/polling) và bổ sung 5 nhóm tính năng theo thứ tự ưu tiên.

## 1. Pre-chat form (khách mới)
- Khi guest mở widget lần đầu, hiển thị form: **Tên**, **Email** (tuỳ chọn), **Chủ đề** (dropdown: Nạp/Rút, Tài khoản, Giao dịch, Khác).
- Bấm "Bắt đầu chat" → gọi `guest-chat-init` (đã có) kèm các field này → lưu vào `live_chat_rooms.customer_name`, `customer_email`, và `topic` (cột mới).
- User đã đăng nhập: bỏ qua form, vẫn cho chọn chủ đề ở tin nhắn đầu.
- Tin nhắn welcome của bot tự cá nhân hoá theo `topic`.

## 2. Trạng thái agent + routing
- Bảng mới `agent_presence` (user_id, status: online/away/offline, last_seen_at).
- Admin panel: dropdown đổi trạng thái + auto chuyển `away` sau 5 phút không hoạt động, `offline` khi đóng tab (visibilitychange).
- Widget khách hiển thị badge "Đang online" (xanh) / "Sẽ phản hồi sớm" (vàng) / "Hiện đang ngoài giờ" (xám) dựa trên có ít nhất 1 admin online + giờ làm việc.
- Khi gửi tin đầu tiên, room tự gán `assigned_to` = admin online ít room nhất.

## 3. Message status (sent / delivered / seen) + typing nâng cao
- Thêm cột `delivered_at` vào `live_chat_messages` (ngoài `read_at` đã có).
- Khi tin nhắn xuất hiện ở phía nhận (realtime/polling), client tự update `delivered_at`.
- Khi cửa sổ chat đang mở + nhìn thấy tin → update `read_at` (đã có sẵn `markAsRead`, mở rộng để hoạt động cả 2 chiều).
- Hiển thị tick dưới bubble: ✓ sent, ✓✓ delivered (xám), ✓✓ seen (xanh) — kiểu Messenger.
- Typing indicator hiện preview text (đã có) nhưng thêm tên agent + avatar nhỏ giống LiveChat.

## 4. Canned responses + tags
- Tận dụng `quick_reply_templates` đã có → bổ sung UI dropdown "/" trong khung soạn admin: gõ `/` mở list, mũi tên chọn, Enter chèn.
- Bảng mới `room_tags` (room_id, tag, color) — admin gán tag (VIP, Khiếu nại, Đã giải quyết…) — hiện chip màu trên danh sách room + filter theo tag.

## 5. Offline → ticket qua email
- Khi không có admin online + khách gửi tin: bot trả lời "Hiện ngoài giờ, chúng tôi sẽ phản hồi qua email".
- Nếu khách (guest) đã điền email ở pre-chat: gọi edge function `notify-offline-ticket` đẩy nội dung sang admin (Telegram + lưu vào room với badge "ticket").
- Khi admin reply, gửi email `support-reply` cho khách (dùng hạ tầng email đã có).

---

## Technical details

**Database migrations**
- `live_chat_rooms`: thêm `topic text`, `tags text[]` default `{}`.
- `live_chat_messages`: thêm `delivered_at timestamptz`.
- New table `agent_presence` (user_id PK, status, last_seen_at, updated_at) + RLS: admin full, user xem own.
- New table `room_tags` (id, room_id, tag, color, created_by, created_at) + RLS admin-only.
- Trigger: khi insert message từ customer → nếu `room.assigned_to is null` chạy function `auto_assign_room()` chọn admin online ít room nhất.

**RLS adjustments**
- Cho phép `anon` update `delivered_at` trong room của mình (mở rộng policy đã có "Guest marks support messages as read").
- Cho phép `authenticated` update `delivered_at` cho tin nhắn trong room của mình.

**Frontend**
- `src/components/live-chat/PreChatForm.tsx` (mới) — render trước khi `ChatWidget` gọi `guest-chat-init`.
- `src/components/live-chat/MessageStatus.tsx` (mới) — render tick theo state.
- `src/hooks/useAgentPresence.tsx` (mới) — admin: heartbeat 30s + đổi status; khách: subscribe realtime để biết online.
- `src/components/admin/LiveChatAdminPanel.tsx` — thêm dropdown trạng thái, slash-command quick replies, room tag chips, filter theo tag.
- `src/hooks/useLiveChatMessages.tsx` — bổ sung `markDelivered()` chạy khi nhận tin mới.

**Edge functions**
- `guest-chat-init` (cập nhật): nhận thêm `topic`, `email`, lưu vào room.
- `notify-offline-ticket` (mới): nhận room_id, message → gửi Telegram + email cho admin.
- `support-reply-email` (mới hoặc tích hợp vào template hiện có): gửi reply cho khách offline.

**i18n**
- Tất cả label mới đi qua `useLanguage` (theo Core memory).

---

## Thứ tự triển khai (build mode)
1. Migration DB + RLS.
2. Pre-chat form + lưu topic/email.
3. Agent presence + badge online ở widget.
4. Message status tick + delivered logic.
5. Slash quick replies + tags.
6. Offline ticket flow (edge + email).

Phạm vi giới hạn ở live chat — không đụng giao diện khác. Sau khi bạn duyệt plan, mình sẽ chuyển sang build và làm tuần tự theo thứ tự trên (có thể tách thành nhiều lượt nếu bạn muốn review từng bước).