import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getDashboardPath, useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleRole, setGoogleRole] = useState<'donor' | 'ngo' | 'volunteer'>('donor');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(getDashboardPath(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSubmitting(true);
    try {
      const user = await loginWithGoogle(googleRole);
      navigate(getDashboardPath(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">Sign in to FoodShare</h1>
        <p className="mt-1 text-sm text-gray-600">
          Access your Donor, NGO, Volunteer, or Operations dashboard.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
              placeholder="name@organization.org"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-gray-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-green-700 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg transition-colors"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              First-time Google Sign-In role
            </label>
            <select
              value={googleRole}
              onChange={(e) => setGoogleRole(e.target.value as 'donor' | 'ngo' | 'volunteer')}
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg bg-white"
            >
              <option value="donor">Food Donor</option>
              <option value="ngo">NGO / Charitable Organization</option>
              <option value="volunteer">Distribution Volunteer</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleGoogle}
            disabled={submitting}
            className="w-full py-2.5 text-sm font-medium text-gray-800 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Continue with Google
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="font-semibold text-green-700 hover:underline">
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role');
  const defaultRole: 'donor' | 'ngo' | 'volunteer' =
    initialRole === 'ngo' || initialRole === 'volunteer' ? initialRole : 'donor';

  const [role, setRole] = useState<'donor' | 'ngo' | 'volunteer'>(defaultRole);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    organizationName: '',
    donorType: 'restaurant',
    registrationNumber: '',
    darpanId: '',
    dailyCapacityMeals: '150',
    vehicleType: 'two_wheeler',
    address: '',
    city: '',
    pinCode: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { user } = await register({ ...form, role });
      navigate(getDashboardPath(user.role));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-xl bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">Create a FoodShare Account</h1>
        <p className="mt-1 text-sm text-gray-600">
          Choose your role to start donating surplus food, claiming as a verified NGO, or volunteering for pickups.
        </p>

        {/* Account Type Segmented Selector */}
        <div className="mt-6 grid grid-cols-3 gap-1 p-1 bg-gray-100 rounded-lg">
          {(['donor', 'ngo', 'volunteer'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`py-2 text-xs font-semibold rounded-md transition-colors capitalize ${
                role === r
                  ? 'bg-white text-green-800 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {r === 'ngo' ? 'NGO Partner' : r}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                placeholder="Priya Nair"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                required
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                placeholder="+91 98200 12345"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
              placeholder="contact@organization.org"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                placeholder="Repeat password"
              />
            </div>
          </div>

          {role === 'donor' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Business / Donor Name
                </label>
                <input
                  type="text"
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                  placeholder="GreenLeaf Bistro"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Donor Category</label>
                <select
                  value={form.donorType}
                  onChange={(e) => setForm({ ...form, donorType: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="restaurant">Restaurant</option>
                  <option value="hotel">Hotel</option>
                  <option value="cafe">Cafe</option>
                  <option value="grocery">Grocery Store</option>
                  <option value="event">Event Organizer</option>
                  <option value="individual">Individual Donor</option>
                </select>
              </div>
            </div>
          )}

          {role === 'ngo' && (
            <div className="space-y-4 pt-2 border-t border-gray-100">
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                NGO accounts require administrator verification before claiming food donations.
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    NGO / Trust Name
                  </label>
                  <input
                    type="text"
                    required
                    value={form.organizationName}
                    onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                    placeholder="Asha Annapoorna Trust"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Registration Number
                  </label>
                  <input
                    type="text"
                    required
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                    placeholder="MH/2020/0194821"
                  />
                </div>
              </div>
            </div>
          )}

          {role === 'volunteer' && (
            <div className="pt-2 border-t border-gray-100">
              <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle Type</label>
              <select
                value={form.vehicleType}
                onChange={(e) => setForm({ ...form, vehicleType: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white"
              >
                <option value="two_wheeler">Two-Wheeler / Scooter</option>
                <option value="car">Car / Hatch</option>
                <option value="van">Utility Van</option>
                <option value="cycle">Cargo Bicycle</option>
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input
                type="text"
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                placeholder="Mumbai"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code</label>
              <input
                type="text"
                required
                value={form.pinCode}
                onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                placeholder="400050"
              />
            </div>
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">Street Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                placeholder="Area / Street"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg transition-colors"
          >
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-600">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-green-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ message: string; resetTokenPreview?: string } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ message: string; resetTokenPreview?: string }>(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          body: JSON.stringify({ email }),
        }
      );
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request password reset');
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">Forgot Password</h1>
        <p className="mt-1 text-sm text-gray-600">
          Enter your registered email to receive a password reset token.
        </p>

        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}

        {result ? (
          <div className="mt-6 space-y-4">
            <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-xs text-green-900 space-y-2">
              <p>{result.message}</p>
              {result.resetTokenPreview && (
                <p className="font-mono break-all">
                  SMTP not configured — Reset Token: <strong>{result.resetTokenPreview}</strong>
                </p>
              )}
            </div>
            <Link
              to={`/reset-password${result.resetTokenPreview ? `?token=${result.resetTokenPreview}` : ''}`}
              className="block w-full py-2.5 text-center text-sm font-semibold text-white bg-green-700 rounded-lg"
            >
              Proceed to Reset Password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
              placeholder="name@organization.org"
            />
            <button
              type="submit"
              className="w-full py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
            >
              Request Reset Token
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get('token') || '');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      });
      setMessage(res.message);
      setTimeout(() => navigate('/login'), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8">
        <h1 className="font-display text-2xl font-bold text-gray-900">Reset Password</h1>
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 p-3 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Reset Token</label>
            <input
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
          >
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
