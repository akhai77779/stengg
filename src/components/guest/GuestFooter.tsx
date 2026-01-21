import { Link } from 'react-router-dom';

export function GuestFooter() {
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
              A global technology, defence and engineering group.
            </p>
          </div>
          <div>
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-4">About</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">Company Overview</a></li>
              <li><a href="#" className="hover:text-white">Leadership</a></li>
              <li><a href="#" className="hover:text-white">Sustainability</a></li>
              <li><a href="#" className="hover:text-white">Careers</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-4">Businesses</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">Aerospace</a></li>
              <li><a href="#" className="hover:text-white">Smart City</a></li>
              <li><a href="#" className="hover:text-white">Defence & Public Security</a></li>
              <li><a href="#" className="hover:text-white">Digital Systems</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm uppercase tracking-wide text-gray-400 mb-4">Contact</h3>
            <ul className="space-y-2 text-sm">
              <li><a href="#" className="hover:text-white">Contact Us</a></li>
              <li><a href="#" className="hover:text-white">Support</a></li>
              <li><a href="#" className="hover:text-white">Newsroom</a></li>
            </ul>
          </div>
        </div>
        <div className="mt-12 border-t border-gray-800/60 pt-6 text-xs text-gray-500 flex flex-col md:flex-row justify-between gap-4">
          <span>© 2026 ST Engineering. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Use</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
