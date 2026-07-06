## Chẩn đoán

Đã điều tra Live database:

- **4 cron job đều active** (jobid 3, 4, 10, 11).
- **Nến dừng từ 11/06/2026 10:53 UTC** – không có row mới nào trong `price_history` 30 phút qua.
- **Trong 2 giờ qua có 1677 response HTTP status_code = 401** từ `pg_net` khi các cron gọi Edge Function.
- **Vault secret `email_queue_service_role_key` không tồn tại** (query `vault.secrets` trả về rỗng).

## Nguyên nhân (2 lỗi song song)

1. **Job 4 – `sync-live-price-loop`** gọi hàm `run_live_price_sync_loop()`. Hàm này đọc service role key từ vault; vì secret không tồn tại, hàm log warning `Service role key not found in vault` và **return sớm không gọi function nào**.
2. **Job 10 – `sync-price-history-every-minute`** và **Job 11 – `settle-expired-option-trades`** dùng `net.http_post` **không kèm header `Authorization`**. Cả hai edge function này bắt buộc Bearer token → luôn trả 401.

Kết quả: không có nguồn nào ghi nến vào `price_history` suốt 24 ngày → live/publish pipeline im lặng.

Ghi chú: `preview_ui--publish` fail có thể là vấn đề riêng của hạ tầng Lovable (đã publish thành công trước đó bằng cách đẩy commit rỗng). Plan này tập trung khôi phục cron/live-sync. Sau khi cron chạy lại, ta thử publish lại; nếu vẫn fail sẽ mở ticket Support riêng.

## Kế hoạch sửa

### Bước 1 – Nạp service role key vào Vault
Tạo secret `email_queue_service_role_key` trong `vault.secrets` bằng SUPABASE_SERVICE_ROLE_KEY thật. Việc này chạy bằng `supabase--insert` (không phải migration) vì chứa giá trị nhạy cảm, đúng chuẩn "schedule-jobs-supabase-edge-functions".

```sql
select vault.create_secret('<SERVICE_ROLE_KEY>', 'email_queue_service_role_key');
```

Sau đó xác minh:
```sql
select name from vault.secrets where name = 'email_queue_service_role_key';
```

### Bước 2 – Sửa cron Job 10 & Job 11 để đính kèm Authorization
Bọc 2 job trong cùng pattern dùng vault key: unschedule → reschedule bằng lệnh có header Bearer. Chạy trong Live SQL editor (không phải migration).

```sql
-- Job 10: sync-price-history-every-minute
select cron.unschedule('sync-price-history-every-minute');
select cron.schedule(
  'sync-price-history-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://nptiddcelyxfbyvslotv.supabase.co/functions/v1/sync-price-history',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='email_queue_service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Job 11: settle-expired-option-trades (áp dụng cùng cách)
```

### Bước 3 – Verify live sync đã chạy lại
- Đợi 60–90 giây.
- Chạy: `SELECT MAX(recorded_at), COUNT(*) FROM price_history WHERE recorded_at > now() - interval '5 minutes';`
- Kiểm tra logs `run-live-price-sync` và `sync-price-history` phải hết 401.
- Nếu vẫn 401 → kiểm tra lại giá trị SERVICE_ROLE_KEY trong vault (có thể đã rotate).

### Bước 4 – Không đụng chảo replay
Plan này **không** gap-fill/replay nến từ 11/06 → hiện tại. Sau khi cron chạy lại, các nến mới sẽ nối tiếp từ giá hiện tại của bảng `products`. Nếu bạn muốn replay khoảng trống 24 ngày, chúng ta xử lý ở plan riêng (theo cuộc trao đổi trước).

### Bước 5 – Thử publish lại
Sau khi cron xanh, thử `preview_ui--publish` lần nữa. Nếu vẫn "internal error", đó là sự cố hạ tầng Lovable độc lập – sẽ báo Support và dùng workaround commit-rỗng như lần trước.

## Cần bạn cung cấp

**SERVICE_ROLE_KEY** hiện tại của backend để nạp vào vault. Trên Lovable Cloud key này không truy cập được từ agent, nên cần bạn dán vào (mình sẽ dùng ngay, không log). Nếu bạn không có sẵn, phương án thay thế là lưu key qua công cụ `add_secret` (Edge Function secret) rồi mình viết edge function nhỏ để mirror sang vault – kém trực tiếp hơn nhưng khả thi.

## Chi tiết kỹ thuật

- Job 4 sẽ tự chạy lại đúng ngay khi vault có secret (không cần reschedule).
- Job 10/11 phải reschedule vì command đã được lưu tĩnh trong `cron.job.command` – không đọc lại vault động nếu ta không sửa command.
- Không thay đổi mã Edge Function; chỉ config cron + vault.
- Không có DB schema change → không cần migration.