import { Link } from 'react-router-dom';
import { useLanguage, Language } from '@/contexts/LanguageContext';

export function GuestHeader() {
  const { language, setLanguage } = useLanguage();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-[#0a0e1a]">
      {/* Top bar */}
      <div className="border-b border-gray-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-10 text-xs text-gray-300">
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-white">Global</a>
              <a href="#" className="hover:text-white">Contact</a>
              <a href="#" className="hover:text-white">Support</a>
            </div>
            <div className="flex items-center gap-3">
              <Link to="/login" className="hover:text-white">Login</Link>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent border border-gray-700 text-gray-200 text-[11px] rounded px-2 py-0.5"
              >
                <option value="vi">🇻🇳 Tiếng Việt</option>
                <option value="en">🇬🇧 English</option>
                <option value="zh">🇨🇳 中文</option>
                <option value="th">🇹🇭 ไทย</option>
                <option value="ja">🇯🇵 日本語</option>
                <option value="ko">🇰🇷 한국어</option>
                <option value="id">🇮🇩 Bahasa Indonesia</option>
                <option value="ms">🇲🇾 Bahasa Melayu</option>
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
            <a href="#" className="hover:text-white">About us</a>
            <a href="#" className="hover:text-white">Our Businesses</a>
            <a href="#" className="hover:text-white">Investor Relations</a>
            <a href="#" className="hover:text-white">Sustainability</a>
            <a href="#" className="hover:text-white">Newsroom</a>
            <a href="#" className="hover:text-white">Careers</a>
          </nav>
        </div>
      </div>
    </header>
  );
}
