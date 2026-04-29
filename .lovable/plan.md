Nguyên nhân chính: thông báo admin hiện chỉ sống trong bộ nhớ của hook `useAdminNotifications` và phụ thuộc vào realtime INSERT từ bảng `option_trades`. Có 2 điểm dễ làm admin “không thấy thông báo”:

1. Chuông thông báo gọi `useAdminNotifications()` thêm một lần riêng, trong khi `AdminLayout` cũng gọi hook này. Hai instance không chia sẻ cùng history, nên badge/sidebar và popup chuông có thể lệch nhau.
2. Hệ thống đã xóa trigger thông báo giao dịch quyền chọn cũ trên bảng `option_trades` và đang chặn các notification kiểu `option_trade` trong `user_notifications`. Việc này đúng với yêu cầu trước đó là không tạo thông báo giao dịch cho user, nhưng cũng có nghĩa admin chỉ còn dựa vào realtime client-side; nếu admin vừa mở sau đó, reload trang, hoặc realtime không bắt được event thì lịch sử thông báo sẽ trống.

Kế hoạch sửa:

1. Tạo nguồn thông báo admin dùng chung
   - Tách trạng thái/thực thi `useAdminNotifications` ra một `AdminNotificationsProvider` hoặc shared store.
   - `AdminLayout`, `NotificationBell`, và các nơi khác sẽ dùng cùng một instance thay vì mỗi component tự subscribe riêng.
   - Kết quả: badge “Option Trades” và tab “Hệ thống” trong chuông hiển thị cùng dữ liệu.

2. Bổ sung fallback fetch cho giao dịch mới trong ngày
   - Khi admin mở app hoặc mở admin layout, ngoài realtime count sẽ query các lệnh `option_trades` mới trong ngày.
   - Tạo notification history từ các lệnh đó nếu chưa có trong bộ nhớ.
   - Kết quả: admin vẫn thấy lệnh user đã đặt gần đây dù bỏ lỡ realtime hoặc vừa refresh trang.

3. Giữ realtime thông báo ngay lập tức
   - Giữ subscription INSERT/UPDATE trên `option_trades` để admin nhận toast, âm thanh và desktop notification khi user vừa đặt lệnh.
   - Thêm chống trùng notification bằng trade id, tránh một lệnh hiện nhiều lần khi vừa fetch fallback vừa nhận realtime.

4. Hiển thị thông tin rõ hơn cho admin
   - Notification option trade sẽ có: hướng Mua/Bán, số tiền, trạng thái active, thời gian tạo.
   - Nếu có thể lấy kèm product/user từ query fallback thì thêm tên sản phẩm và user để admin dễ nhận biết.

5. Kiểm tra cấu hình realtime nếu cần
   - Trong DB hiện query publication không trả về bảng realtime, dù migrations có từng add `option_trades`. Khi được duyệt triển khai, tôi sẽ xác minh lại bằng lệnh migration/read-only phù hợp.
   - Nếu bảng `option_trades` chưa nằm trong publication realtime thực tế, sẽ thêm migration an toàn để bật realtime lại cho bảng này.

Không thay đổi:
- Không bật lại thông báo giao dịch cho user trong `user_notifications`.
- Không xóa trigger chặn notification trade của user, vì trước đó hệ thống đã cố ý chặn loại thông báo này.
- Không thay đổi logic đặt lệnh hoặc khóa nhiều lệnh cùng lúc.