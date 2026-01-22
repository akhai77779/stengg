import { Link } from 'react-router-dom';
import { GuestLayout } from '@/components/guest/GuestLayout';
import { useLanguage } from '@/contexts/LanguageContext';

export default function GuestHome() {
  const { t } = useLanguage();

  const businessCards = [
    {
      titleKey: 'guest.aviation',
      descKey: 'guest.aviationDesc',
      image: 'https://images.unsplash.com/photo-1768519648014-077e0635903b?auto=format&fit=crop&w=900&q=80',
    },
    {
      titleKey: 'guest.cities',
      descKey: 'guest.citiesDesc',
      image: 'https://images.unsplash.com/photo-1644321939012-840bf13ea6d9?auto=format&fit=crop&w=900&q=80',
    },
    {
      titleKey: 'guest.security',
      descKey: 'guest.securityDesc',
      image: 'https://images.unsplash.com/photo-1768224656445-33d078c250b7?auto=format&fit=crop&w=900&q=80',
    },
  ];

  const newsItems = [
    {
      titleKey: 'guest.news1Title',
      date: '17 January 2026',
      category: t('guest.aerospace'),
      image: 'https://images.unsplash.com/photo-1764547168182-bdfd5b635e60?auto=format&fit=crop&w=900&q=80',
    },
    {
      titleKey: 'guest.news2Title',
      date: '15 January 2026',
      category: t('guest.innovation'),
      image: 'https://images.unsplash.com/photo-1760493828288-d2dbb70d18c9?auto=format&fit=crop&w=900&q=80',
    },
    {
      titleKey: 'guest.news3Title',
      date: '12 January 2026',
      category: t('guest.smartCity'),
      image: 'https://images.unsplash.com/photo-1760553120312-2821bf54e767?auto=format&fit=crop&w=900&q=80',
    },
  ];

  return (
    <GuestLayout>
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-[#0a0e1a] -mt-[104px] pt-[104px]">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1655582590501-3da761e09ae9?auto=format&fit=crop&w=1400&q=80"
            alt="Digital Innovation"
            className="w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 hero-overlay"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h1 className="text-5xl md:text-7xl lg:text-8xl mb-4 font-light tracking-tight">
            {t('guest.heroTitle')}
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 font-light">
            {t('guest.heroSubtitle')}
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-3 border border-white text-white hover:bg-white hover:text-[#0a0e1a] transition-all duration-300 text-sm tracking-wide"
          >
            {t('nav.login')}
          </Link>
        </div>

        <div className="absolute bottom-8 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-white">
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">{t('guest.pavilionBooth')}</div>
                <div className="text-2xl font-light">S3.A-03 • T3.A15</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">{t('common.date')}</div>
                <div className="text-2xl font-light">2026</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">{t('guest.eventDate')}</div>
                <div className="text-2xl font-light">Hall 2 Stand : 02H-001</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">{t('guest.hallStand')}</div>
                <div className="text-2xl font-light">Hall 02H-001</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Section */}
      <section className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl mb-6 font-light text-gray-900">
            {t('guest.techTitle')}
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            {t('guest.techDesc')}
          </p>
        </div>
      </section>

      {/* AI Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl mb-6 font-light text-gray-900">
              {t('guest.aiTitle')}
            </h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              {t('guest.aiDesc')}
            </p>
            <p className="text-gray-600 leading-relaxed mb-8">
              {t('guest.aiDesc2')}
            </p>
            <button className="px-6 py-3 bg-[#0066cc] text-white hover:bg-[#0052a3] text-sm">
              {t('guest.readMore')}
            </button>
            <p className="text-sm text-gray-500 mt-8">{t('guest.enablingFuture')}</p>
          </div>
          <img
            src="https://images.unsplash.com/photo-1739054729971-c27157b0c580?auto=format&fit=crop&w=900&q=80"
            alt="AI Innovation"
            className="w-full rounded-lg shadow-lg"
          />
        </div>
      </section>

      {/* Business Cards Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-3 gap-8">
          {businessCards.map((card, index) => (
            <div key={index} className="group relative overflow-hidden">
              <div className="relative h-80 overflow-hidden">
                <img
                  src={card.image}
                  alt={t(card.titleKey)}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="text-xl mb-2 font-light">{t(card.titleKey)}</h3>
                <p className="text-sm text-gray-300 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {t(card.descKey)}
                </p>
                <div className="flex items-center text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="mr-2">{t('auth.learnMore')}</span>
                  →
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-[#0a0e1a] text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-5xl mb-6 font-light leading-tight">
            {t('guest.ctaTitle')}
          </h2>
          <p className="text-lg text-gray-400 leading-relaxed mb-8">
            {t('guest.ctaDesc')}
          </p>
          <button className="px-8 py-3 border border-white text-white hover:bg-white hover:text-[#0a0e1a] text-sm tracking-wide">
            {t('guest.discover')}
          </button>
        </div>
      </section>

      {/* Innovation Cards Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl mb-12 font-light text-gray-900 text-center">
            {t('guest.aiInnovation')}
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1760629863094-5b1e8d1aae74?auto=format&fit=crop&w=900&q=80"
                alt={t('guest.smartCity')}
                className="h-80 w-full object-cover"
              />
              <div className="p-8">
                <div className="text-sm text-gray-500 mb-2 uppercase tracking-wide">{t('guest.smartCity')}</div>
                <h3 className="text-2xl mb-4 font-light text-gray-900">
                  {t('guest.smartCityTitle')}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {t('guest.smartCityDesc')}
                </p>
                <button className="text-[#0066cc] text-sm font-medium">{t('auth.learnMore')} →</button>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1768224656445-33d078c250b7?auto=format&fit=crop&w=900&q=80"
                alt={t('guest.cybersecurity')}
                className="h-80 w-full object-cover"
              />
              <div className="p-8">
                <div className="text-sm text-gray-500 mb-2 uppercase tracking-wide">{t('guest.cybersecurity')}</div>
                <h3 className="text-2xl mb-4 font-light text-gray-900">
                  {t('guest.cybersecurityTitle')}
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {t('guest.cybersecurityDesc')}
                </p>
                <button className="text-[#0066cc] text-sm font-medium">{t('auth.learnMore')} →</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Careers Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
          <img
            src="https://images.unsplash.com/photo-1758518732175-5d608ba3abdf?auto=format&fit=crop&w=900&q=80"
            alt="Team collaboration"
            className="w-full h-auto"
          />
          <div>
            <h2 className="text-3xl md:text-4xl mb-6 font-light text-gray-900">
              {t('guest.careersTitle')}
            </h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              {t('guest.careersDesc')}
            </p>
            <button className="px-6 py-3 bg-[#0066cc] text-white hover:bg-[#0052a3] text-sm">
              {t('guest.viewCareers')}
            </button>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex items-center justify-between">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900">{t('guest.newsTitle')}</h2>
            <a href="#" className="text-[#0066cc] text-sm">{t('common.viewAll')} →</a>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {newsItems.map((news, index) => (
              <div key={index} className="bg-white rounded-lg overflow-hidden shadow-md">
                <img
                  src={news.image}
                  alt={t(news.titleKey)}
                  className="h-48 w-full object-cover"
                />
                <div className="p-6">
                  <div className="text-sm text-gray-500 mb-3">{news.date}</div>
                  <h3 className="text-xl mb-2 text-gray-900">{t(news.titleKey)}</h3>
                  <div className="text-sm text-gray-600">{news.category}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </GuestLayout>
  );
}