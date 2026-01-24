import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

export function GuestFooter() {
  const { t } = useLanguage();

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
              <li><a href="https://direct.lc.chat/19460523/" target="_blank" rel="noopener noreferrer" className="hover:text-white">{t('guest.support')}</a></li>
              <li><a href="#" className="hover:text-white">{t('guest.newsroom')}</a></li>
            </ul>
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