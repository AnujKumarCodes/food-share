import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1 space-y-3">
            <Link to="/" className="font-display text-xl font-bold text-white tracking-tight">
              FoodShare
            </Link>
            <p className="text-sm text-gray-400 leading-relaxed">
              Save Food. Share Hope. Connecting surplus edible food with verified NGOs and volunteers before it goes to waste.
            </p>
            <p className="text-xs text-gray-400">
              100% free for verified NGOs and food donors. Essential donations are never conditional on payment.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/find-food" className="hover:text-white transition-colors">Find Available Food</Link></li>
              <li><Link to="/register?role=donor" className="hover:text-white transition-colors">Donate Surplus Food</Link></li>
              <li><Link to="/register?role=ngo" className="hover:text-white transition-colors">NGO Verification</Link></li>
              <li><Link to="/register?role=volunteer" className="hover:text-white transition-colors">Volunteer Logistics</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Safety & Governance</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/#how-it-works" className="hover:text-white transition-colors">FSSAI Handling Guidelines</a></li>
              <li><a href="/#faq" className="hover:text-white transition-colors">Frequently Asked Questions</a></li>
              <li><Link to="/support" className="hover:text-white transition-colors">CSR & Voluntary Support</Link></li>
              <li><a href="/#contact" className="hover:text-white transition-colors">Contact Operations</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Food Safety Disclaimer</h4>
            <p className="text-xs text-gray-400 leading-relaxed">
              FoodShare coordinates surplus food redistribution and does not independently laboratory-certify listed items. Donors and NGOs must follow applicable FSSAI Surplus Food Distribution standards and verify storage temperatures prior to serving.
            </p>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <span>&copy; {new Date().getFullYear()} FoodShare Redistribution Network. All rights reserved.</span>
          <span>Mumbai · Bengaluru · New Delhi · OpenStreetMap Logistics</span>
        </div>
      </div>
    </footer>
  );
}
