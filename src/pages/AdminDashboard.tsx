import { useCallback, useEffect, useState } from 'react';
import { Download, ShieldCheck, ShieldX, UserX } from 'lucide-react';
import { apiFetch } from '../lib/api';

interface AdminOverviewData {
  overview: {
    totalUsers: number;
    totalDonors: number;
    totalNgos: number;
    totalVolunteers: number;
    totalDonations: number;
    activeDonations: number;
    completedDonations: number;
    pendingPickups: number;
    expiredDonations: number;
  };
  users: Array<{
    id: number;
    email: string;
    fullName: string;
    phone: string;
    role: string;
    isVerified: boolean;
    isSuspended: boolean;
    createdAt: string;
    ngoProfile?: {
      organizationName: string;
      registrationNumber: string;
      verificationStatus: string;
      city: string;
    } | null;
    donorProfile?: {
      organizationName: string;
      donorType: string;
      verifiedByAdmin: boolean;
      city: string;
    } | null;
  }>;
  donations: Array<{
    id: number;
    foodName: string;
    category: string;
    totalQuantity: number;
    remainingQuantity: number;
    quantityUnit: string;
    city: string;
    status: string;
    unsafeFlagged: boolean;
    createdAt: string;
  }>;
  pickups: Array<{
    id: number;
    donationId: number;
    volunteerId: number | null;
    status: string;
    pickupAddress: string;
    destinationAddress: string;
  }>;
  complaints: Array<{
    id: number;
    subject: string;
    description: string;
    severity: string;
    status: string;
    adminResolutionNotes: string;
    createdAt: string;
  }>;
  auditLogs: Array<{
    id: number;
    actorId: number | null;
    action: string;
    targetType: string;
    targetId: number | null;
    createdAt: string;
  }>;
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'verifications' | 'users' | 'donations' | 'complaints' | 'audit'>(
    'verifications'
  );
  const [message, setMessage] = useState('');

  const loadAdmin = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<AdminOverviewData>('/api/admin/overview');
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdmin();
  }, [loadAdmin]);

  const handleVerification = async (userId: number, decision: 'approved' | 'rejected') => {
    try {
      await apiFetch(`/api/admin/verifications/${userId}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setMessage(`Account verification ${decision}.`);
      await loadAdmin();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Action failed');
    }
  };

  const handleToggleSuspend = async (userId: number, current: boolean) => {
    try {
      await apiFetch(`/api/admin/users/${userId}/suspend`, {
        method: 'PATCH',
        body: JSON.stringify({ isSuspended: !current }),
      });
      await loadAdmin();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Suspension update failed');
    }
  };

  const handleResolveComplaint = async (id: number) => {
    try {
      await apiFetch(`/api/admin/complaints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'resolved',
          adminResolutionNotes: 'Reviewed and resolved by FoodShare Safety Ops.',
        }),
      });
      await loadAdmin();
    } catch {
      // Ignore
    }
  };

  const handleExportCsv = async () => {
    const csv = await apiFetch<string>('/api/admin/export/donations.csv');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'foodshare-donations-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="h-48 rounded-xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  const ov = data.overview;
  const verificationQueue = data.users.filter((u) => u.role === 'ngo' || u.role === 'donor');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Admin Operations Panel</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Verify NGOs &amp; donors, monitor platform rescues, review safety complaints, and export CSV reports.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg self-start"
        >
          <Download className="w-4 h-4" />
          Export CSV Report
        </button>
      </div>

      {/* 9 Overview KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Users', value: ov.totalUsers },
          { label: 'Donors', value: ov.totalDonors },
          { label: 'NGOs', value: ov.totalNgos },
          { label: 'Volunteers', value: ov.totalVolunteers },
          { label: 'Total Donations', value: ov.totalDonations },
          { label: 'Active Donations', value: ov.activeDonations },
          { label: 'Completed', value: ov.completedDonations },
          { label: 'Pending Pickups', value: ov.pendingPickups },
          { label: 'Expired', value: ov.expiredDonations },
        ].map((kpi) => (
          <div key={kpi.label} className="p-4 rounded-xl border border-gray-200 bg-white">
            <p className="text-xs text-gray-500">{kpi.label}</p>
            <p className="mt-1 font-display text-2xl font-bold text-gray-900 tabular-nums">
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs font-medium text-green-800">
          {message}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {(
          [
            ['verifications', 'Verifications'],
            ['users', 'Users'],
            ['donations', 'Donations & Pickups'],
            ['complaints', `Complaints (${data.complaints.length})`],
            ['audit', 'Audit Logs'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'verifications' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Organization / User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Registration / City</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {verificationQueue.map((u) => {
                const status =
                  u.role === 'ngo'
                    ? u.ngoProfile?.verificationStatus || 'pending'
                    : u.donorProfile?.verifiedByAdmin
                    ? 'approved'
                    : 'pending';
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-gray-900">
                        {u.ngoProfile?.organizationName ||
                          u.donorProfile?.organizationName ||
                          u.fullName}
                      </p>
                      <p className="text-gray-500">{u.email}</p>
                    </td>
                    <td className="py-3 px-4 uppercase font-medium">{u.role}</td>
                    <td className="py-3 px-4 text-gray-600">
                      {u.ngoProfile?.registrationNumber || u.donorProfile?.donorType || '—'} ·{' '}
                      {u.ngoProfile?.city || u.donorProfile?.city || '—'}
                    </td>
                    <td className="py-3 px-4 font-semibold capitalize">{status}</td>
                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleVerification(u.id, 'approved')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => handleVerification(u.id, 'rejected')}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 rounded-lg"
                      >
                        <ShieldX className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-3 px-4 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Role</th>
                <th className="py-3 px-4 font-semibold">Phone</th>
                <th className="py-3 px-4 font-semibold">Account State</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <p className="font-semibold text-gray-900">{u.fullName}</p>
                    <p className="text-gray-500">{u.email}</p>
                  </td>
                  <td className="py-3 px-4 uppercase">{u.role}</td>
                  <td className="py-3 px-4 text-gray-600">{u.phone || '—'}</td>
                  <td className="py-3 px-4">
                    {u.isSuspended ? (
                      <span className="text-red-600 font-semibold">Suspended</span>
                    ) : (
                      <span className="text-green-700 font-semibold">Active</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {u.role !== 'admin' && (
                      <button
                        type="button"
                        onClick={() => handleToggleSuspend(u.id, u.isSuspended)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        {u.isSuspended ? 'Reinstate' : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'donations' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Food Item</th>
                <th className="py-3 px-4 font-semibold">Category</th>
                <th className="py-3 px-4 font-semibold">Quantity</th>
                <th className="py-3 px-4 font-semibold">City</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.donations.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="py-3 px-4 font-semibold text-gray-900">
                    {d.foodName} {d.unsafeFlagged && '(Flagged Unsafe)'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{d.category}</td>
                  <td className="py-3 px-4 font-mono tabular-nums">
                    {d.remainingQuantity}/{d.totalQuantity} {d.quantityUnit}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{d.city}</td>
                  <td className="py-3 px-4 font-semibold">{d.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'complaints' && (
        <div className="space-y-3">
          {data.complaints.length === 0 ? (
            <div className="p-8 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600">
              No safety reports or complaints filed.
            </div>
          ) : (
            data.complaints.map((c) => (
              <div
                key={c.id}
                className="bg-white border border-gray-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase text-amber-700">
                    {c.severity} · {c.status}
                  </p>
                  <p className="text-sm font-bold text-gray-900">{c.subject}</p>
                  <p className="text-xs text-gray-600">{c.description}</p>
                </div>
                {c.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => handleResolveComplaint(c.id)}
                    className="px-4 py-2 text-xs font-semibold text-white bg-green-700 rounded-lg"
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Timestamp</th>
                <th className="py-3 px-4 font-semibold">Action</th>
                <th className="py-3 px-4 font-semibold">Target</th>
                <th className="py-3 px-4 font-semibold">Actor ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="py-2.5 px-4 font-mono text-gray-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-gray-900">{log.action}</td>
                  <td className="py-2.5 px-4 text-gray-600">
                    {log.targetType} #{log.targetId ?? '—'}
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums">{log.actorId ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
