Nguyên nhân giá admin khác user là trang admin monitor vẫn còn dùng 2 nguồn dữ liệu song song:

1. Danh sách bên trái của admin lấy giá trực tiếp từ `useMarketEngine()` chạy trong trình duyệt admin/localStorage.
2. User lấy giá từ database `products` + `price_history` qua realtime.
3. Chart chính admin có dùng `useSharedProductRealtime`, nhưng vẫn fallback về local engine; danh sách sản phẩm admin thì chưa dùng realtime chung.
4. `useEngineSyncToDb` trong admin còn reseed/xóa/ghi lại `price_history` từ local engine khi admin mở monitor. Vì local engine của mỗi trình duyệt có thể khác nhau, admin có thể đang tự tạo ra một dòng giá khác với user.
5. Dữ liệu hiện tại trong database cũng cho thấy giá gần nhất đã cũ (`recorded_at` 2026-04-26 15:06:00), nên nếu admin đang thấy giá biến động mới từ local engine, user sẽ không giống vì user chỉ thấy dữ liệu đã sync lên database.

Kế hoạch sửa để admin và user luôn nhìn cùng một giá:

1. Biến database/realtime thành nguồn giá duy nhất cho hiển thị
   - Admin monitor sẽ hiển thị giá, % thay đổi, high/low và chart từ `useSharedProductRealtime` / `price_history` giống user.
   - Không dùng `getCurrentPrice(product.id)` của local market engine để render giá danh sách admin nữa.

2. Sửa danh sách sản phẩm trong admin monitor
   - Tạo map dữ liệu realtime theo DB product id/symbol.
   - Với mỗi sản phẩm admin, lấy `latestPrice`, candles, `price_change`, `high_24h`, `low_24h` từ dữ liệu DB tương ứng.
   - Nếu chưa có realtime thì fallback về giá `products.price`, không fallback về local engine trừ khi chỉ dùng cho công cụ Shock nội bộ.

3. Giới hạn local market engine chỉ cho công cụ điều khiển admin
   - `useMarketEngine()` vẫn giữ cho Shock Event, Snapshot, Reset nếu cần.
   - Nhưng UI giá hiển thị cho admin sẽ không lấy trực tiếp từ engine nữa.
   - Như vậy admin có thể điều khiển engine, còn màn hình hiển thị vẫn là dữ liệu đã publish cho user.

4. Vô hiệu hóa hoặc làm rõ luồng `useEngineSyncToDb` gây lệch
   - Không tự động xóa/reseed toàn bộ `price_history` khi admin mở monitor.
   - Chỉ sync tick mới hoặc thêm nút thao tác thủ công rõ ràng nếu admin muốn publish engine state.
   - Tránh việc một phiên admin mở trang là tự ghi đè giá user đang thấy.

5. Dọn `ProductDetail` để tránh nguồn dữ liệu cũ chen vào
   - Trang chi tiết user đã dùng `useSharedProductRealtime`, nhưng vẫn còn các hàm fetch/aggregate cũ và fallback polling.
   - Giữ fallback chỉ khi realtime mất kết nối, nhưng đảm bảo cùng logic aggregate với hook shared.

6. Kiểm tra dữ liệu realtime/publication
   - Xác nhận `price_history` và `products` có realtime events cho cả user/admin.
   - Nếu thiếu publication/policy cần migration bổ sung để realtime hoạt động ổn định.

Sau khi triển khai, kết quả mong muốn:

```text
Database price_history/products
        |
        v
useSharedProductRealtime
        |
        +--> User Products / Product Detail
        |
        +--> Admin Products Monitor / Admin list / Admin chart
```

Admin và user sẽ cùng subscribe một nguồn dữ liệu, cùng bucket candle, cùng format giá; không còn tình trạng admin thấy giá local engine khác user.