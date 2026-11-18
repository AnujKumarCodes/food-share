import React, { useState } from 'react';
import { CheckCircle2, HeartHandshake } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [orgName, setOrgName] = useState(
    user?.donorProfile?.organizationName || user?.ngoProfile?.organizationName || ''
  );
  const [city, setCity] = useState(
    user?.donorProfile?.city ||
      user?.ngoProfile?.city ||
      user?.volunteerProfile?.city ||
      ''
  );
  const [pinCode, setPinCode] = useState(
    user?.donorProfile?.pinCode ||
      user?.ngoProfile?.pinCode ||
      user?.volunteerProfile?.pinCode ||
      ''
  );
  const [address, setAddress] = useState(
    user?.donorProfile?.address || user?.ngoProfile?.address || ''
  );
  const [verifyCode, setVerifyCode] = useState('');
  const [previewCode, setPreviewCode] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg('');
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          phone,
          organizationName: orgName,
          city,
          pinCode,
          address,
        }),
      });
      await refreshUser();
      setStatusMsg('Profile updated successfully.');
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to update profile.');
    }
  };

  const handleRequestEmailCode = async () => {
    try {
      const res = await apiFetch<{ message: string; verificationTokenPreview?: string }>(
        '/api/auth/request-email-verification',
        { method: 'POST' }
      );
      if (res.verificationTokenPreview) {
        setPreviewCode(res.verificationTokenPreview);
      }
      setStatusMsg(res.message);
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Failed to send verification code.');
    }
  };

  const handleVerifyEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ token: verifyCode }),
      });
      setStatusMsg(res.message);
      await refreshUser();
    } catch (err: unknown) {
      setStatusMsg(err instanceof Error ? err.message : 'Invalid verification token.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-900">Account &amp; Profile</h1>
        <p className="text-sm text-gray-600 mt-1">
          {user?.email} · Role: <span className="uppercase font-semibold">{user?.role}</span>
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs font-medium text-green-800">
          {statusMsg}
        </div>
      )}

      {!user?.isEmailVerified && (
        <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-amber-900">Verify Your Email Address</p>
              <p className="text-xs text-amber-800">
                Confirm your email to receive pickup alerts and verification notices.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRequestEmailCode}
              className="px-4 py-2 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg"
            >
              Generate Verification Code
            </button>
          </div>
          {previewCode && (
            <p className="text-xs font-mono text-amber-900 break-all">
              SMTP not configured — Code: <strong>{previewCode}</strong>
            </p>
          )}
          <form onSubmit={handleVerifyEmail} className="flex gap-2">
            <input
              type="text"
              required
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="Paste verification code"
              className="flex-1 px-3 py-2 text-xs border border-amber-300 rounded-lg bg-white font-mono"
            />
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-green-700 rounded-lg"
            >
              Verify Email
            </button>
          </form>
        </div>
      )}

      {user?.isEmailVerified && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-2 text-xs font-medium text-green-900">
          <CheckCircle2 className="w-4 h-4 text-green-700" />
          Email verified
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        {(user?.role === 'donor' || user?.role === 'ngo') && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code</label>
            <input
              type="text"
              value={pinCode}
              onChange={(e) => setPinCode(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
        >
          Save Profile Changes
        </button>
      </form>
    </div>
  );
}

export function SupportPage() {
  const [form, setForm] = useState({
    supporterName: '',
    supporterEmail: '',
    organizationName: '',
    amountInr: '1000',
    contributionType: 'voluntary' as 'voluntary' | 'csr_partnership' | 'logistics_grant',
  });
  const [result, setResult] = useState<{
    razorpayConfigured: boolean;
    orderId?: string | null;
    amountInr: number;
  } | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await apiFetch<{
        contribution: { amountInr: number; razorpayOrderId: string | null };
        razorpayConfigured: boolean;
      }>('/api/contributions', {
        method: 'POST',
        body: JSON.stringify({ ...form, amountInr: Number(form.amountInr) }),
      });
      setResult({
        razorpayConfigured: res.razorpayConfigured,
        orderId: res.contribution.razorpayOrderId,
        amountInr: res.contribution.amountInr,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to record contribution');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
      <div className="space-y-3">
        <div className="w-11 h-11 rounded-xl bg-green-100 text-green-800 flex items-center justify-center">
          <HeartHandshake className="w-6 h-6" />
        </div>
        <h1 className="font-display text-3xl font-bold text-gray-900 tracking-tight">
          Optional Voluntary Support &amp; CSR Partnerships
        </h1>
        <p className="text-base text-gray-600 max-w-2xl leading-relaxed">
          FoodShare is 100% free for donors and verified NGOs. Essential food redistribution is never conditional on payment. Voluntary contributions and CSR grants fund refrigerated crates, volunteer fuel stipends, and food-safety training.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
        {result ? (
          <div className="p-5 rounded-xl bg-green-50 border border-green-200 space-y-2 text-sm text-green-900">
            <p className="font-bold">
              Contribution Pledge Recorded (₹{result.amountInr.toLocaleString()})
            </p>
            {result.razorpayConfigured && result.orderId ? (
              <p className="text-xs font-mono">Razorpay Order Created: {result.orderId}</p>
            ) : (
              <p className="text-xs">
                Razorpay API keys (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured in this environment, so your pledge has been logged directly to the FoodShare database without processing a live card charge.
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={form.supporterName}
                  onChange={(e) => setForm({ ...form, supporterName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.supporterEmail}
                  onChange={(e) => setForm({ ...form, supporterEmail: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Contribution Type
                </label>
                <select
                  value={form.contributionType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      contributionType: e.target.value as
                        | 'voluntary'
                        | 'csr_partnership'
                        | 'logistics_grant',
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white"
                >
                  <option value="voluntary">Voluntary Contribution</option>
                  <option value="csr_partnership">Corporate CSR Partnership</option>
                  <option value="logistics_grant">Logistics Sponsorship</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Organization (Optional)
                </label>
                <input
                  type="text"
                  value={form.organizationName}
                  onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Amount (INR)
                </label>
                <input
                  type="number"
                  min="50"
                  required
                  value={form.amountInr}
                  onChange={(e) => setForm({ ...form, amountInr: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-6 py-3 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
            >
              Submit Voluntary Contribution
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
