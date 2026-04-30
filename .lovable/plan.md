Mình đã kiểm tra luồng hiện tại và thấy backend vẫn có dữ liệu giá mới từ `/admin/products-monitor`:

- `products.updated_at` và `price_history.recorded_at` có cập nhật gần đây.
- `/admin/products-monitor` đang sync dữ liệu engine vào `products` và `price_history` mỗi khoảng 3 giây.
- Vấn đề nằm ở phía `/products`: `useProductsData` đang đọc và subscribe realtime trực tiếp, nhưng phần chart mini chỉ append theo `recorded_at`. Vì admin upsert cùng cây nến 1 phút nhiều lần, cùng `recorded_at` được UPDATE liên tục. Nếu realtime UPDATE bị chậm/rớt, UI list có thể không thể hiện cảm giác “live”; đồng thời không có fallback synthetic/polling như `useSharedProductRealtime` ở trang chi tiết.

Kế hoạch sửa:

1. Chuẩn hóa `/products` dùng cùng nguồn live với trang chi tiết
   - Tạo một hook/card live riêng cho từng sản phẩm trên list, dùng `useSharedProductRealtime` với `timeframe: '1m'`.
   - Mỗi card sẽ lấy `latestPrice`, `highPrice`, `lowPrice`, `product.price_change`, và `candles` trực tiếp từ shared realtime thay vì chỉ phụ thuộc snapshot ban đầu trong `useProductsData`.
   - Khi realtime không có tick mới >10s, hook hiện tại đã có synthetic live row để card vẫn chuyển động nhẹ theo anchor price.

2. Giữ `useProductsData` chỉ làm dữ liệu nền cho danh sách
   - `useProductsData` vẫn fetch danh sách sản phẩm, ảnh, tên, symbol, volume/turnover và candles ban đầu.
   - Product card sẽ merge dữ liệu nền + live data để tránh màn hình trống và vẫn có realtime khi có cập nhật.

3. Sửa chart mini ở `/products` nhận data live đúng kiểu
   - Chuyển `sharedRealtime.candles` thành format `{ open, high, low, close }` cho `MiniCandleChart`.
   - Ưu tiên candle live; nếu chưa tải xong thì fallback về `product.candles` ban đầu.

4. Tránh lỗi hook order
   - Không gọi hook trong vòng lặp thường hoặc điều kiện không ổn định trong cùng component list.
   - Tách thành component con như `LiveProductCard`, mỗi card tự gọi hook một cách cố định theo lifecycle riêng.
   - Không thêm early return trước hook.

5. Thêm trạng thái live nhỏ trên card nếu cần
   - Hiển thị nhẹ trạng thái `LIVE`/kết nối bằng dot xanh hoặc dùng animation giá hiện có (`AnimatedPrice`) để người dùng thấy giá đang chạy.
   - Không phá style hiện tại của Products page.

File dự kiến chỉnh:

- `src/components/product/ProductList.tsx`
- `src/components/product/ProductCard.tsx` hoặc thêm component con mới trong cùng khu vực product
- Có thể chỉnh nhẹ type trong `src/hooks/useProductsData.tsx` nếu cần, nhưng không đổi schema database.

Không cần migration database vì realtime publication và dữ liệu `price_history/products` đã tồn tại và đang có cập nhật.