## Mục tiêu
Kiểm chứng bằng Playwright rằng policy UPDATE trên bucket `uploads` đã bị gỡ **không** phá vỡ luồng "thay ảnh", và mỗi lần upload sinh **file mới** thay vì ghi đè file cũ.

## Phạm vi kiểm thử
1. **Upload avatar** (trang `/profile`) — user thường
2. **Upload ảnh sản phẩm** (trang `/admin/products`) — admin, qua `ImageUpload` component

## Các bước Playwright (script `/tmp/browser/upload-overwrite/`)

### Setup
- Restore Supabase session từ `LOVABLE_BROWSER_SUPABASE_*` env vars
- Chuẩn bị 2 file ảnh test tạm (`img1.png`, `img2.png`) với nội dung khác nhau (đổi 1 pixel để khác hash)

### Test 1 — Avatar
1. Navigate `/profile`, screenshot trạng thái ban đầu
2. Upload `img1.png` qua input file → chờ toast "thành công" → screenshot
3. Đọc `src` avatar hiện tại (URL A) và bóc `path` từ signed URL
4. Upload `img2.png` (thao tác "thay đổi") → chờ toast → screenshot
5. Đọc `src` mới (URL B) và bóc `path`
6. **Assert**: `path A ≠ path B` (filename có `Date.now()` khác nhau) → chứng minh INSERT mới, không cần UPDATE
7. `fetch(URL_A)` phải vẫn 200 → file cũ còn nguyên, không bị overwrite
8. `fetch(URL_B)` phải 200 → file mới xem được

### Test 2 — Ảnh sản phẩm (admin)
1. Navigate `/admin/products`, mở dialog thêm/sửa 1 sản phẩm
2. Lặp bước 2–8 như trên với `ImageUpload` component
3. Kiểm tra thêm: `supabase.storage.from('uploads').list('products')` (qua console API) trả về **2 file** khác tên sau 2 lần upload cùng slot

### Test 3 — Thử ép overwrite (negative)
- Gọi trực tiếp `supabase.storage.from('uploads').update(pathA, img2)` từ console page
- **Assert**: nhận lỗi RLS / "new row violates row-level security" → xác nhận policy UPDATE đã bị chặn

## Kết quả kỳ vọng
- 2 lần upload sinh 2 path khác nhau → luồng UI hoạt động (INSERT mới).
- File cũ vẫn accessible qua signed URL đã cấp (không bị overwrite).
- API `.update()` bị RLS chặn → khớp cấu hình bảo mật.

## Báo cáo
- Screenshot: `1_profile_before.png`, `2_avatar_upload1.png`, `3_avatar_upload2.png`, `4_admin_products.png`, `5_product_upload1.png`, `6_product_upload2.png`.
- Bảng: `slot | path_1 | path_2 | fetch(pathA) status | update() error`.
- Nếu bất kỳ assert nào fail → liệt kê file/policy cần điều chỉnh (không tự sửa trong lần chạy này, sẽ đề xuất plan tiếp theo).

## Ghi chú
- Không sửa code trong kế hoạch này — chỉ chạy kiểm thử.
- Dùng account admin đã đăng nhập sẵn trong preview (session inject). Với Test 1 cần user thường: nếu session hiện tại là admin, vẫn hợp lệ vì avatar cá nhân độc lập với role.
