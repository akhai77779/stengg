import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'vi' | 'en' | 'zh' | 'th' | 'ja' | 'ko' | 'id' | 'ms';

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
  th: {
    // Common
    'common.loading': 'กำลังโหลด...',
    'common.save': 'บันทึก',
    'common.cancel': 'ยกเลิก',
    'common.confirm': 'ยืนยัน',
    'common.delete': 'ลบ',
    'common.edit': 'แก้ไข',
    'common.add': 'เพิ่ม',
    'common.search': 'ค้นหา',
    'common.filter': 'กรอง',
    'common.all': 'ทั้งหมด',
    'common.viewAll': 'ดูทั้งหมด',
    'common.back': 'กลับ',
    'common.close': 'ปิด',
    'common.submit': 'ส่ง',
    'common.status': 'สถานะ',
    'common.details': 'รายละเอียด',
    
    // Navigation
    'nav.home': 'หน้าแรก',
    'nav.products': 'สินค้า',
    'nav.news': 'ข่าวสาร',
    'nav.charity': 'การกุศล',
    'nav.profile': 'โปรไฟล์',
    'nav.deposit': 'ฝากเงิน',
    'nav.withdraw': 'ถอนเงิน',
    'nav.dashboard': 'แดชบอร์ด',
    'nav.logout': 'ออกจากระบบ',
    'nav.login': 'เข้าสู่ระบบ',
    
    // Auth
    'auth.login': 'เข้าสู่ระบบ',
    'auth.register': 'ลงทะเบียน',
    'auth.email': 'อีเมล',
    'auth.password': 'รหัสผ่าน',
    'auth.fullName': 'ชื่อ-นามสกุล',
    'auth.forgotPassword': 'ลืมรหัสผ่าน?',
    'auth.noAccount': 'ยังไม่มีบัญชี?',
    'auth.hasAccount': 'มีบัญชีแล้ว?',
    
    // Products
    'products.title': 'สินค้า',
    'products.featured': 'สินค้าแนะนำ',
    'products.all': 'สินค้าทั้งหมด',
    'products.buy': 'ซื้อ',
    'products.sell': 'ขาย',
    'products.price': 'ราคา',
    'products.status.available': 'มีสินค้า',
    'products.status.sold': 'ขายแล้ว',
    'products.status.pending': 'รอดำเนินการ',
    
    // Profile
    'profile.title': 'โปรไฟล์ของฉัน',
    'profile.balance': 'ยอดคงเหลือ',
    'profile.totalIncome': 'รายได้รวม',
    'profile.transactionHistory': 'ประวัติธุรกรรม',
    'profile.depositWithdraw': 'ฝาก/ถอน',
    'profile.trade': 'ซื้อ/ขาย',
    
    // Transactions
    'transaction.deposit': 'ฝากเงิน',
    'transaction.withdraw': 'ถอนเงิน',
    'transaction.buy': 'ซื้อ',
    'transaction.sell': 'ขาย',
    'transaction.pending': 'รอดำเนินการ',
    'transaction.approved': 'สำเร็จ',
    'transaction.rejected': 'ถูกปฏิเสธ',
    'transaction.amount': 'จำนวน',
    'transaction.network': 'เครือข่าย',
    'transaction.walletAddress': 'ที่อยู่กระเป๋าเงิน',
    'transaction.noTransactions': 'ยังไม่มีธุรกรรม',
    
    // News
    'news.title': 'ข่าวสาร',
    'news.latest': 'ข่าวล่าสุด',
    'news.readMore': 'อ่านเพิ่มเติม',
    'news.views': 'ครั้ง',
    'news.comments': 'ความคิดเห็น',
    'news.writeComment': 'เขียนความคิดเห็น...',
    
    // Charity
    'charity.title': 'โครงการการกุศล',
    'charity.progress': 'ความคืบหน้า',
    'charity.target': 'เป้าหมาย',
    'charity.current': 'ระดมทุนได้',
    
    // Settings
    'settings.language': 'ภาษา',
    'settings.currency': 'สกุลเงิน',
    'settings.exchangeRate': 'อัตราแลกเปลี่ยน',
  },
  ja: {
    // Common
    'common.loading': '読み込み中...',
    'common.save': '保存',
    'common.cancel': 'キャンセル',
    'common.confirm': '確認',
    'common.delete': '削除',
    'common.edit': '編集',
    'common.add': '追加',
    'common.search': '検索',
    'common.filter': 'フィルター',
    'common.all': 'すべて',
    'common.viewAll': 'すべて見る',
    'common.back': '戻る',
    'common.close': '閉じる',
    'common.submit': '送信',
    'common.status': 'ステータス',
    'common.details': '詳細',
    
    // Navigation
    'nav.home': 'ホーム',
    'nav.products': '製品',
    'nav.news': 'ニュース',
    'nav.charity': 'チャリティ',
    'nav.profile': 'プロフィール',
    'nav.deposit': '入金',
    'nav.withdraw': '出金',
    'nav.dashboard': 'ダッシュボード',
    'nav.logout': 'ログアウト',
    'nav.login': 'ログイン',
    
    // Auth
    'auth.login': 'ログイン',
    'auth.register': '登録',
    'auth.email': 'メール',
    'auth.password': 'パスワード',
    'auth.fullName': '氏名',
    'auth.forgotPassword': 'パスワードをお忘れですか？',
    'auth.noAccount': 'アカウントをお持ちでない方',
    'auth.hasAccount': 'アカウントをお持ちの方',
    
    // Products
    'products.title': '製品',
    'products.featured': 'おすすめ製品',
    'products.all': 'すべての製品',
    'products.buy': '購入',
    'products.sell': '売却',
    'products.price': '価格',
    'products.status.available': '在庫あり',
    'products.status.sold': '売却済み',
    'products.status.pending': '保留中',
    
    // Profile
    'profile.title': 'マイプロフィール',
    'profile.balance': '残高',
    'profile.totalIncome': '総収入',
    'profile.transactionHistory': '取引履歴',
    'profile.depositWithdraw': '入金/出金',
    'profile.trade': '売買',
    
    // Transactions
    'transaction.deposit': '入金',
    'transaction.withdraw': '出金',
    'transaction.buy': '購入',
    'transaction.sell': '売却',
    'transaction.pending': '処理中',
    'transaction.approved': '完了',
    'transaction.rejected': '拒否',
    'transaction.amount': '金額',
    'transaction.network': 'ネットワーク',
    'transaction.walletAddress': 'ウォレットアドレス',
    'transaction.noTransactions': '取引履歴なし',
    
    // News
    'news.title': 'ニュース',
    'news.latest': '最新ニュース',
    'news.readMore': '続きを読む',
    'news.views': '閲覧',
    'news.comments': 'コメント',
    'news.writeComment': 'コメントを書く...',
    
    // Charity
    'charity.title': 'チャリティプログラム',
    'charity.progress': '進捗',
    'charity.target': '目標',
    'charity.current': '募金額',
    
    // Settings
    'settings.language': '言語',
    'settings.currency': '通貨',
    'settings.exchangeRate': '為替レート',
  },
  ko: {
    // Common
    'common.loading': '로딩 중...',
    'common.save': '저장',
    'common.cancel': '취소',
    'common.confirm': '확인',
    'common.delete': '삭제',
    'common.edit': '편집',
    'common.add': '추가',
    'common.search': '검색',
    'common.filter': '필터',
    'common.all': '전체',
    'common.viewAll': '전체 보기',
    'common.back': '뒤로',
    'common.close': '닫기',
    'common.submit': '제출',
    'common.status': '상태',
    'common.details': '세부사항',
    
    // Navigation
    'nav.home': '홈',
    'nav.products': '제품',
    'nav.news': '뉴스',
    'nav.charity': '자선',
    'nav.profile': '프로필',
    'nav.deposit': '입금',
    'nav.withdraw': '출금',
    'nav.dashboard': '대시보드',
    'nav.logout': '로그아웃',
    'nav.login': '로그인',
    
    // Auth
    'auth.login': '로그인',
    'auth.register': '회원가입',
    'auth.email': '이메일',
    'auth.password': '비밀번호',
    'auth.fullName': '이름',
    'auth.forgotPassword': '비밀번호를 잊으셨나요?',
    'auth.noAccount': '계정이 없으신가요?',
    'auth.hasAccount': '이미 계정이 있으신가요?',
    
    // Products
    'products.title': '제품',
    'products.featured': '추천 제품',
    'products.all': '전체 제품',
    'products.buy': '구매',
    'products.sell': '판매',
    'products.price': '가격',
    'products.status.available': '구매 가능',
    'products.status.sold': '판매 완료',
    'products.status.pending': '대기 중',
    
    // Profile
    'profile.title': '내 프로필',
    'profile.balance': '잔액',
    'profile.totalIncome': '총 수입',
    'profile.transactionHistory': '거래 내역',
    'profile.depositWithdraw': '입금/출금',
    'profile.trade': '매매',
    
    // Transactions
    'transaction.deposit': '입금',
    'transaction.withdraw': '출금',
    'transaction.buy': '구매',
    'transaction.sell': '판매',
    'transaction.pending': '처리 중',
    'transaction.approved': '완료',
    'transaction.rejected': '거부됨',
    'transaction.amount': '금액',
    'transaction.network': '네트워크',
    'transaction.walletAddress': '지갑 주소',
    'transaction.noTransactions': '거래 내역 없음',
    
    // News
    'news.title': '뉴스',
    'news.latest': '최신 뉴스',
    'news.readMore': '더 보기',
    'news.views': '조회',
    'news.comments': '댓글',
    'news.writeComment': '댓글 작성...',
    
    // Charity
    'charity.title': '자선 프로그램',
    'charity.progress': '진행률',
    'charity.target': '목표',
    'charity.current': '모금액',
    
    // Settings
    'settings.language': '언어',
    'settings.currency': '통화',
    'settings.exchangeRate': '환율',
  },
  id: {
    // Common
    'common.loading': 'Memuat...',
    'common.save': 'Simpan',
    'common.cancel': 'Batal',
    'common.confirm': 'Konfirmasi',
    'common.delete': 'Hapus',
    'common.edit': 'Edit',
    'common.add': 'Tambah',
    'common.search': 'Cari',
    'common.filter': 'Filter',
    'common.all': 'Semua',
    'common.viewAll': 'Lihat Semua',
    'common.back': 'Kembali',
    'common.close': 'Tutup',
    'common.submit': 'Kirim',
    'common.status': 'Status',
    'common.details': 'Detail',
    
    // Navigation
    'nav.home': 'Beranda',
    'nav.products': 'Produk',
    'nav.news': 'Berita',
    'nav.charity': 'Amal',
    'nav.profile': 'Profil',
    'nav.deposit': 'Setor',
    'nav.withdraw': 'Tarik',
    'nav.dashboard': 'Dasbor',
    'nav.logout': 'Keluar',
    'nav.login': 'Masuk',
    
    // Auth
    'auth.login': 'Masuk',
    'auth.register': 'Daftar',
    'auth.email': 'Email',
    'auth.password': 'Kata Sandi',
    'auth.fullName': 'Nama Lengkap',
    'auth.forgotPassword': 'Lupa kata sandi?',
    'auth.noAccount': 'Belum punya akun?',
    'auth.hasAccount': 'Sudah punya akun?',
    
    // Products
    'products.title': 'Produk',
    'products.featured': 'Produk Unggulan',
    'products.all': 'Semua Produk',
    'products.buy': 'Beli',
    'products.sell': 'Jual',
    'products.price': 'Harga',
    'products.status.available': 'Tersedia',
    'products.status.sold': 'Terjual',
    'products.status.pending': 'Tertunda',
    
    // Profile
    'profile.title': 'Profil Saya',
    'profile.balance': 'Saldo',
    'profile.totalIncome': 'Total Pendapatan',
    'profile.transactionHistory': 'Riwayat Transaksi',
    'profile.depositWithdraw': 'Setor/Tarik',
    'profile.trade': 'Jual/Beli',
    
    // Transactions
    'transaction.deposit': 'Setor',
    'transaction.withdraw': 'Tarik',
    'transaction.buy': 'Beli',
    'transaction.sell': 'Jual',
    'transaction.pending': 'Menunggu',
    'transaction.approved': 'Selesai',
    'transaction.rejected': 'Ditolak',
    'transaction.amount': 'Jumlah',
    'transaction.network': 'Jaringan',
    'transaction.walletAddress': 'Alamat Dompet',
    'transaction.noTransactions': 'Belum ada transaksi',
    
    // News
    'news.title': 'Berita',
    'news.latest': 'Berita Terbaru',
    'news.readMore': 'Baca Selengkapnya',
    'news.views': 'dilihat',
    'news.comments': 'Komentar',
    'news.writeComment': 'Tulis komentar...',
    
    // Charity
    'charity.title': 'Program Amal',
    'charity.progress': 'Progres',
    'charity.target': 'Target',
    'charity.current': 'Terkumpul',
    
    // Settings
    'settings.language': 'Bahasa',
    'settings.currency': 'Mata Uang',
    'settings.exchangeRate': 'Kurs',
  },
  ms: {
    // Common
    'common.loading': 'Memuatkan...',
    'common.save': 'Simpan',
    'common.cancel': 'Batal',
    'common.confirm': 'Sahkan',
    'common.delete': 'Padam',
    'common.edit': 'Edit',
    'common.add': 'Tambah',
    'common.search': 'Cari',
    'common.filter': 'Tapis',
    'common.all': 'Semua',
    'common.viewAll': 'Lihat Semua',
    'common.back': 'Kembali',
    'common.close': 'Tutup',
    'common.submit': 'Hantar',
    'common.status': 'Status',
    'common.details': 'Butiran',
    
    // Navigation
    'nav.home': 'Laman Utama',
    'nav.products': 'Produk',
    'nav.news': 'Berita',
    'nav.charity': 'Amal',
    'nav.profile': 'Profil',
    'nav.deposit': 'Deposit',
    'nav.withdraw': 'Pengeluaran',
    'nav.dashboard': 'Papan Pemuka',
    'nav.logout': 'Log Keluar',
    'nav.login': 'Log Masuk',
    
    // Auth
    'auth.login': 'Log Masuk',
    'auth.register': 'Daftar',
    'auth.email': 'E-mel',
    'auth.password': 'Kata Laluan',
    'auth.fullName': 'Nama Penuh',
    'auth.forgotPassword': 'Lupa kata laluan?',
    'auth.noAccount': 'Belum ada akaun?',
    'auth.hasAccount': 'Sudah ada akaun?',
    
    // Products
    'products.title': 'Produk',
    'products.featured': 'Produk Pilihan',
    'products.all': 'Semua Produk',
    'products.buy': 'Beli',
    'products.sell': 'Jual',
    'products.price': 'Harga',
    'products.status.available': 'Tersedia',
    'products.status.sold': 'Terjual',
    'products.status.pending': 'Tertangguh',
    
    // Profile
    'profile.title': 'Profil Saya',
    'profile.balance': 'Baki',
    'profile.totalIncome': 'Jumlah Pendapatan',
    'profile.transactionHistory': 'Sejarah Transaksi',
    'profile.depositWithdraw': 'Deposit/Pengeluaran',
    'profile.trade': 'Jual/Beli',
    
    // Transactions
    'transaction.deposit': 'Deposit',
    'transaction.withdraw': 'Pengeluaran',
    'transaction.buy': 'Beli',
    'transaction.sell': 'Jual',
    'transaction.pending': 'Menunggu',
    'transaction.approved': 'Selesai',
    'transaction.rejected': 'Ditolak',
    'transaction.amount': 'Jumlah',
    'transaction.network': 'Rangkaian',
    'transaction.walletAddress': 'Alamat Dompet',
    'transaction.noTransactions': 'Tiada transaksi lagi',
    
    // News
    'news.title': 'Berita',
    'news.latest': 'Berita Terkini',
    'news.readMore': 'Baca Lagi',
    'news.views': 'tontonan',
    'news.comments': 'Komen',
    'news.writeComment': 'Tulis komen...',
    
    // Charity
    'charity.title': 'Program Amal',
    'charity.progress': 'Kemajuan',
    'charity.target': 'Sasaran',
    'charity.current': 'Terkumpul',
    
    // Settings
    'settings.language': 'Bahasa',
    'settings.currency': 'Mata Wang',
    'settings.exchangeRate': 'Kadar Pertukaran',
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
