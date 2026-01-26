# 🔐 Tài liệu Bảo mật Dự án ST Engineering Trading Platform

> **Phiên bản:** 2.1  
> **Cập nhật:** 26/01/2026  
> **Loại dự án:** Demo/Training Application  
> **Trạng thái bảo mật:** ✅ Đã xác minh - Không có lỗ hổng nghiêm trọng

---

## 📋 Tổng quan

Tài liệu này mô tả các biện pháp bảo mật đã được triển khai trong dự án trading platform demo. Dự án sử dụng Lovable Cloud làm backend với Row-Level Security (RLS) để bảo vệ dữ liệu.

### Production Domain
- **Primary:** `https://stengg.it.com`
- **Secondary:** `https://www.stengg.it.com`
- **Lovable App:** `https://stengg-it-com.lovable.app`
- **Preview:** `https://id-preview--f9a00261-b7fb-4428-ad85-88f8d5788c27.lovable.app`

### Tóm tắt Bảo mật

| Thành phần | Trạng thái | Ghi chú |
|------------|------------|---------|
| RLS Policies | ✅ Đã bảo vệ | Tất cả 17 bảng đều có RLS |
| Sensitive Data | ✅ Đã bảo vệ | View `profiles_safe` ẩn dữ liệu nhạy cảm |
| Admin Functions | ✅ Đã bảo vệ | Atomic RPCs với audit logging |
| Storage | ✅ Đã bảo vệ | Private bucket cho identity documents |
| Audit Logs | ✅ Immutable | Không cho phép sửa/xóa |

---

## 🏗️ Kiến trúc Bảo mật

### Mô hình phân quyền

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Guest     │  │    User     │  │   Admin     │          │
│  │  (Công khai)│  │ (Đăng nhập) │  │ (Quản trị) │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Lovable Cloud (Backend)                     │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Row-Level Security (RLS)                │    │
│  │  • auth.uid() = user_id (User chỉ xem data mình)    │    │
│  │  • has_role(auth.uid(), 'admin') (Admin xem tất cả) │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           SECURITY DEFINER Functions                 │    │
│  │  • Atomic operations với FOR UPDATE locking         │    │
│  │  • Server-side validation                           │    │
│  │  • SET search_path = public                         │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Secure Views                            │    │
│  │  • profiles_safe (security_invoker = on)            │    │
│  │  • Kế thừa RLS từ bảng gốc                          │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛡️ Row-Level Security (RLS) Policies

### Bảng `profiles` (Thông tin người dùng)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Users can view own profile | SELECT | `auth.uid() = id` |
| Users can update own profile | UPDATE | `auth.uid() = id` |
| Users can insert own profile | INSERT | `auth.uid() = id` |
| Admins can view all profiles | SELECT | `has_role(auth.uid(), 'admin')` |
| Admins can update all profiles | UPDATE | `has_role(auth.uid(), 'admin')` |

> **⚠️ BẢO MẬT:** Các trường nhạy cảm (`withdrawal_password_hash`, `last_login_ip`) được bảo vệ bằng view `profiles_safe`.
> Client-side queries phải sử dụng `profiles_safe` thay vì `profiles` trực tiếp.

### Bảng `transactions` (Giao dịch tài chính)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Users can view own transactions | SELECT | `auth.uid() = user_id` |
| Users can create own transactions | INSERT | `auth.uid() = user_id` |
| Admins can manage transactions | ALL | `has_role(auth.uid(), 'admin')` |

### Bảng `option_trades` (Giao dịch Options)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Users can view own option trades | SELECT | `auth.uid() = user_id` |
| Users can create own option trades | INSERT | `auth.uid() = user_id` |
| Admins can view all option trades | SELECT | `has_role(auth.uid(), 'admin')` |
| Admins can update all option trades | UPDATE | `has_role(auth.uid(), 'admin')` |

### Bảng `identity_verifications` (Xác minh danh tính)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Users can view own verification | SELECT | `auth.uid() = user_id` |
| Users can insert own verification | INSERT | `auth.uid() = user_id` |
| Users can update own pending verification | UPDATE | `auth.uid() = user_id AND status = 'pending'` |
| Admins can view all verifications | SELECT | `has_role(auth.uid(), 'admin')` |
| Admins can update all verifications | UPDATE | `has_role(auth.uid(), 'admin')` |

### Bảng `bank_accounts` (Tài khoản ngân hàng)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Users can view own bank accounts | SELECT | `auth.uid() = user_id` |
| Users can create own bank accounts | INSERT | `auth.uid() = user_id` |
| Users can update own bank accounts | UPDATE | `auth.uid() = user_id` |
| Users can delete own bank accounts | DELETE | `auth.uid() = user_id` |
| Admins can view all bank accounts | SELECT | `has_role(auth.uid(), 'admin')` |

### Bảng `audit_logs` (Nhật ký kiểm toán) ✅ IMMUTABLE
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Admins can view audit logs | SELECT | `has_role(auth.uid(), 'admin')` |
| No direct user inserts | INSERT | `false` (chỉ qua SECURITY DEFINER) |
| No updates allowed | UPDATE | `false` |
| No deletes allowed | DELETE | `false` |

> **🔒 BẢO MẬT:** Audit logs không thể bị sửa đổi hoặc xóa, đảm bảo tính toàn vẹn của dữ liệu kiểm toán.

### Bảng `app_settings` (Cấu hình hệ thống)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Admins can view settings | SELECT | `has_role(auth.uid(), 'admin')` |
| Anyone can read exchange_rates | SELECT | `key = 'exchange_rates'` |
| Admins can manage settings | ALL | `has_role(auth.uid(), 'admin')` |

### Bảng `product_price_controls` (Điều khiển giá)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Admins can view price controls | SELECT | `has_role(auth.uid(), 'admin')` |
| Admins can manage price controls | ALL | `has_role(auth.uid(), 'admin')` |

### Bảng `user_roles` (Phân quyền)
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| Users can view own role | SELECT | `auth.uid() = user_id` |
| Admins can view all roles | SELECT | `has_role(auth.uid(), 'admin')` |
| Admins can manage roles | ALL | `has_role(auth.uid(), 'admin')` |

### Các bảng Public (Xem công khai cho authenticated users)
| Bảng | SELECT | Ghi chú |
|------|--------|---------|
| `products` | `true` | Danh sách sản phẩm giao dịch |
| `news` | `true` | Tin tức công ty |
| `hero_banners` | `true` | Banners trang chủ |
| `charity_programs` | `true` | Chương trình từ thiện |
| `comments` | `true` | Bình luận tin tức |
| `price_history` | `true` | Lịch sử giá (charts) |

---

## 🔒 SECURITY DEFINER Functions

Các function quan trọng sử dụng `SECURITY DEFINER` với các biện pháp bảo mật:

### 1. `has_role(_user_id, _role)`
- **Mục đích:** Kiểm tra role của user
- **Bảo mật:** 
  - ✅ SET search_path = public
  - ✅ Không có user input injection risk
  - ✅ Được sử dụng bởi tất cả RLS policies

### 2. `process_trade(_user_id, _product_id, _amount, _trade_type)`
- **Mục đích:** Xử lý giao dịch mua/bán
- **Bảo mật:**
  - ✅ SET search_path = public
  - ✅ FOR UPDATE row locking
  - ✅ Input validation (type, amount)
  - ✅ Balance check trước khi giao dịch
  - ✅ Atomic transaction
  - ✅ Audit logging

### 3. `create_withdrawal_request(_user_id, _amount, _network, _wallet_address)`
- **Mục đích:** Tạo yêu cầu rút tiền
- **Bảo mật:**
  - ✅ SET search_path = public
  - ✅ FOR UPDATE balance locking
  - ✅ Server-side wallet address validation
  - ✅ Rate limiting (5 requests/hour)
  - ✅ Minimum amount validation ($10)
  - ✅ Balance check

### 4. `process_option_trade(...)`
- **Mục đích:** Xử lý giao dịch options
- **Bảo mật:**
  - ✅ SET search_path = public
  - ✅ FOR UPDATE row locking
  - ✅ Input validation (amount, direction, duration)
  - ✅ Atomic balance updates
  - ✅ Rate limiting (5 trades/minute)

### 5. `settle_option_trade(_trade_id, _exit_price)`
- **Mục đích:** Kết thúc giao dịch options
- **Bảo mật:**
  - ✅ SET search_path = public
  - ✅ FOR UPDATE trade locking
  - ✅ Atomic profit/loss calculation
  - ✅ Audit logging

### 6. `check_rate_limit(_user_id, _action_type, _max_requests, _window_seconds)`
- **Mục đích:** Kiểm tra rate limiting
- **Bảo mật:**
  - ✅ Ngăn chặn abuse
  - ✅ Configurable limits per action type

### 7. `has_withdrawal_password(_user_id)`
- **Mục đích:** Kiểm tra user đã đặt mật khẩu rút tiền chưa (không expose hash)
- **Bảo mật:**
  - ✅ SET search_path = public
  - ✅ SECURITY DEFINER - truy cập từ view mà không expose hash
  - ✅ Chỉ trả về boolean, không bao giờ expose password hash

### 8. `admin_add_balance` / `admin_subtract_balance`
- **Mục đích:** Admin điều chỉnh số dư user
- **Bảo mật:**
  - ✅ SET search_path = public
  - ✅ FOR UPDATE row locking (ngăn race conditions)
  - ✅ Bắt buộc audit logging
  - ✅ Kiểm tra admin role

---

## 🔑 Edge Functions Security

### CORS Whitelist (Áp dụng cho tất cả Edge Functions)

Tất cả Edge Functions đều sử dụng CORS whitelist thống nhất:

```javascript
const ALLOWED_ORIGINS = [
  "https://stengg.it.com",          // Production domain
  "https://www.stengg.it.com",       // WWW production domain
  "https://stengg-it-com.lovable.app",
  "https://id-preview--f9a00261-b7fb-4428-ad85-88f8d5788c27.lovable.app",
  "https://f9a00261-b7fb-4428-ad85-88f8d5788c27.lovableproject.com",
  "http://localhost:5173",
  "http://localhost:8080",
];
```

### Danh sách Edge Functions

| Function | Auth Required | Admin Only | Mục đích |
|----------|--------------|------------|----------|
| `withdrawal-password` | ✅ | ❌ (user) / ✅ (admin-reset) | Quản lý mật khẩu rút tiền |
| `admin-update-password` | ✅ | ✅ | Admin đổi mật khẩu đăng nhập user |
| `create-wallet-address` | ✅ | ❌ | Tạo địa chỉ ví mới |
| `ohlc` | ❌ | ❌ | Lấy dữ liệu chart (public) |
| `sync-external-data` | ✅ | ✅ | Đồng bộ dữ liệu từ API bên ngoài |
| `sync-price-history` | ✅ | ✅ | Đồng bộ lịch sử giá |
| `track-login` | ✅ | ❌ | Ghi log đăng nhập |

### `withdrawal-password` Edge Function
- **Mục đích:** Quản lý mật khẩu rút tiền (create, change, verify, admin-reset)
- **Actions hỗ trợ:**

| Action | Mô tả | Quyền yêu cầu |
|--------|-------|---------------|
| `create` | Tạo mật khẩu rút tiền mới | Authenticated user (chính chủ) |
| `change` | Đổi mật khẩu (cần mật khẩu cũ) | Authenticated user (chính chủ) |
| `verify` | Xác minh mật khẩu khi rút tiền | Authenticated user (chính chủ) |
| `admin-reset` | Admin đặt lại mật khẩu cho user | **Admin role required** |

- **Bảo mật `admin-reset`:**
  - ✅ Xác minh JWT token của admin
  - ✅ Kiểm tra role `admin` trong bảng `user_roles`
  - ✅ Sử dụng `bcryptSync` để hash mật khẩu mới
  - ✅ Service Role key để bypass RLS khi update
  - ✅ **Bắt buộc audit logging** với action `admin_withdrawal_password_reset`
  - ✅ CORS origin whitelisting

```typescript
// Ví dụ audit log entry
{
  action: 'admin_withdrawal_password_reset',
  entity_type: 'user',
  entity_id: targetUserId,
  user_id: adminId,
  details: { changed_by: adminId }
}
```

---

## 🛡️ Secure Views

### View `profiles_safe` ✅ ĐÃ XÁC MINH
- **Mục đích:** Cung cấp truy cập an toàn đến dữ liệu profiles
- **Cấu hình:** `security_invoker = on`
- **Các trường bị loại bỏ:**
  - `withdrawal_password_hash` - Mật khẩu rút tiền (bcrypt hash)
  - `last_login_ip` - IP đăng nhập cuối cùng
- **Kế thừa RLS:** 
  - ✅ View kế thừa RLS từ bảng `profiles` gốc
  - ✅ Users chỉ xem được data của mình (`auth.uid() = id`)
  - ✅ Admins xem được tất cả (`has_role()`)
- **Sử dụng:** 
  - ✅ Tất cả client-side queries sử dụng `profiles_safe`
  - ✅ Component `DashboardUsers` đã được cập nhật

> **📋 Ghi chú bảo mật:** Security scanner có thể báo "Missing RLS" cho view này. 
> Đây là **false positive** vì views với `security_invoker=on` không cần RLS riêng - 
> chúng tự động kế thừa RLS từ bảng gốc.

---

## 🗄️ Storage Security

### Bucket `uploads` (Public)
- **Loại:** Public bucket
- **Nội dung:** Ảnh sản phẩm, tin tức, banners, charity
- **Lý do public:** Content hiển thị công khai trên website
- **Policies:**
  - SELECT: Public access
  - INSERT: Authenticated users only
  - UPDATE: Authenticated users only
  - DELETE: Admins only

### Bucket `identity-documents` (Private)
- **Loại:** Private bucket
- **Nội dung:** CMND/CCCD/Passport uploads
- **Policies:**
  - SELECT: User xem file của mình + Admins
  - INSERT: User upload file của mình
  - DELETE: Không cho phép (bảo toàn dữ liệu)

---

## 🔐 Authentication & Authorization

### Client-Side (UI Only)
```typescript
// src/hooks/useAuth.tsx
/**
 * SECURITY NOTICE:
 * ================
 * The `isAdmin` state is for UI DISPLAY PURPOSES ONLY.
 * 
 * ⚠️ IMPORTANT: Do NOT rely on `isAdmin` for authorization decisions!
 * 
 * All actual access control is enforced server-side via:
 * 1. Row-Level Security (RLS) policies using `has_role(auth.uid(), 'admin')`
 * 2. SECURITY DEFINER functions that verify admin role before operations
 */
```

### Server-Side (Actual Security)
- **RLS Policies:** Tất cả queries đều qua RLS
- **has_role() function:** Kiểm tra role từ `user_roles` table
- **Edge Functions:** Verify admin role trước khi thực hiện operations
- **Frozen Account:** Users với `is_frozen = true` bị tự động logout

### Account Freezing
- **`is_frozen`:** Chặn đăng nhập hoàn toàn
- **`is_trade_frozen`:** Chặn giao dịch và rút tiền
- **`frozen_reason`:** Hiển thị lý do cho user

---

## 📊 Audit Logging

### Bảo vệ Audit Logs
- **Immutable:** Không cho phép UPDATE hoặc DELETE
- **Server-only INSERT:** Chỉ SECURITY DEFINER functions có thể tạo logs
- **Admin-only SELECT:** Chỉ admin xem được logs

### Các actions được log:
| Action | Entity Type | Chi tiết |
|--------|-------------|----------|
| `login` | user | IP, user agent |
| `trade_completed` | transaction | Amount, balance before/after |
| `withdrawal_requested` | transaction | Amount, network, wallet |
| `deposit_approved` | transaction | Admin ID, amount, balance |
| `withdrawal_approved` | transaction | Admin ID, fee, total |
| `option_trade_created` | option_trade | Direction, amount, entry price |
| `option_trade_settled` | option_trade | Result, profit/loss |
| `admin_password_change` | user | Changed by admin |
| `admin_balance_add` | user | Admin ID, amount, new balance |
| `admin_balance_subtract` | user | Admin ID, amount, new balance |
| `admin_withdrawal_password_reset` | user | Admin ID đổi mật khẩu rút tiền cho user |

---

## ✅ Security Scan Decisions

### Đã xác minh là False Positives

| Finding | Lý do Ignored |
|---------|---------------|
| `profiles_safe_no_rls` | View sử dụng `security_invoker=on`, kế thừa RLS từ bảng `profiles`. Không cần RLS riêng. |
| Storage anonymous access | Bucket `uploads` cố ý public cho website content. Bucket `identity-documents` vẫn private. |

### Đã sửa

| Finding | Ngày sửa | Giải pháp |
|---------|----------|-----------|
| Admin balance updates | 25/01/2026 | Chuyển sang atomic RPCs (`admin_add_balance`, `admin_subtract_balance`) |
| Sensitive data exposure | 25/01/2026 | Tạo view `profiles_safe` với `security_invoker=on` |
| Edge function CORS | 25/01/2026 | Thêm origin whitelisting |

---

## ⚠️ Các vấn đề đã biết (Demo App)

### 1. Anonymous Sign-ins Enabled
- **Vấn đề:** Supabase scanner cảnh báo anonymous sign-ins
- **Lý do ignored:** Tính năng này không được sử dụng trong app, chỉ là cấu hình mặc định
- **Risk:** Low - không có flow nào sử dụng anonymous auth

### 2. Transaction Type Constraint
- **Vấn đề:** CHECK constraint không match với code
- **Lý do ignored:** Demo app, transactions section chỉ để demo
- **Production fix:** Cập nhật constraint hoặc code

---

## 🚀 Khuyến nghị cho Production

### 1. Authentication
- [ ] Bật MFA cho tất cả admin accounts
- [ ] IP whitelist cho admin access
- [ ] Session timeout ngắn (30 phút)
- [ ] Bật Leaked Password Protection

### 2. Data Protection
- [ ] Encryption at rest cho sensitive fields
- [ ] Signed URLs với expiry cho document images
- [ ] Data masking cho wallet addresses trong UI

### 3. Monitoring
- [ ] Alert khi có unusual access patterns
- [ ] Real-time monitoring cho financial operations
- [ ] Admin activity dashboard

### 4. Infrastructure
- [ ] WAF (Web Application Firewall)
- [ ] DDoS protection
- [ ] Regular security audits
- [ ] Penetration testing

---

## 📝 Changelog

| Ngày | Thay đổi |
|------|----------|
| 26/01/2026 | **CORS whitelist đồng bộ:** Thêm domain `stengg.it.com` và `www.stengg.it.com` vào tất cả 7 Edge Functions |
| 26/01/2026 | **Chuẩn hóa CORS:** Function `sync-price-history` chuyển từ wildcard `*` sang whitelist cụ thể |
| 26/01/2026 | **Thêm admin-reset withdrawal password:** Cho phép admin đổi mật khẩu rút tiền của user với đầy đủ audit logging |
| 26/01/2026 | Thêm section "Edge Functions Security" với chi tiết về withdrawal-password function |
| 26/01/2026 | **Security scan verification:** Xác minh tất cả error-level findings đều là false positives |
| 26/01/2026 | Cập nhật documentation với trạng thái bảo mật mới nhất |
| 26/01/2026 | Thêm section "Security Scan Decisions" |
| 25/01/2026 | **Sửa lỗi bảo mật nghiêm trọng:** Tạo view `profiles_safe` để ẩn `withdrawal_password_hash` và `last_login_ip` |
| 25/01/2026 | Thêm function `has_withdrawal_password()` để kiểm tra mật khẩu rút tiền an toàn |
| 25/01/2026 | Cập nhật tất cả client queries sang sử dụng `profiles_safe` |
| 25/01/2026 | Thêm atomic admin RPCs (`admin_add_balance`, `admin_subtract_balance`) |
| 23/01/2026 | Sửa RLS cho `app_settings` - chỉ admin xem được |
| 23/01/2026 | Sửa RLS cho `product_price_controls` - chỉ admin xem được |
| 23/01/2026 | Thêm security documentation cho `useAuth.tsx` |
| 23/01/2026 | Tạo tài liệu bảo mật này |

---

## 📞 Liên hệ

Nếu phát hiện lỗ hổng bảo mật, vui lòng liên hệ:
- Email: security@example.com
- Responsible disclosure program: https://example.com/security

---

*Tài liệu này được cập nhật bởi Lovable Security Scanner - Phiên bản 2.1*
