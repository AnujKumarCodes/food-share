import React, { useCallback, useEffect, useState } from 'react';
import { Check, MapPin, PackageCheck, Truck, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface PickupItem {
  id: number;
  donationId: number;
  foodName: string;
  category: string;
  city: string;
  pinCode: string;
  claimedQuantity: number;
  quantityUnit: string;
  pickupAddress: string;
  destinationAddress: string;
  donorContact: string;
  ngoContact: string;
  scheduledTime: string;
  status: string;
  delivery?: {
    id: number;
    receiverName: string;
    deliveryNotes: string;
    proofImageUrl: string | null;
    confirmedAt: string;
  } | null;
}

export function VolunteerDashboard() {
  const { user, refreshUser } = useAuth();
  const [available, setAvailable] = useState<PickupItem[]>([]);
  const [mine, setMine] = useState<PickupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [deliveringId, setDeliveringId] = useState<number | null>(null);
  const [receiverName, setReceiverName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [proofImageUrl, setProofImageUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);

  const loadPickups = useCallback(async () => {
    setLoading(true);
    try {
      const [availRes, mineRes] = await Promise.all([
        apiFetch<{ pickups: PickupItem[] }>('/api/pickups/available'),
        apiFetch<{ pickups: PickupItem[] }>('/api/pickups/mine'),
      ]);
      setAvailable(availRes.pickups);
      setMine(mineRes.pickups);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPickups();
  }, [loadPickups]);

  const handleAvailabilityChange = async (status: string) => {
    try {
      await apiFetch('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ availabilityStatus: status }),
      });
      await refreshUser();
    } catch {
      // Ignore
    }
  };

  const handleAccept = async (pickupId: number) => {
    setError('');
    setMessage('');
    try {
      await apiFetch(`/api/pickups/${pickupId}/accept`, { method: 'POST' });
      setMessage('Pickup assignment accepted! Head to the pickup address before the deadline.');
      await loadPickups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to accept pickup');
    }
  };

  const handleCollect = async (pickupId: number) => {
    setError('');
    try {
      await apiFetch(`/api/pickups/${pickupId}/collect`, { method: 'POST' });
      setMessage('Food collection confirmed.');
      await loadPickups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to confirm collection');
    }
  };

  const handleProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingProof(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch<{ url: string }>('/api/upload', { method: 'POST', body: fd });
      setProofImageUrl(res.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload delivery proof');
    } finally {
      setUploadingProof(false);
    }
  };

  const handleConfirmDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringId) return;
    setError('');
    try {
      await apiFetch(`/api/pickups/${deliveringId}/deliver`, {
        method: 'POST',
        body: JSON.stringify({ receiverName, deliveryNotes, proofImageUrl }),
      });
      setDeliveringId(null);
      setReceiverName('');
      setDeliveryNotes('');
      setProofImageUrl('');
      setMessage('Delivery confirmed and proof recorded!');
      await refreshUser();
      await loadPickups();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to confirm delivery');
    }
  };

  const completedTasks = mine.filter((p) => p.status === 'delivered');
  const activeTasks = mine.filter((p) => p.status !== 'delivered');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Volunteer Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            {user?.fullName} · Vehicle: {user?.volunteerProfile?.vehicleType?.replace('_', ' ') || 'Courier'} ·{' '}
            {user?.volunteerProfile?.city || 'Regional'}
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-gray-100 rounded-lg self-start">
          {['available', 'busy', 'offline'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleAvailabilityChange(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md capitalize transition-colors ${
                (user?.volunteerProfile?.availabilityStatus || 'available') === st
                  ? 'bg-white text-green-800 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Open Pickups Nearby</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600 tabular-nums">
            {available.length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Assigned Active</p>
          <p className="mt-1 font-display text-2xl font-bold text-green-700 tabular-nums">
            {activeTasks.length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Completed Deliveries</p>
          <p className="mt-1 font-display text-2xl font-bold text-gray-900 tabular-nums">
            {completedTasks.length}
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs font-medium text-green-800">
          {message}
        </div>
      )}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Assigned Pickups */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-gray-900">
          Your Assigned Pickups ({activeTasks.length})
        </h2>
        {activeTasks.length === 0 ? (
          <div className="p-8 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600">
            No active assigned pickups. Accept an open pickup task below to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {activeTasks.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-green-800 uppercase">
                    Pickup #{p.id} · {p.status}
                  </span>
                  <span className="font-mono text-xs font-semibold text-gray-700 tabular-nums">
                    {p.claimedQuantity} {p.quantityUnit}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold text-gray-900">{p.foodName}</h3>
                <div className="text-xs text-gray-600 space-y-1.5 bg-gray-50 p-3 rounded-lg">
                  <p>
                    <strong>From (Donor):</strong> {p.pickupAddress}
                  </p>
                  <p>
                    <strong>Donor Contact:</strong> {p.donorContact}
                  </p>
                  <p>
                    <strong>To (NGO):</strong> {p.destinationAddress}
                  </p>
                  <p>
                    <strong>NGO Contact:</strong> {p.ngoContact}
                  </p>
                  <p>
                    <strong>Scheduled By:</strong> {new Date(p.scheduledTime).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {p.status === 'assigned' && (
                    <button
                      type="button"
                      onClick={() => handleCollect(p.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
                    >
                      <PackageCheck className="w-4 h-4" />
                      Confirm Food Collection
                    </button>
                  )}
                  {p.status === 'collected' && (
                    <button
                      type="button"
                      onClick={() => setDeliveringId(p.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
                    >
                      <Check className="w-4 h-4" />
                      Confirm Delivery &amp; Proof
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Available Pickup Tasks */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-bold text-gray-900">
          Available Pickup Tasks ({available.length})
        </h2>
        {loading ? (
          <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
        ) : available.length === 0 ? (
          <div className="p-8 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-600">
            All open pickup requests have been assigned. Check back soon.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {available.map((p) => (
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-green-700" />
                    {p.city} {p.pinCode}
                  </span>
                  <span className="font-mono font-semibold text-gray-900 tabular-nums">
                    {p.claimedQuantity} {p.quantityUnit}
                  </span>
                </div>
                <h3 className="font-display text-base font-bold text-gray-900">{p.foodName}</h3>
                <div className="text-xs text-gray-600 space-y-1">
                  <p>
                    <strong>Pickup:</strong> {p.pickupAddress}
                  </p>
                  <p>
                    <strong>Destination:</strong> {p.destinationAddress}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAccept(p.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
                >
                  <Truck className="w-4 h-4" />
                  Accept Pickup Assignment
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-bold text-gray-900">
            Completed Tasks ({completedTasks.length})
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {completedTasks.map((p) => (
              <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div>
                  <p className="font-semibold text-gray-900">{p.foodName}</p>
                  <p className="text-gray-500">
                    Delivered to {p.delivery?.receiverName || 'NGO Receiver'} · {p.destinationAddress}
                  </p>
                </div>
                <span className="font-mono text-green-800 font-semibold tabular-nums">
                  {p.claimedQuantity} {p.quantityUnit}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Delivery Confirmation Modal */}
      {deliveringId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmDelivery}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200"
          >
            <h3 className="font-display text-lg font-bold text-gray-900">
              Confirm Delivery (#{deliveringId})
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                NGO Receiver Name
              </label>
              <input
                type="text"
                required
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Name of person receiving food"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Delivery Notes
              </label>
              <textarea
                rows={2}
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Condition upon delivery..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Delivery Confirmation Photo
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploadingProof ? 'Uploading...' : proofImageUrl ? 'Proof Uploaded' : 'Upload Proof Photo'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleProofUpload}
                  className="hidden"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeliveringId(null)}
                className="px-4 py-2 text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-green-700 rounded-lg"
              >
                Complete Delivery
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
