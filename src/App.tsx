import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { AdminNotificationsProvider } from "@/hooks/useAdminNotifications";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LiveChatProvider } from "@/contexts/LiveChatContext";
import { MobileSupportButton } from "@/components/layout/MobileSupportButton";
import { AdminRouteGuard } from "@/components/auth/AdminRouteGuard";
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
import OptionTradeHistory from "./pages/OptionTradeHistory";
import Deposit from "./pages/Deposit";
import Withdraw from "./pages/Withdraw";
import BankAccounts from "./pages/BankAccounts";
import Settings from "./pages/Settings";
import SwitchAccount from "./pages/SwitchAccount";
import About from "./pages/About";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminOverview from "./pages/admin/AdminOverview";
import AdminBanners from "./pages/admin/AdminBanners";
import AdminNews from "./pages/admin/AdminNews";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminCharity from "./pages/admin/AdminCharity";
import AdminCharityDonations from "./pages/admin/AdminCharityDonations";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminOptionTrades from "./pages/admin/AdminOptionTrades";
import AdminIdentityVerifications from "./pages/admin/AdminIdentityVerifications";
import AdminLiveChat from "./pages/admin/AdminLiveChat";
import AdminProductsMonitor from "./pages/admin/AdminProductsMonitor";
import AdminDataHealth from "./pages/admin/AdminDataHealth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Tránh refetch lại mọi query khi admin chuyển tab và quay lại
      // -> không làm reload UI / mất state cục bộ (draft tin nhắn, v.v.)
      refetchOnWindowFocus: false,
    },
  },
});

// App component with proper provider hierarchy
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
                <AdminNotificationsProvider>
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
                  <Route path="/option-trade-history" element={<OptionTradeHistory />} />
                  <Route path="/admin" element={<AdminRouteGuard><AdminLayout /></AdminRouteGuard>}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<AdminOverview />} />
                    <Route path="banners" element={<AdminBanners />} />
                    <Route path="news" element={<AdminNews />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="products-monitor" element={<AdminProductsMonitor />} />
                    <Route path="data-health" element={<AdminDataHealth />} />
                    <Route path="option-trades" element={<AdminOptionTrades />} />
                    <Route path="charity" element={<AdminCharity />} />
                    <Route path="charity-donations" element={<AdminCharityDonations />} />
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
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                  </Routes>
                </AdminNotificationsProvider>
              </AuthProvider>
            </BrowserRouter>
          </TooltipProvider>
        </LiveChatProvider>
      </CurrencyProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
