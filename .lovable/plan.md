## Mục tiêu
Tải toàn bộ dữ liệu database Live về máy nhanh nhất, sau đó có thể up lên nơi khác.

## 2 cách khả thi

### Cách 1 — Cloud Export data (khuyến nghị, nhanh & đầy đủ nhất)
Lovable Cloud có sẵn nút export full database (schema + data).

Các bước bạn tự làm (không tốn credit, không cần AI chạy):
1. Mở **Cloud** (nút "View Backend" hoặc từ panel More → Cloud)
2. Vào **Advanced settings** → **Export data**
3. Chọn môi trường **Live (Production)**
4. Bấm **Export** → Cloud sẽ chuẩn bị file dump (schema + data đầy đủ) và cho link tải về

→ Ra 1 file duy nhất, restore lại được nguyên vẹn (kể cả RLS, function, trigger).
→ Không phải tải từng bảng.

### Cách 2 — AI export CSV theo từng bảng (nếu Cách 1 không dùng được)
Nếu bạn không muốn dùng Export data của Cloud, mình có thể:
- Query Live database (read-only, an toàn)
- Xuất từng bảng ra file CSV vào `/mnt/documents/live-export/`
- Đóng gói kèm link tải cho từng file

Danh sách bảng có data (theo screenshot bạn gửi):
```text
audit_logs (55,117)    price_history (20,930)   live_chat_messages (2,360)
telegram_outbox (300)  live_chat_typing (265)   option_trades (264)
user_notifications (190)  live_chat_rooms (180)  email_send_log (74)
transactions (67)      profiles (35)            user_roles (36)
bank_accounts (26)     identity_verifications (25)  email_unsubscribe_tokens (18)
quick_reply_templates (16)  products (10)       product_price_controls (10)
news (10)   app_settings (9)   hero_banners (5)   charity_programs (4)
deposit_settings (3)   rate_limits (2)   admin_user_notes (1)
agent_presence (1)   email_send_state (1)   live_chat_notes (1)
```

**Hạn chế của Cách 2:** CSV không giữ được schema/RLS/function/trigger — chỉ có data thô. Muốn restore đầy đủ vẫn phải dùng Cách 1.

## Đề xuất
Dùng **Cách 1** — nhanh nhất, đầy đủ nhất, 1 file duy nhất, không tốn credit AI.

Nếu bạn xác nhận muốn Cách 2 (CSV theo bảng), mình sẽ chuyển sang build mode và xuất ngay toàn bộ vào `/mnt/documents/live-export/` để bạn tải về.
