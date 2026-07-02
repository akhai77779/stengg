# Sửa lỗi Publish thất bại (không liên quan thanh toán)

## Chẩn đoán
- Publish fail KHÔNG phải do chưa thanh toán — gói nào cũng publish được lên URL lovable.app.
- Nguyên nhân: Live đang kẹt migration ở version `20260620080105`, còn Test đã ở `20260702002754`. Khi publish, hệ thống cố apply 9 migration còn thiếu lên Live và bị crash ở một trong số đó → báo "internal error".
- Còn 4 migration CHƯA được gia cố chống lỗi:
  - `20260623094829` — cập nhật ảnh tin tức (ít rủi ro)
  - `20260701164743` — UPDATE ảnh sản phẩm + thao tác cron
  - `20260701212559` — xóa/tạo lại cron jobs
  - `20260702002754` — tạo lại cron jobs với Authorization header
- 3 migration cuối đều gọi `cron.schedule` / `cron.unschedule`, có nguy cơ bị từ chối quyền trên Live → nghi phạm chính gây crash.

## Việc sẽ làm

1. **Gia cố 4 migration còn lại**: bọc toàn bộ lệnh cron và UPDATE trong khối `DO ... EXCEPTION` — nếu Live không cho phép, migration bỏ qua và ghi notice thay vì crash, để publish đi tiếp.
2. **Rà lại 5 migration đã gia cố trước đó** để chắc chắn không còn lệnh nào có thể crash trên Live.
3. **Publish lại** và theo dõi kết quả.
4. **Xác minh sau publish**:
   - Version migration trên Live phải nhảy lên `20260702002754`.
   - Cron nến trên Live trỏ đúng backend hiện tại (hết lỗi 401).
   - Site Live phục vụ bundle mới.
5. **Phương án dự phòng**: nếu Live vẫn không apply được cron qua migration, tôi sẽ đưa bạn đoạn SQL để chạy thủ công trong Cloud View → Run SQL (chọn Live) — cách này chắc chắn kích hoạt lại cron nến.

## Chi tiết kỹ thuật
- Mẫu gia cố: `DO $$ BEGIN <lệnh>; EXCEPTION WHEN insufficient_privilege OR undefined_function THEN RAISE NOTICE '...'; END $$;`
- Các migration đã chạy trên Test nên việc sửa file chỉ ảnh hưởng lúc apply lên Live — an toàn, không đổi schema Test.
- Không có security finding nào đang chặn publish (đã kiểm tra scan mới nhất 02/07).
