## Vấn đề

Cột `image_url` của bảng `news` đang lưu URL trỏ về project Lovable Cloud cũ `avqutkamqeblqirtckir.supabase.co`. Project hiện tại là `nptiddcelyxfbyvslotv`, nên các file ảnh không tồn tại → trả về 404 → trên trang chủ chỉ thấy alt text ("Defence", "Aerospace"…) cùng badge danh mục, không có ảnh.

Tất cả 4 bản ghi news đang gặp lỗi này (Defence, Aerospace, Ascending new horizons with AI, Smart City).

## Phương án xử lý

Bạn chọn 1 trong các hướng sau, mình sẽ làm:

### Phương án A — Upload lại ảnh thủ công (khuyến nghị nếu muốn giữ ảnh gốc)
- Bạn vào `/dashboard` → Quản lý Tin tức → Sửa từng tin → upload lại ảnh.
- Mình không cần làm gì code.

### Phương án B — Tự động dọn URL hỏng + dùng ảnh placeholder
- Migration SQL: `UPDATE news SET image_url = NULL WHERE image_url LIKE '%avqutkamqeblqirtckir%';`
- Component `LatestNews` đã có fallback `unsplash` khi `image_url` null → ảnh placeholder hiển thị ngay.
- Bạn upload ảnh thật dần qua trang Quản lý Tin tức.

### Phương án C — Thử rewrite domain
- Đổi domain `avqutkamqeblqirtckir.supabase.co` → `nptiddcelyxfbyvslotv.supabase.co` trong DB.
- **Rủi ro**: file vật lý gần như chắc chắn không có trong bucket mới → vẫn 404. Chỉ làm nếu bạn xác nhận đã copy file storage sang project mới.

## Khuyến nghị

Phương án **B** trước (1 phút, loại ảnh vỡ ngay), rồi upload ảnh thật dần. Nếu bạn có folder ảnh gốc, mình có thể giúp script upload hàng loạt.

Bạn muốn đi theo phương án nào?
