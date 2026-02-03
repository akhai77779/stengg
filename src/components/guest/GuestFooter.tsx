import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveChat } from '@/contexts/LiveChatContext';

export function GuestFooter() {
  const { t } = useLanguage();
  const { openChat } = useLiveChat();

  return (
    <footer className="bg-[#0a0e1a] text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          <div>
            <img
              src="https://www.stengg.com/images/st-logo-white-footer.png"
              alt="ST Engineering"
              className="h-6 w-auto mb-4"
            />
            <p className="text-sm text-gray-400">
              {t('guest.footerDescription')}
            </p>
          </div>
          <div>
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-4">{t('guest.aboutUs')}</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">{t('guest.companyOverview')}</a></li>
              <li><a href="#" className="hover:text-white">{t('guest.leadership')}</a></li>
              <li><a href="#" className="hover:text-white">{t('guest.sustainability')}</a></li>
              <li><a href="#" className="hover:text-white">{t('guest.careers')}</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-4">{t('guest.ourBusinesses')}</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">{t('guest.aerospace')}</a></li>
              <li><a href="#" className="hover:text-white">{t('guest.smartCity')}</a></li>
              <li><a href="#" className="hover:text-white">{t('guest.defence')}</a></li>
              <li><a href="#" className="hover:text-white">{t('guest.digitalSystems')}</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-4">{t('guest.contact')}</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">{t('guest.contactUs')}</a></li>
              <li>
                <button 
                  onClick={openChat}
                  className="hover:text-white transition-colors"
                >
                  {t('guest.support')}
                </button>
              </li>
              <li><a href="#" className="hover:text-white">{t('guest.newsroom')}</a></li>
            </ul>
            <button 
              onClick={openChat}
              className="mt-6 px-6 py-3 min-h-[48px] bg-[#0066cc] text-white hover:bg-[#0052a3] active:bg-[#004080] active:scale-95 text-sm font-medium transition-all duration-200 touch-manipulation select-none flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              Live Chat
            </button>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-800/60 pt-6 text-xs text-gray-500 flex flex-col md:flex-row justify-between gap-4">
          <span>{t('guest.copyright')}</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white">{t('auth.privacyPolicy')}</a>
            <a href="#" className="hover:text-white">{t('guest.termsOfUse')}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
