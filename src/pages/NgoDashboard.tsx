import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, Search, ShieldAlert } from 'lucide-react';
import { FoodImage } from '../components/FoodImage';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface NgoClaimItem {
  id: number;
  donationId: number;
  claimedQuantity: number;
  status: string;
  notes: string;
  handoverConfirmedByDonor: boolean;
  createdAt: string;
  donation: {
    id: number;
    donorId: number;
    foodName: string;
    category: string;
    quantityUnit: string;
    pickupAddress: string;
    city: string;
    pinCode: string;
    contactInfo: string;
    collectionDeadline: string;
    latitude: number;
    longitude: number;
    status: string;
    images: Array<{ imageUrl: string }>;
  } | null;
  pickup: {
    id: number;
    status: string;
    scheduledTime: string;
    pickupAddress: string;
    destinationAddress: string;
  } | null;
  delivery: {
    id: number;
    receiverName: string;
    deliveryNotes: string;
    proofImageUrl: string | null;
    confirmedAt: string;
  } | null;
}

export function NgoDashboard() {
  const { user, refreshNotifications } = useAuth();
  const [claims, setClaims] = useState<NgoClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [reviewModal, setReviewModal] = useState<NgoClaimItem | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [message, setMessage] = useState('');

  const loadClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ claims: NgoClaimItem[] }>('/api/claims/mine');
      setClaims(res.claims);
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClaims();
  }, [loadClaims]);

  const handleComplete = async (claimId: number) => {
    try {
      await apiFetch(`/api/claims/${claimId}/complete`, { method: 'POST' });
      setMessage('Donation marked as completed. Thank you for serving your community!');
      await refreshNotifications();
      await loadClaims();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Unable to complete claim');
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModal?.donation) return;
    try {
      await apiFetch('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({
          donationId: reviewModal.donation.id,
          targetUserId: reviewModal.donation.donorId,
          rating,
          comment,
        }),
      });
      setReviewModal(null);
      setComment('');
      setMessage('Thank you! Your feedback has been published.');
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : 'Failed to submit review');
    }
  };

  const verificationStatus = user?.ngoProfile?.verificationStatus || 'pending';
  const activeClaims = claims.filter((c) => c.status !== 'completed' && c.status !== 'cancelled');
  const historyClaims = claims.filter((c) => c.status === 'completed' || c.status === 'cancelled');
  const visibleClaims = tab === 'active' ? activeClaims : historyClaims;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">NGO Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            {user?.ngoProfile?.organizationName || user?.fullName} · Claimed food and pickup tracking
          </p>
        </div>
        <Link
          to="/find-food"
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg self-start"
        >
          <Search className="w-4 h-4" />
          Browse Available Food
        </Link>
      </div>

      {/* Verification Banner */}
      {verificationStatus !== 'approved' ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-sm text-amber-900">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">
              NGO Verification Status: <span className="uppercase">{verificationStatus}</span>
            </p>
            <p className="text-xs mt-1">
              {verificationStatus === 'pending'
                ? 'An administrator is reviewing your registration number before unlocking food claiming privileges.'
                : `Your verification was rejected: ${user?.ngoProfile?.rejectionReason || 'Please update your profile details.'}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 flex items-center gap-3 text-xs font-medium text-green-900">
          <CheckCircle2 className="w-4 h-4 text-green-700 shrink-0" />
          <span>
            Verified NGO Partner · Authorized to claim surplus food and view donor pickup coordinates.
          </span>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Total Claims</p>
          <p className="mt-1 font-display text-2xl font-bold text-gray-900 tabular-nums">{claims.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Active Pickups</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600 tabular-nums">
            {activeClaims.length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Completed Rescues</p>
          <p className="mt-1 font-display text-2xl font-bold text-green-700 tabular-nums">
            {historyClaims.length}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Daily Capacity</p>
          <p className="mt-1 font-display text-2xl font-bold text-gray-900 tabular-nums">
            {user?.ngoProfile?.dailyCapacityMeals || 100} meals
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs font-medium text-green-800">
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="inline-flex items-center p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            tab === 'active' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
          }`}
        >
          Claimed &amp; In Progress ({activeClaims.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors ${
            tab === 'history' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
          }`}
        >
          Completed History ({historyClaims.length})
        </button>
      </div>

      {loading ? (
        <div className="h-44 rounded-xl border border-gray-200 bg-gray-100 animate-pulse" />
      ) : visibleClaims.length === 0 ? (
        <div className="p-10 rounded-xl border border-gray-200 bg-gray-50 text-center text-sm text-gray-600">
          No {tab === 'active' ? 'active claims' : 'completed donations'} yet.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleClaims.map((c) => (
            <div
              key={c.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col lg:flex-row gap-5"
            >
              <div className="w-full lg:w-40 h-28 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                <FoodImage
                  src={c.donation?.images[0]?.imageUrl}
                  alt={c.donation?.foodName || 'Food Donation'}
                />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">
                      Claim #{c.id} · Status:{' '}
                      <span className="font-semibold text-gray-900 capitalize">
                        {c.status.replace('_', ' ')}
                      </span>
                      {c.pickup && (
                        <>
                          {' '}· Pickup:{' '}
                          <span className="font-semibold capitalize">{c.pickup.status}</span>
                        </>
                      )}
                    </p>
                    <h3 className="font-display text-lg font-bold text-gray-900">
                      {c.donation?.foodName || `Donation #${c.donationId}`}
                    </h3>
                  </div>

                  <span className="font-mono text-sm font-bold text-green-800 tabular-nums">
                    {c.claimedQuantity} {c.donation?.quantityUnit || 'kg'}
                  </span>
                </div>

                {c.donation && (
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>
                      <strong>Pickup Address:</strong> {c.donation.pickupAddress}, {c.donation.city}{' '}
                      {c.donation.pinCode}
                    </p>
                    <p>
                      <strong>Donor Contact:</strong> {c.donation.contactInfo}
                    </p>
                    <a
                      href={`https://www.openstreetmap.org/directions?to=${c.donation.latitude},${c.donation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-green-700 font-semibold hover:underline"
                    >
                      Open Pickup Directions
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                {c.delivery && (
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <strong>Delivered to:</strong> {c.delivery.receiverName} ·{' '}
                      {c.delivery.deliveryNotes || 'Confirmed'}
                    </div>
                    {c.delivery.proofImageUrl && (
                      <a
                        href={c.delivery.proofImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-700 font-semibold hover:underline"
                      >
                        View Delivery Proof
                      </a>
                    )}
                  </div>
                )}

                <div className="pt-2 flex flex-wrap items-center gap-3">
                  {c.status !== 'completed' && (
                    <button
                      type="button"
                      onClick={() => handleComplete(c.id)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
                    >
                      Confirm Receipt &amp; Mark Completed
                    </button>
                  )}
                  {c.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => setReviewModal(c)}
                      className="px-4 py-2 text-xs font-semibold text-green-800 bg-green-100 hover:bg-green-200 rounded-lg"
                    >
                      Leave Donor Review
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {reviewModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleReviewSubmit}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-gray-200"
          >
            <h3 className="font-display text-lg font-bold text-gray-900">
              Rate Food Quality &amp; Handover
            </h3>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rating (1-5)</label>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} Stars
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Feedback</label>
              <textarea
                required
                minLength={4}
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share how this donation helped your community..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="px-4 py-2 text-xs text-gray-600"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-green-700 rounded-lg"
              >
                Submit Review
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
