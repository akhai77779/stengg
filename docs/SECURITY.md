# 🔐 Tài liệu Bảo mật Dự án ST Engineering Trading Platform

> **Phiên bản:** 1.0  
> **Cập nhật:** 23/01/2026  
> **Loại dự án:** Demo/Training Application

---

## 📋 Tổng quan

Tài liệu này mô tả các biện pháp bảo mật đã được triển khai trong dự án trading platform demo. Dự án sử dụng Lovable Cloud (Supabase) làm backend với Row-Level Security (RLS) để bảo vệ dữ liệu.

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
│                  Supabase (Backend)                          │
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

### Bảng `app_settings` (Cấu hình hệ thống) ✅ ĐÃ SỬA
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| ~~Anyone authenticated can view settings~~ | ~~SELECT~~ | ~~`true`~~ |
| **Admins can view settings** | **SELECT** | **`has_role(auth.uid(), 'admin')`** |
| Admins can manage settings | ALL | `has_role(auth.uid(), 'admin')` |

### Bảng `product_price_controls` (Điều khiển giá) ✅ ĐÃ SỬA
| Policy | Command | Điều kiện |
|--------|---------|-----------|
| ~~Anyone authenticated can view~~ | ~~SELECT~~ | ~~`true`~~ |
| **Admins can view price controls** | **SELECT** | **`has_role(auth.uid(), 'admin')`** |
| Admins can manage price controls | ALL | `has_role(auth.uid(), 'admin')` |

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

### 7. `has_withdrawal_password(_user_id)` ✅ MỚI
- **Mục đích:** Kiểm tra user đã đặt mật khẩu rút tiền chưa (không expose hash)
- **Bảo mật:**
  - ✅ SET search_path = public
  - ✅ SECURITY DEFINER - truy cập từ view mà không expose hash
  - ✅ Chỉ trả về boolean, không bao giờ expose password hash

---

## 🛡️ Secure Views

### View `profiles_safe` ✅ MỚI
- **Mục đích:** Cung cấp truy cập an toàn đến dữ liệu profiles
- **Các trường bị loại bỏ:**
  - `withdrawal_password_hash` - Mật khẩu rút tiền (bcrypt hash)
  - `last_login_ip` - IP đăng nhập cuối cùng
- **Sử dụng:** 
  - ✅ Client-side queries phải sử dụng `profiles_safe` thay vì `profiles`
  - ✅ `security_invoker = on` - kế thừa RLS từ bảng gốc

---

## 🗄️ Storage Security

### Bucket `uploads` (Public)
- **Loại:** Public bucket
- **Nội dung:** Ảnh sản phẩm, tin tức, banners, charity
- **Lý do public:** Content hiển thị công khai trên website
- **Policies:**
  - SELECT: Public access
  - INSERT: Authenticated users only
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

---

## 📊 Audit Logging

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

---

## ⚠️ Các vấn đề đã biết (Demo App)

### 1. Admin Balance Updates (Ignored)
- **Vấn đề:** Client-side calculations trong DashboardTransactions.tsx
- **Lý do ignored:** Demo app, không có tiền thật
- **Production fix:** Sử dụng RPC functions với atomic operations

### 2. Transaction Type Constraint (Ignored)
- **Vấn đề:** CHECK constraint không match với code
- **Lý do ignored:** Demo app, transactions section chỉ để demo

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
| 25/01/2026 | **Sửa lỗi bảo mật nghiêm trọng:** Tạo view `profiles_safe` để ẩn `withdrawal_password_hash` và `last_login_ip` |
| 25/01/2026 | Thêm function `has_withdrawal_password()` để kiểm tra mật khẩu rút tiền an toàn |
| 25/01/2026 | Cập nhật tất cả client queries sang sử dụng `profiles_safe` |
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

*Tài liệu này được tạo tự động bởi Lovable Security Scanner*
