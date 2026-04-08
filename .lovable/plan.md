

## Tạo tài khoản trực tiếp cho SĐT +84982410306

**Thông tin tài khoản:**
- Họ tên: Phạm Thi Kiều
- SĐT: +84982410306
- Email nội bộ: `84982410306@phone.local`
- Mật khẩu mặc định cần được chọn

**Các bước thực hiện:**

1. Gọi Edge Function `admin-update-password` hoặc tạo script gọi Supabase Admin API (`auth.admin.createUser`) để tạo user với:
   - Email: `84982410306@phone.local`
   - Password: (cần xác nhận)
   - `email_confirm: true`
   - `user_metadata: { full_name: "Phạm Thi Kiều", phone: "+84982410306" }`

2. Trigger `handle_new_user` sẽ tự động tạo profile với `full_name`, `email`, `phone` và gán role `user`.

3. Cập nhật phone trong profile (nếu trigger chưa set đúng).

**Cần xác nhận:** Bạn muốn đặt mật khẩu mặc định là gì cho tài khoản này?

