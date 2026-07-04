## Có làm được không?

**Có**, nhưng cần hiểu rõ giới hạn của Lovable:

Lovable **một project = một bundle duy nhất** được deploy cho cả các domain đã kết nối. Vì vậy có 2 hướng khả thi:

---

### Hướng 1 (khuyến nghị): Cùng 1 project, subdomain admin chỉ hiển thị khu vực admin

- Kết nối thêm `admin.stengg.it.com` vào chính project này (theo đúng dialog bạn đang mở: chọn **Subdomain** → nhập `admin` → Connect domain).
- Trong code, phát hiện hostname:
  - Nếu `hostname === "admin.stengg.it.com"` → chỉ render router admin (`/` redirect thẳng vào `/login` hoặc `/admin`, ẩn toàn bộ route public như Home/Products/News...).
  - Nếu là `stengg.it.com` → hoạt động như hiện tại, nhưng chặn truy cập `/admin/*` (redirect về `/` hoặc 404) để admin chỉ vào được qua subdomain.
- Ưu điểm: 1 codebase, 1 lần publish, dùng chung DB/Cloud/session Supabase (cookie set cho `.stengg.it.com` có thể chia sẻ nếu cấu hình đúng, nếu không user sẽ đăng nhập riêng ở subdomain — chấp nhận được vì đây là admin).
- Nhược điểm: bundle JS vẫn chứa code public (không giảm size), nhưng người ngoài không có route để vào.

### Hướng 2: Tách hẳn thành project Lovable thứ 2

- Remix project hiện tại → xoá code public → chỉ giữ admin → kết nối `admin.stengg.it.com` cho project mới.
- Ưu điểm: bundle admin gọn, tách biệt hoàn toàn, publish độc lập.
- Nhược điểm: mỗi lần sửa logic dùng chung (types Supabase, hooks, market-engine…) phải đồng bộ 2 project thủ công. **Chi phí bảo trì cao.**

---

## Kế hoạch triển khai (Hướng 1)

1. **DNS / Domain**
   - Trong dialog "Configure connection" bạn đang mở: chọn **Subdomain**, nhập `admin`, bấm **Connect domain**.
   - Nếu DNS `stengg.it.com` đang trỏ về Lovable rồi thì subdomain sẽ tự verify; nếu bạn quản lý DNS ngoài, thêm A record `admin` → `185.158.133.1` (hoặc CNAME nếu dùng Cloudflare proxy mode).

2. **Detect hostname trong app**
   - Tạo `src/lib/hostMode.ts` export `isAdminHost()` = `window.location.hostname === "admin.stengg.it.com"`.

3. **Router (`src/App.tsx`)**
   - Nếu `isAdminHost()`:
     - `/` → `<Navigate to="/admin" />` (hoặc `/login` khi chưa đăng nhập)
     - Chỉ mount các routes: `/login`, `/admin/*`, `/switch-account`, `/security`, `/settings` (những gì admin cần).
     - Bỏ route: Home, Products, News, Charity, Deposit, Withdraw, About, Support…
     - 404 cho các path public.
   - Nếu KHÔNG phải admin host:
     - Giữ nguyên như hiện tại.
     - `AdminRouteGuard` thêm check: nếu `!isAdminHost()` → redirect về `https://admin.stengg.it.com` (hoặc trả 404) để không cho vào `/admin` từ domain chính.

4. **SEO / meta**
   - `PageSeo` khi ở admin host: set `<meta name="robots" content="noindex,nofollow">`, sitemap/robots không cần đổi (đã chỉ khai báo cho `stengg.it.com`).
   - `index.html` giữ nguyên; runtime override title cho admin.

5. **Supabase Auth cookie**
   - Kiểm tra `src/integrations/supabase/client.ts`: nếu dùng localStorage (mặc định) thì session không share giữa 2 hostname — admin sẽ phải đăng nhập lại ở `admin.stengg.it.com`. Đây là hành vi mong muốn (tách biệt session), **không cần đổi**.

6. **Publish**
   - Sau khi merge code, bấm Publish một lần → cả `stengg.it.com` và `admin.stengg.it.com` cùng nhận bundle mới.

---

## Câu hỏi cần bạn xác nhận trước khi build

- Chọn **Hướng 1** (khuyến nghị) hay **Hướng 2**?
- Ở domain chính `stengg.it.com`, khi ai đó vào `/admin` bạn muốn:
  a) Redirect sang `admin.stengg.it.com` tương ứng, hay
  b) Trả 404 (giấu hoàn toàn sự tồn tại của khu vực admin)?

Trả lời 2 câu trên là tôi sẽ code luôn.
