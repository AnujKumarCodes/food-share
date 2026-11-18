import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import { getDashboardPath, useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function Navbar() {
  const { user, notifications, unreadCount, logout, refreshNotifications } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleMarkAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {});
    await refreshNotifications();
  };

  const handleLogout = async () => {
    await logout();
    setMobileOpen(false);
    navigate('/');
  };

  const navLinkClass = (path: string) =>
    `text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
      location.pathname === path
        ? 'text-green-700 underline underline-offset-4 decoration-2'
        : 'text-gray-600 hover:text-gray-900'
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <Link
          to="/"
          className="font-display text-xl font-bold tracking-tight text-green-700 whitespace-nowrap shrink-0"
        >
          FoodShare
        </Link>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link to="/" className={navLinkClass('/')}>
            Home
          </Link>
          <a href="/#how-it-works" className="text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap shrink-0 transition-colors">
            How It Works
          </a>
          <Link to="/find-food" className={navLinkClass('/find-food')}>
            Find Food
          </Link>
          <Link
            to={user?.role === 'donor' ? '/dashboard/donor' : '/register?role=donor'}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap shrink-0 transition-colors"
          >
            Donate Food
          </Link>
          <a href="/#about" className="text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap shrink-0 transition-colors">
            About
          </a>
          <a href="/#contact" className="text-sm font-medium text-gray-600 hover:text-gray-900 whitespace-nowrap shrink-0 transition-colors">
            Contact
          </a>
        </nav>

        {/* Zone 3: Primary Action / User Account */}
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          {!user ? (
            <>
              <Link
                to="/login"
                className="text-sm font-medium text-gray-700 hover:text-green-700 whitespace-nowrap shrink-0 transition-colors"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
              >
                Get Started
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3 relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Notifications"
                className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-50">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-900">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-green-700 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-gray-500 py-4 text-center">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <div key={n.id} className={`py-2.5 ${n.isRead ? 'opacity-70' : ''}`}>
                          <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <Link
                to="/profile"
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                title="Profile settings"
              >
                <UserIcon className="w-5 h-5" />
              </Link>

              <Link
                to={getDashboardPath(user.role)}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg whitespace-nowrap shrink-0 transition-colors"
              >
                Dashboard
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-gray-100 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          className="lg:hidden p-2 rounded-lg text-gray-700 hover:bg-gray-100"
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3">
          <div className="flex flex-col gap-2">
            <Link to="/" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-gray-800">
              Home
            </Link>
            <a href="/#about" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-gray-800">
              About
            </a>
            <a href="/#how-it-works" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-gray-800">
              How It Works
            </a>
            <Link to="/find-food" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-gray-800">
              Find Food
            </Link>
            <Link
              to={user?.role === 'donor' ? '/dashboard/donor' : '/register?role=donor'}
              onClick={() => setMobileOpen(false)}
              className="py-2 text-sm font-medium text-gray-800"
            >
              Donate Food
            </Link>
            <a href="/#contact" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-gray-800">
              Contact
            </a>
            <Link to="/support" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-gray-800">
              CSR & Support
            </Link>
          </div>
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
            {!user ? (
              <>
                <Link
                  to="/login"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-medium text-gray-800 border border-gray-300 rounded-lg"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-semibold text-white bg-green-700 rounded-lg"
                >
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <Link
                  to={getDashboardPath(user.role)}
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-semibold text-white bg-green-700 rounded-lg"
                >
                  Go to {user.role.toUpperCase()} Dashboard
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setMobileOpen(false)}
                  className="w-full py-2.5 text-center text-sm font-medium text-gray-800 border border-gray-300 rounded-lg"
                >
                  Profile ({unreadCount} unread alerts)
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2.5 text-center text-sm font-medium text-red-600 border border-red-200 rounded-lg"
                >
                  Sign Out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
