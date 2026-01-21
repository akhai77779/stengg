import { Link } from 'react-router-dom';
import { GuestLayout } from '@/components/guest/GuestLayout';

export default function GuestHome() {
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-[#0a0e1a]/60 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h1 className="text-5xl md:text-7xl lg:text-8xl mb-4 font-light tracking-tight">
            ST Engineering @ Singapore
            <br />
            Airshow 2026
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8 font-light">
            Pushing the next generation of innovation
          </p>
          <Link
            to="/auth"
            className="inline-block px-6 py-3 border border-white text-white hover:bg-white hover:text-[#0a0e1a] transition-all duration-300 text-sm tracking-wide"
          >
            Login
          </Link>
        </div>

        <div className="absolute bottom-8 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-white">
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">Singapore Pavilion booths (Hall 3)</div>
                <div className="text-2xl font-light">S3.A-03 • T3.A15</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">Date</div>
                <div className="text-2xl font-light">2026</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">Date: 6-11 Feb 2026 (Fri-Tue)</div>
                <div className="text-2xl font-light">Hall 2 Stand : 02H-001</div>
              </div>
              <div className="text-center md:text-left">
                <div className="text-sm text-gray-400 mb-1">Hall Stand</div>
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
            Technology shaping the next generation of innovation
          </h2>
          <p className="text-lg text-gray-600 leading-relaxed">
            ST Engineering is a global technology, defence and engineering group with a diverse
            portfolio of businesses across the aerospace, smart city, defence and public security
            segments. We harness technology and innovation to solve real-world problems, enabling
            a more secure and sustainable world.
          </p>
        </div>
      </section>

      {/* AI Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl mb-6 font-light text-gray-900">
              Enabling change with the power of AI
            </h2>
            <p className="text-gray-600 leading-relaxed mb-6">
              ST Engineering has embarked on a journey to become an AI-enabled organisation. Through our
              AI transformation roadmap, we are systematically deploying AI and machine learning technologies.
            </p>
            <p className="text-gray-600 leading-relaxed mb-8">
              From predictive maintenance in aerospace to smart urban solutions and advanced defence systems,
              AI is central to our innovation strategy.
            </p>
            <button className="px-6 py-3 bg-[#0066cc] text-white hover:bg-[#0052a3] text-sm">
              Read More
            </button>
            <p className="text-sm text-gray-500 mt-8">Enabling the future of innovation</p>
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
          {[
            {
              title: 'Shaping the future of Aviation',
              description: 'From aircraft maintenance to innovative aerospace solutions, we\'re driving the future of flight.',
              image: 'https://images.unsplash.com/photo-1768519648014-077e0635903b?auto=format&fit=crop&w=900&q=80',
            },
            {
              title: 'FUTURE OF THE CITIES',
              description: 'Smart city solutions that transform urban living and create sustainable communities for tomorrow.',
              image: 'https://images.unsplash.com/photo-1644321939012-840bf13ea6d9?auto=format&fit=crop&w=900&q=80',
            },
            {
              title: 'Securing tomorrow, together',
              description: 'Advanced defence and security solutions protecting what matters most in an evolving world.',
              image: 'https://images.unsplash.com/photo-1768224656445-33d078c250b7?auto=format&fit=crop&w=900&q=80',
            },
          ].map((card, index) => (
            <div key={index} className="group relative overflow-hidden">
              <div className="relative h-80 overflow-hidden">
                <img
                  src={card.image}
                  alt={card.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <h3 className="text-xl mb-2 font-light">{card.title}</h3>
                <p className="text-sm text-gray-300 mb-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {card.description}
                </p>
                <div className="flex items-center text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="mr-2">Learn more</span>
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
            Pushing boundaries to deliver game-changing solutions
          </h2>
          <p className="text-lg text-gray-400 leading-relaxed mb-8">
            As a global integrated engineering group, we harness technology and innovation to transform industries
            and improve lives. From aerospace to smart cities, defence to public security, we deliver cutting-edge solutions.
          </p>
          <button className="px-8 py-3 border border-white text-white hover:bg-white hover:text-[#0a0e1a] text-sm tracking-wide">
            Discover our solutions
          </button>
        </div>
      </section>

      {/* Innovation Cards Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl mb-12 font-light text-gray-900 text-center">
            Pioneering the future with AI-powered innovations
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1760629863094-5b1e8d1aae74?auto=format&fit=crop&w=900&q=80"
                alt="Smart City Solutions"
                className="h-80 w-full object-cover"
              />
              <div className="p-8">
                <div className="text-sm text-gray-500 mb-2 uppercase tracking-wide">Smart City Solutions</div>
                <h3 className="text-2xl mb-4 font-light text-gray-900">
                  AI-Driven Urban Infrastructure for Smarter Cities
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Leveraging artificial intelligence to create intelligent urban infrastructure that enhances efficiency,
                  sustainability, and quality of life for city dwellers worldwide.
                </p>
                <button className="text-[#0066cc] text-sm font-medium">Learn more →</button>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow-lg">
              <img
                src="https://images.unsplash.com/photo-1768224656445-33d078c250b7?auto=format&fit=crop&w=900&q=80"
                alt="Cybersecurity Innovation"
                className="h-80 w-full object-cover"
              />
              <div className="p-8">
                <div className="text-sm text-gray-500 mb-2 uppercase tracking-wide">Cybersecurity Innovation</div>
                <h3 className="text-2xl mb-4 font-light text-gray-900">
                  Powering Cybersecurity Operations with AI
                </h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  Advanced AI-powered cybersecurity solutions that protect critical infrastructure and defend against
                  evolving digital threats in real-time.
                </p>
                <button className="text-[#0066cc] text-sm font-medium">Learn more →</button>
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
              Be part of something great
            </h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              Join us at ST Engineering, where innovation meets purpose. We're looking for talented individuals who are
              passionate about making a difference.
            </p>
            <button className="px-6 py-3 bg-[#0066cc] text-white hover:bg-[#0052a3] text-sm">
              View Careers
            </button>
          </div>
        </div>
      </section>

      {/* News Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex items-center justify-between">
            <h2 className="text-3xl md:text-4xl font-light text-gray-900">News and Updates</h2>
            <a href="#" className="text-[#0066cc] text-sm">View all →</a>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'ST Engineering Aerospace to exhibit at Singapore Airshow 2026',
                date: '17 January 2026',
                category: 'Aerospace',
                image: 'https://images.unsplash.com/photo-1764547168182-bdfd5b635e60?auto=format&fit=crop&w=900&q=80',
              },
              {
                title: "ST Engineering's AI-powered solutions win Innovation Award",
                date: '15 January 2026',
                category: 'Innovation',
                image: 'https://images.unsplash.com/photo-1760493828288-d2dbb70d18c9?auto=format&fit=crop&w=900&q=80',
              },
              {
                title: 'New partnership to advance smart city development in Asia',
                date: '12 January 2026',
                category: 'Smart City',
                image: 'https://images.unsplash.com/photo-1760553120312-2821bf54e767?auto=format&fit=crop&w=900&q=80',
              },
            ].map((news, index) => (
              <div key={index} className="bg-white rounded-lg overflow-hidden shadow-md">
                <img
                  src={news.image}
                  alt={news.title}
                  className="h-48 w-full object-cover"
                />
                <div className="p-6">
                  <div className="text-sm text-gray-500 mb-3">{news.date}</div>
                  <h3 className="text-xl mb-2 text-gray-900">{news.title}</h3>
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
