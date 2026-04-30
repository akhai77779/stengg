## Mục tiêu
Đổi MiniCandleChart trên trang `/products` sang hiển thị nến theo khung thời gian **30 phút (30m)** — giống mặc định khi vào trang chi tiết sản phẩm.

## Hiện trạng
- `ProductDetail` dùng default timeframe `"30m"` (lưu trong `localStorage.chart_timeframe`).
- `ProductList.tsx` (LiveProductCard) đang gọi `useSharedProductRealtime` với `timeframe: '1m'`, nên các nến mini là 1 phút.

## Thay đổi

### 1. `src/components/product/ProductList.tsx`
- Trong `LiveProductCard`, đổi:
  - `timeframe: '1m'` → `timeframe: '30m'`
- Tăng `throttleMs` từ `150` lên `300` (30m không cần update quá dày, giảm re-render).

### 2. Không cần đổi gì khác
- `useSharedProductRealtime` đã hỗ trợ `'30m'` sẵn (lookback 24h, bucket 1800s).
- `MiniCandleChart` chỉ render data đầu vào nên tự khớp.
- Logic merge candles trong `LiveProductCard` (`realtime.candles.length >= 2`) vẫn đúng.

## Kết quả mong đợi
- Mỗi card sản phẩm trên `/products` hiển thị chuỗi nến 30 phút trong ~24h gần nhất.
- Vẫn cập nhật real-time (cây nến 30m hiện tại nhấp nháy theo giá live từ market engine), khớp với những gì user thấy khi mở chi tiết sản phẩm với mặc định 30m.
