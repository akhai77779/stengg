## Vấn đề

Cờ `is_trade_frozen` (và `is_frozen`) trong bảng `profiles` hiện chỉ được lưu khi admin bấm nút đóng băng, nhưng **không có nơi nào kiểm tra cờ này khi user thực hiện giao dịch**. Cụ thể:

- Hàm `process_trade` (mua/bán spot trong `TradeDialog`) chỉ validate rate limit, balance, sản phẩm — bỏ qua trạng thái đóng băng.
- Lệnh option (`OptionsTradeSheet.tsx`) insert trực tiếp vào `option_trades`; RLS chỉ kiểm tra `auth.uid() = user_id`, không chặn user đóng băng.

## Giải pháp

Chặn ở **server-side là chính** (chống bypass), thêm chặn ở client để UX tốt hơn.

### 1. Migration: chặn ở DB

**a) Cập nhật hàm `process_trade`** — thêm đoạn đầu hàm (sau khi SELECT profile FOR UPDATE), nếu `is_frozen = true` hoặc `is_trade_frozen = true` thì return:

```
{ success: false, error: 'Tài khoản của bạn đang bị đóng băng giao dịch' }
```

(Lấy luôn `is_frozen`, `is_trade_frozen`, `frozen_reason` trong cùng câu SELECT để không cần query thêm.)

**b) Tạo trigger `BEFORE INSERT` trên `option_trades`** — nếu profile của `NEW.user_id` có `is_frozen` hoặc `is_trade_frozen` = true thì `RAISE EXCEPTION 'Tài khoản đang bị đóng băng giao dịch'`. Hàm trigger dùng `SECURITY DEFINER` + `SET search_path = public` để đọc được `profiles`.

### 2. Client guard (UX)

- `TradeDialog.tsx`: trước khi gọi `process_trade`, đọc `is_frozen` / `is_trade_frozen` từ `profiles_safe` (đang fetch sẵn balance) và hiện toast "Tài khoản đang bị đóng băng" thay vì để server trả lỗi.
- `OptionsTradeSheet.tsx`: thêm guard tương tự trước khi insert `option_trades`.
- Cả hai chỗ: disable nút xác nhận khi cờ frozen bật.

### 3. Không thay đổi

- Logic admin freeze/unfreeze trong `DashboardUsers.tsx` đã đúng — giữ nguyên.
- Withdraw đã có guard riêng — không động vào.

## Kết quả mong đợi

Sau khi admin bật "Đóng băng giao dịch" cho 1 user:
- Mua/bán spot → toast lỗi đóng băng, không trừ tiền.
- Đặt lệnh option → toast lỗi đóng băng, không tạo trade.
- Dù user gọi trực tiếp API cũng bị DB chặn.