import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'vi' | 'en' | 'zh';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  vi: {
    // Common
    'common.loading': 'Đang tải...',
    'common.save': 'Lưu',
    'common.cancel': 'Hủy',
    'common.confirm': 'Xác nhận',
    'common.delete': 'Xóa',
    'common.edit': 'Sửa',
    'common.add': 'Thêm',
    'common.search': 'Tìm kiếm',
    'common.filter': 'Lọc',
    'common.all': 'Tất cả',
    'common.viewAll': 'Xem tất cả',
    'common.back': 'Quay lại',
    'common.close': 'Đóng',
    'common.submit': 'Gửi',
    'common.status': 'Trạng thái',
    'common.details': 'Chi tiết',
    
    // Navigation
    'nav.home': 'Trang chủ',
    'nav.products': 'Sản phẩm',
    'nav.news': 'Tin tức',
    'nav.charity': 'Thiện nguyện',
    'nav.profile': 'Hồ sơ',
    'nav.deposit': 'Nạp tiền',
    'nav.withdraw': 'Rút tiền',
    'nav.dashboard': 'Quản trị',
    'nav.logout': 'Đăng xuất',
    'nav.login': 'Đăng nhập',
    
    // Auth
    'auth.login': 'Đăng nhập',
    'auth.register': 'Đăng ký',
    'auth.email': 'Email',
    'auth.password': 'Mật khẩu',
    'auth.fullName': 'Họ và tên',
    'auth.forgotPassword': 'Quên mật khẩu?',
    'auth.noAccount': 'Chưa có tài khoản?',
    'auth.hasAccount': 'Đã có tài khoản?',
    
    // Products
    'products.title': 'Sản phẩm',
    'products.featured': 'Sản phẩm nổi bật',
    'products.all': 'Tất cả sản phẩm',
    'products.buy': 'Mua',
    'products.sell': 'Bán',
    'products.price': 'Giá',
    'products.status.available': 'Còn hàng',
    'products.status.sold': 'Đã bán',
    'products.status.pending': 'Đang chờ',
    
    // Profile
    'profile.title': 'Hồ sơ cá nhân',
    'profile.balance': 'Số dư',
    'profile.totalIncome': 'Tổng thu nhập',
    'profile.transactionHistory': 'Lịch sử giao dịch',
    'profile.depositWithdraw': 'Nạp/Rút tiền',
    'profile.trade': 'Mua/Bán',
    
    // Transactions
    'transaction.deposit': 'Nạp tiền',
    'transaction.withdraw': 'Rút tiền',
    'transaction.buy': 'Mua',
    'transaction.sell': 'Bán',
    'transaction.pending': 'Đang xử lý',
    'transaction.approved': 'Hoàn thành',
    'transaction.rejected': 'Từ chối',
    'transaction.amount': 'Số tiền',
    'transaction.network': 'Mạng',
    'transaction.walletAddress': 'Địa chỉ ví',
    'transaction.noTransactions': 'Chưa có giao dịch nào',
    
    // News
    'news.title': 'Tin tức',
    'news.latest': 'Tin tức mới nhất',
    'news.readMore': 'Xem thêm',
    'news.views': 'lượt xem',
    'news.comments': 'Bình luận',
    'news.writeComment': 'Viết bình luận...',
    
    // Charity
    'charity.title': 'Chương trình thiện nguyện',
    'charity.progress': 'Tiến độ',
    'charity.target': 'Mục tiêu',
    'charity.current': 'Đã quyên góp',
    
    // Settings
    'settings.language': 'Ngôn ngữ',
    'settings.currency': 'Tiền tệ',
    'settings.exchangeRate': 'Tỷ giá',
  },
  en: {
    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.confirm': 'Confirm',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.add': 'Add',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.viewAll': 'View All',
    'common.back': 'Back',
    'common.close': 'Close',
    'common.submit': 'Submit',
    'common.status': 'Status',
    'common.details': 'Details',
    
    // Navigation
    'nav.home': 'Home',
    'nav.products': 'Products',
    'nav.news': 'News',
    'nav.charity': 'Charity',
    'nav.profile': 'Profile',
    'nav.deposit': 'Deposit',
    'nav.withdraw': 'Withdraw',
    'nav.dashboard': 'Dashboard',
    'nav.logout': 'Logout',
    'nav.login': 'Login',
    
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.fullName': 'Full Name',
    'auth.forgotPassword': 'Forgot password?',
    'auth.noAccount': "Don't have an account?",
    'auth.hasAccount': 'Already have an account?',
    
    // Products
    'products.title': 'Products',
    'products.featured': 'Featured Products',
    'products.all': 'All Products',
    'products.buy': 'Buy',
    'products.sell': 'Sell',
    'products.price': 'Price',
    'products.status.available': 'Available',
    'products.status.sold': 'Sold',
    'products.status.pending': 'Pending',
    
    // Profile
    'profile.title': 'My Profile',
    'profile.balance': 'Balance',
    'profile.totalIncome': 'Total Income',
    'profile.transactionHistory': 'Transaction History',
    'profile.depositWithdraw': 'Deposit/Withdraw',
    'profile.trade': 'Buy/Sell',
    
    // Transactions
    'transaction.deposit': 'Deposit',
    'transaction.withdraw': 'Withdraw',
    'transaction.buy': 'Buy',
    'transaction.sell': 'Sell',
    'transaction.pending': 'Pending',
    'transaction.approved': 'Completed',
    'transaction.rejected': 'Rejected',
    'transaction.amount': 'Amount',
    'transaction.network': 'Network',
    'transaction.walletAddress': 'Wallet Address',
    'transaction.noTransactions': 'No transactions yet',
    
    // News
    'news.title': 'News',
    'news.latest': 'Latest News',
    'news.readMore': 'Read More',
    'news.views': 'views',
    'news.comments': 'Comments',
    'news.writeComment': 'Write a comment...',
    
    // Charity
    'charity.title': 'Charity Programs',
    'charity.progress': 'Progress',
    'charity.target': 'Target',
    'charity.current': 'Raised',
    
    // Settings
    'settings.language': 'Language',
    'settings.currency': 'Currency',
    'settings.exchangeRate': 'Exchange Rate',
  },
  zh: {
    // Common
    'common.loading': '加载中...',
    'common.save': '保存',
    'common.cancel': '取消',
    'common.confirm': '确认',
    'common.delete': '删除',
    'common.edit': '编辑',
    'common.add': '添加',
    'common.search': '搜索',
    'common.filter': '筛选',
    'common.all': '全部',
    'common.viewAll': '查看全部',
    'common.back': '返回',
    'common.close': '关闭',
    'common.submit': '提交',
    'common.status': '状态',
    'common.details': '详情',
    
    // Navigation
    'nav.home': '首页',
    'nav.products': '产品',
    'nav.news': '新闻',
    'nav.charity': '慈善',
    'nav.profile': '个人资料',
    'nav.deposit': '充值',
    'nav.withdraw': '提现',
    'nav.dashboard': '管理后台',
    'nav.logout': '退出登录',
    'nav.login': '登录',
    
    // Auth
    'auth.login': '登录',
    'auth.register': '注册',
    'auth.email': '邮箱',
    'auth.password': '密码',
    'auth.fullName': '姓名',
    'auth.forgotPassword': '忘记密码？',
    'auth.noAccount': '还没有账号？',
    'auth.hasAccount': '已有账号？',
    
    // Products
    'products.title': '产品',
    'products.featured': '精选产品',
    'products.all': '全部产品',
    'products.buy': '购买',
    'products.sell': '出售',
    'products.price': '价格',
    'products.status.available': '可购买',
    'products.status.sold': '已售出',
    'products.status.pending': '待处理',
    
    // Profile
    'profile.title': '个人资料',
    'profile.balance': '余额',
    'profile.totalIncome': '总收入',
    'profile.transactionHistory': '交易记录',
    'profile.depositWithdraw': '充值/提现',
    'profile.trade': '买入/卖出',
    
    // Transactions
    'transaction.deposit': '充值',
    'transaction.withdraw': '提现',
    'transaction.buy': '买入',
    'transaction.sell': '卖出',
    'transaction.pending': '处理中',
    'transaction.approved': '已完成',
    'transaction.rejected': '已拒绝',
    'transaction.amount': '金额',
    'transaction.network': '网络',
    'transaction.walletAddress': '钱包地址',
    'transaction.noTransactions': '暂无交易记录',
    
    // News
    'news.title': '新闻',
    'news.latest': '最新新闻',
    'news.readMore': '阅读更多',
    'news.views': '浏览',
    'news.comments': '评论',
    'news.writeComment': '写评论...',
    
    // Charity
    'charity.title': '慈善项目',
    'charity.progress': '进度',
    'charity.target': '目标',
    'charity.current': '已筹集',
    
    // Settings
    'settings.language': '语言',
    'settings.currency': '货币',
    'settings.exchangeRate': '汇率',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'vi';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
