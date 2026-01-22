import { Link } from 'react-router-dom';
import { useLanguage, Language } from '@/contexts/LanguageContext';

export function GuestHeader() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-[#0a0e1a]">
      {/* Top bar */}
      <div className="border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 text-xs text-gray-300">
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-white">{t('guest.global')}</a>
              <a href="#" className="hover:text-white">{t('guest.contact')}</a>
              <a href="#" className="hover:text-white">{t('guest.support')}</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="hover:text-white">{t('nav.login')}</Link>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-[#1a1f2e] border border-gray-700 text-gray-200 text-[11px] rounded px-2 py-0.5"
              >
                <option value="vi" className="bg-[#1a1f2e]">🇻🇳 Tiếng Việt</option>
                <option value="en" className="bg-[#1a1f2e]">🇬🇧 English</option>
                <option value="zh" className="bg-[#1a1f2e]">🇨🇳 中文</option>
                <option value="th" className="bg-[#1a1f2e]">🇹🇭 ไทย</option>
                <option value="ja" className="bg-[#1a1f2e]">🇯🇵 日本語</option>
                <option value="ko" className="bg-[#1a1f2e]">🇰🇷 한국어</option>
                <option value="id" className="bg-[#1a1f2e]">🇮🇩 Bahasa Indonesia</option>
                <option value="ms" className="bg-[#1a1f2e]">🇲🇾 Bahasa Melayu</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-2 text-white text-xl font-light">
            <img
              src="https://www.stengg.com/images/st-logo-color-footer.png"
              alt="ST Engineering"
              className="h-6 w-auto"
            />
          </Link>
          <nav className="hidden lg:flex items-center space-x-8 text-sm text-gray-300">
            <a href="#" className="hover:text-white">{t('guest.aboutUs')}</a>
            <a href="#" className="hover:text-white">{t('guest.ourBusinesses')}</a>
            <a href="#" className="hover:text-white">{t('guest.investorRelations')}</a>
            <a href="#" className="hover:text-white">{t('guest.sustainability')}</a>
            <a href="#" className="hover:text-white">{t('guest.newsroom')}</a>
            <a href="#" className="hover:text-white">{t('guest.careers')}</a>
          </nav>
        </div>
      </div>
    </header>
  );
}