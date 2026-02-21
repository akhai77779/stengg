# ST Engineering Trading Platform - Project Export

> Auto-generated project summary for sharing with external tools.  
> Generated: 2026-02-21

---

## 📋 Project Overview

**Name:** ST Engineering Internal Trading Platform  
**Stack:** React 18 + Vite + TypeScript + TailwindCSS + Supabase (Lovable Cloud)  
**Published URL:** https://stengg-it-com.lovable.app

### Features
- 🕯️ Realtime candlestick charts (embedded iframe from external chart service)
- 📊 Options trading (UP/DOWN with countdown timer)
- 💬 Live chat between user and admin (realtime via Supabase)
- 🔐 Admin dashboard (users, transactions, products, banners, news, charity, audit logs)
- 🌐 Multi-language (VI/EN/ZH/TH/JA/KO/ID/MS) + Multi-currency (USD/VND)
- 🔒 Security: RLS policies, withdrawal password, account freeze, rate limiting, audit logs
- 📱 Mobile-first responsive design with bottom navigation
- 🏦 BankQuay integration for auto deposit

---

## 🗂️ File Structure

```
src/
├── App.tsx                     # Root component with routing
├── main.tsx                    # Entry point
├── index.css                   # Design system (CSS variables, utilities)
├── assets/                     # Logo images
├── components/
│   ├── admin/                  # Admin panel components
│   ├── auth/                   # Quick login setup/unlock
│   ├── charts/                 # Candlestick, indicators, countdown
│   ├── dashboard/              # Stats, users, transactions, news, etc.
│   ├── guest/                  # Guest layout, header, footer
│   ├── home/                   # Hero slider, featured products, latest news
│   ├── layout/                 # Header, Footer, BottomNavigation, Layout
│   ├── live-chat/              # Chat widget, message components
│   ├── notifications/          # Bell, mobile sheet
│   ├── product/                # Trade dialog, options sheet, price animations
│   ├── profile/                # Transaction history
│   ├── settings/               # Language/currency selectors
│   └── ui/                     # shadcn/ui components
├── contexts/
│   ├── CurrencyContext.tsx      # USD/VND conversion
│   ├── LanguageContext.tsx      # i18n (8 languages)
│   └── LiveChatContext.tsx      # Chat open/close state
├── hooks/
│   ├── useAuth.tsx             # Auth provider + admin role check
│   ├── useProfile.tsx          # Profile with cache + realtime
│   ├── useProductRealtime.tsx  # Realtime price updates
│   ├── useLiveChat*.tsx        # Live chat hooks
│   └── ...                     # Other hooks
├── pages/
│   ├── Index.tsx               # Home (guest vs authenticated)
│   ├── GuestHome.tsx           # Landing page for visitors
│   ├── Login.tsx               # Login with quick login support
│   ├── Register.tsx            # Registration
│   ├── Products.tsx            # Product listing
│   ├── ProductDetail.tsx       # Product detail with chart + trading
│   ├── Profile.tsx             # User profile + wallet
│   ├── Dashboard.tsx           # Legacy admin dashboard
│   ├── admin/
│   │   ├── AdminLayout.tsx     # Admin sidebar + outlet
│   │   ├── AdminOverview.tsx   # Stats overview
│   │   ├── AdminProducts.tsx   # Product management
│   │   ├── AdminNews.tsx       # News management
│   │   ├── AdminUsers.tsx      # User management
│   │   ├── AdminTransactions.tsx # Transaction approval
│   │   ├── AdminLiveChat.tsx   # Live chat admin
│   │   └── ...                 # Other admin pages
│   └── ...                     # Other pages
├── integrations/supabase/
│   ├── client.ts               # Supabase client
│   └── types.ts                # Auto-generated DB types
└── lib/                        # Utilities
supabase/
├── config.toml
└── functions/                  # Edge functions (ohlc, trade settlement, etc.)
```

---

## 🔑 Key Files

### 1. `src/App.tsx` - Root Component & Routing

```tsx
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LiveChatProvider } from "@/contexts/LiveChatContext";
import { MobileSupportButton } from "@/components/layout/MobileSupportButton";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import News from "./pages/News";
import NewsDetail from "./pages/NewsDetail";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import Charity from "./pages/Charity";
import Profile from "./pages/Profile";
import WalletDetails from "./pages/WalletDetails";
import SecuritySettings from "./pages/SecuritySettings";
import IdentityVerification from "./pages/IdentityVerification";
import Dashboard from "./pages/Dashboard";
import Deposit from "./pages/Deposit";
import Withdraw from "./pages/Withdraw";
import BankAccounts from "./pages/BankAccounts";
import Settings from "./pages/Settings";
import SwitchAccount from "./pages/SwitchAccount";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminNews from "./pages/admin/AdminNews";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCharity from "./pages/admin/AdminCharity";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminOptionTrades from "./pages/admin/AdminOptionTrades";
import AdminIdentityVerifications from "./pages/admin/AdminIdentityVerifications";
import AdminLiveChat from "./pages/admin/AdminLiveChat";
import AdminProductsMonitor from "./pages/admin/AdminProductsMonitor";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <CurrencyProvider>
        <LiveChatProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <AuthProvider>
                <MobileSupportButton />
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/news" element={<News />} />
                  <Route path="/news/:id" element={<NewsDetail />} />
                  <Route path="/products" element={<Products />} />
                  <Route path="/products/:id" element={<ProductDetail />} />
                  <Route path="/charity" element={<Charity />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/wallet-details" element={<WalletDetails />} />
                  <Route path="/security" element={<SecuritySettings />} />
                  <Route path="/identity-verification" element={<IdentityVerification />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<AdminOverview />} />
                    <Route path="banners" element={<AdminBanners />} />
                    <Route path="news" element={<AdminNews />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="products-monitor" element={<AdminProductsMonitor />} />
                    <Route path="option-trades" element={<AdminOptionTrades />} />
                    <Route path="charity" element={<AdminCharity />} />
                    <Route path="transactions" element={<AdminTransactions />} />
                    <Route path="identity-verifications" element={<AdminIdentityVerifications />} />
                    <Route path="audit-logs" element={<AdminAuditLogs />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="live-chat" element={<AdminLiveChat />} />
                  </Route>
                  <Route path="/deposit" element={<Deposit />} />
                  <Route path="/withdraw" element={<Withdraw />} />
                  <Route path="/bank-accounts" element={<BankAccounts />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/switch-account" element={<SwitchAccount />} />
                  <Route path="/about" element={<About />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </LiveChatProvider>
      </CurrencyProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
```

### 2. `src/integrations/supabase/client.ts` - Supabase Client

```tsx
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
```

### 3. `src/pages/Index.tsx` - Home Page (Guest vs Auth)

```tsx
import { Layout } from '@/components/layout/Layout';
import { HeroSlider } from '@/components/home/HeroSlider';
import { LatestNews } from '@/components/home/LatestNews';
import { FeaturedProducts } from '@/components/home/FeaturedProducts';
import { useAuth } from '@/hooks/useAuth';
import { useAutoSync } from '@/hooks/useAutoSync';
import { Loader2 } from 'lucide-react';
import GuestHome from './GuestHome';

const Index = () => {
  const { user, isLoading } = useAuth();
  useAutoSync({ enabled: false, interval: 3000 });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user) return <GuestHome />;

  return (
    <Layout>
      <HeroSlider />
      <LatestNews />
      <FeaturedProducts />
    </Layout>
  );
};

export default Index;
```

### 4. `src/pages/GuestHome.tsx` - Landing Page

```tsx
import { Link } from 'react-router-dom';
import { GuestLayout } from '@/components/guest/GuestLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GuestHome() {
  const { t } = useLanguage();

  const businessCards = [
    { titleKey: 'guest.aviation', descKey: 'guest.aviationDesc', image: '...' },
    { titleKey: 'guest.cities', descKey: 'guest.citiesDesc', image: '...' },
    { titleKey: 'guest.security', descKey: 'guest.securityDesc', image: '...' },
  ];

  return (
    <GuestLayout>
      {/* Hero Section - Full screen with background image */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-[#0a0e1a]">
        {/* ... hero content with login CTA ... */}
      </section>

      {/* Technology Section */}
      <section className="py-20 bg-white">...</section>

      {/* AI Section */}
      <section className="py-20 bg-gray-50">...</section>

      {/* Business Cards */}
      <section className="py-20 bg-white">...</section>

      {/* CTA Section */}
      <section className="py-24 bg-[#0a0e1a] text-white">...</section>

      {/* Innovation Cards */}
      <section className="py-20 bg-gray-50">...</section>

      {/* Careers Section */}
      <section className="py-20 bg-white">...</section>

      {/* News Section */}
      <section className="py-20 bg-gray-50">...</section>
    </GuestLayout>
  );
}
```

### 5. `src/components/home/FeaturedProducts.tsx` - Featured Products

```tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function FeaturedProducts() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, description, image_url, price, status, category')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(4);
    setProducts(data || []);
    setIsLoading(false);
  };

  return (
    <section className="py-16 bg-card/50">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Product cards with hover effects */}
        </div>
      </div>
    </section>
  );
}
```

### 6. `src/pages/Dashboard.tsx` - Admin Dashboard (Legacy)

```tsx
import { DashboardStats } from '@/components/dashboard/DashboardStats';
import { DashboardNews } from '@/components/dashboard/DashboardNews';
import { DashboardProducts } from '@/components/dashboard/DashboardProducts';
// ... other dashboard components
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Dashboard() {
  // Stats fetching, auth check, admin check
  // Tabs: stats, banners, news, products, charity, transactions, audit, users
  return (
    <Layout>
      <Marquee message="..." />
      {/* Stat cards grid */}
      <Tabs defaultValue="stats">
        <TabsContent value="stats"><DashboardStats /></TabsContent>
        <TabsContent value="news"><DashboardNews /></TabsContent>
        {/* ... more tabs */}
      </Tabs>
    </Layout>
  );
}
```

### 7. `src/pages/admin/AdminLayout.tsx` - Admin Layout

```tsx
// Sidebar navigation with badge counts for pending items
// Routes: overview, live-chat, banners, news, products, products-monitor,
//   option-trades, charity, transactions, identity-verifications, audit-logs, users, settings
// Mobile: Sheet-based sidebar
// Desktop: Fixed sidebar 260px + content area
```

### 8. `src/pages/admin/AdminLiveChat.tsx`

```tsx
import { LiveChatAdminPanel } from "@/components/admin/LiveChatAdminPanel";

export default function AdminLiveChat() {
  return (
    <div className="h-[calc(100vh-14rem)] min-h-[500px]">
      <LiveChatAdminPanel isEmbedded />
    </div>
  );
}
```

### 9. `src/pages/admin/AdminProducts.tsx`

```tsx
import { DashboardProducts } from "@/components/dashboard/DashboardProducts";

export default function AdminProducts() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Sản phẩm</h1>
        <p className="text-sm text-muted-foreground">Quản lý danh sách sản phẩm giao dịch.</p>
      </div>
      <DashboardProducts />
    </div>
  );
}
```

---

## 🎨 Design System (`src/index.css`)

```css
:root {
  --background: 222 47% 5%;        /* Dark navy */
  --foreground: 210 40% 98%;       /* Near white */
  --primary: 187 100% 42%;         /* Cyan/teal */
  --secondary: 160 100% 50%;       /* Green */
  --card: 222 47% 8%;              /* Slightly lighter navy */
  --muted: 217 33% 17%;            /* Gray-blue */
  --destructive: 0 84% 60%;        /* Red */
  --border: 217 33% 17%;
  --radius: 0.75rem;
  --gradient-primary: linear-gradient(135deg, hsl(187 100% 42%) 0%, hsl(160 100% 50%) 100%);
}

/* Utilities: .text-gradient, .bg-gradient-primary, .glow, .glass, .neon-border */
/* Mobile: touch targets 44-48px, safe area insets, scrollbar hide */
/* Animations: candle-flash, pulse-dot, shimmer */
```

---

## 🗄️ Database Schema (Supabase)

### Tables
| Table | Description |
|-------|------------|
| `profiles` | User profiles (balance, name, avatar, phone, frozen status) |
| `profiles_safe` | View excluding sensitive fields (withdrawal_password_hash, last_login_ip) |
| `user_roles` | Role assignments (admin/user) |
| `products` | Trading products (name, symbol, price, volume, status) |
| `product_price_controls` | Admin price direction controls |
| `price_history` | OHLC price data |
| `option_trades` | User trades (direction, amount, entry/exit price, profit/loss) |
| `transactions` | Deposit/withdrawal records |
| `news` | News articles with categories |
| `comments` | News comments |
| `hero_banners` | Homepage banners |
| `charity_programs` | Charity campaigns |
| `bank_accounts` | User bank accounts |
| `deposit_settings` | Deposit method configs (bank/crypto/QR) |
| `live_chat_rooms` | Chat rooms |
| `live_chat_messages` | Chat messages |
| `live_chat_notes` | Admin notes on chat rooms |
| `live_chat_typing` | Typing indicators |
| `quick_reply_templates` | Admin quick reply templates |
| `user_notifications` | User notifications |
| `admin_user_notes` | Admin notes on users |
| `audit_logs` | Admin action logs |
| `app_settings` | App configuration (exchange rates, bankquay toggle) |
| `rate_limits` | Rate limiting records |
| `identity_verifications` | KYC documents |

### Key Functions
- `process_option_trade` - Place option trade
- `settle_option_trade` - Settle expired trade
- `admin_approve_deposit/withdrawal` - Admin transaction approval
- `admin_add/subtract_balance` - Balance management
- `create_withdrawal_request` - Withdrawal with validation
- `has_role` - Role check for RLS
- `check_rate_limit` - Rate limiting

### Enums
- `app_role`: admin, user
- `news_category`: company, product, event, announcement, charity
- `product_status`: available, sold, pending

---

## ⚡ Edge Functions (`supabase/functions/`)

| Function | Purpose |
|----------|---------|
| `ohlc` | Generate OHLC candlestick data |
| `settle-expired-trades` | Auto-settle expired option trades |
| `sync-external-data` | Sync products/news/banners from external API |
| `sync-price-history` | Sync price data |
| `track-login` | Record user login IP |
| `admin-update-password` | Admin password change |
| `withdrawal-password` | Set/verify withdrawal password |
| `ip-geolocation` | IP location lookup |
| `bankquay-qr` | Generate deposit QR code |
| `bankquay-webhook` | Handle bank payment webhook |
| `bankquay-manual-match` | Manual transaction matching |

---

## 🔐 Auth & Security

- **Auth Provider:** Email/password via Supabase Auth
- **Admin check:** Client-side `isAdmin` for UI only; actual auth via RLS `has_role()`
- **Quick Login:** PIN or biometric unlock (stored encrypted in localStorage)
- **Account freeze:** `is_frozen` flag prevents login
- **Withdrawal password:** Separate password for fund withdrawal
- **Rate limiting:** DB-level rate limiting via `check_rate_limit()`
- **Audit logs:** All admin actions logged

---

## 📦 Key Dependencies

```json
{
  "react": "^18.3.1",
  "react-router-dom": "^6.30.1",
  "@supabase/supabase-js": "^2.90.1",
  "@tanstack/react-query": "^5.83.0",
  "lightweight-charts": "^5.1.0",
  "recharts": "^2.15.4",
  "lucide-react": "^0.462.0",
  "sonner": "^1.7.4",
  "date-fns": "^3.6.0",
  "zod": "^3.25.76",
  "jspdf": "^4.0.0",
  "xlsx": "^0.18.5"
}
```

---

## 🏗️ Configuration

### `vite.config.ts`
```ts
export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080 },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
    dedupe: ["react", "react-dom"],
  },
}));
```

### `tailwind.config.ts`
- Dark mode via class
- Custom colors: neon cyan/green, semantic tokens
- Custom animations: fade-in, slide-in, pulse-glow, shimmer, price-flash
- Container: centered, max 1400px

---

## 🚧 Known Issues
- Iframe chart only works with products that have correct slug mapping
- Legacy Dashboard.tsx exists alongside new AdminLayout system
