import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { DonationMap } from '../components/DonationMap';
import { FoodImage } from '../components/FoodImage';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

const CATEGORIES = [
  'All',
  'Cooked food',
  'Fruits',
  'Vegetables',
  'Bakery products',
  'Packaged food',
  'Dairy products',
  'Other',
];

export interface DonationListing {
  id: number;
  donorId: number;
  donorName: string;
  donorOrganization: string;
  foodName: string;
  category: string;
  description: string;
  totalQuantity: number;
  remainingQuantity: number;
  quantityUnit: string;
  prepDate: string;
  prepTime: string;
  collectionDeadline: string;
  storageConditions: string;
  dietaryType: string;
  allergenInfo: string;
  city: string;
  pinCode: string;
  pickupAddress: string;
  contactInfo: string;
  pickupInstructions: string;
  latitude: number;
  longitude: number;
  hasExactAccess: boolean;
  status: string;
  statusHistory: Array<{ status: string; timestamp: string; note: string }>;
  images: Array<{ id: number; imageUrl: string; isPrimary: boolean }>;
}

export function FindFoodPage() {
  const { user, refreshNotifications } = useAuth();
  const [searchParams] = useSearchParams();

  const [donations, setDonations] = useState<DonationListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'split' | 'grid' | 'map'>('split');

  const [filters, setFilters] = useState({
    search: '',
    city: '',
    pinCode: '',
    category: 'All',
    minQuantity: '',
    dietaryType: 'All',
    deadlineBefore: '',
  });

  const [selected, setSelected] = useState<DonationListing | null>(null);
  const [claimQty, setClaimQty] = useState('');
  const [needsVolunteer, setNeedsVolunteer] = useState(true);
  const [claimNotes, setClaimNotes] = useState('');
  const [claimMessage, setClaimMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [claiming, setClaiming] = useState(false);

  const [showSafetyReport, setShowSafetyReport] = useState(false);
  const [unsafeReason, setUnsafeReason] = useState('');

  const loadDonations = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (filters.search) qs.set('search', filters.search);
      if (filters.city) qs.set('city', filters.city);
      if (filters.pinCode) qs.set('pinCode', filters.pinCode);
      if (filters.category !== 'All') qs.set('category', filters.category);
      if (filters.minQuantity) qs.set('minQuantity', filters.minQuantity);
      if (filters.dietaryType !== 'All') qs.set('dietaryType', filters.dietaryType);
      if (filters.deadlineBefore) qs.set('deadlineBefore', filters.deadlineBefore);

      const res = await apiFetch<{ donations: DonationListing[] }>(
        `/api/donations?${qs.toString()}`
      );
      setDonations(res.donations);

      const highlightId = Number(searchParams.get('highlight'));
      if (highlightId) {
        const found = res.donations.find((d) => d.id === highlightId);
        if (found) {
          setSelected(found);
          setClaimQty(String(found.remainingQuantity));
        }
      }
    } catch {
      setDonations([]);
    } finally {
      setLoading(false);
    }
  }, [filters, searchParams]);

  useEffect(() => {
    loadDonations();
  }, [loadDonations]);

  const openDonationModal = async (id: number) => {
    setClaimMessage(null);
    setShowSafetyReport(false);
    try {
      const res = await apiFetch<{ donation: DonationListing }>(`/api/donations/${id}`);
      setSelected(res.donation);
      setClaimQty(String(res.donation.remainingQuantity));
    } catch {
      const local = donations.find((d) => d.id === id) || null;
      setSelected(local);
      if (local) setClaimQty(String(local.remainingQuantity));
    }
  };

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setClaiming(true);
    setClaimMessage(null);
    try {
      await apiFetch('/api/claims', {
        method: 'POST',
        body: JSON.stringify({
          donationId: selected.id,
          claimedQuantity: Number(claimQty),
          needsVolunteer,
          notes: claimNotes,
        }),
      });
      setClaimMessage({
        type: 'success',
        text: 'Claim confirmed! Donor notified and pickup scheduled.',
      });
      await refreshNotifications();
      await loadDonations();
      await openDonationModal(selected.id);
    } catch (err: unknown) {
      setClaimMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to claim donation.',
      });
    } finally {
      setClaiming(false);
    }
  };

  const handleReportUnsafe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await apiFetch<{ message: string }>(
        `/api/donations/${selected.id}/report-unsafe`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: unsafeReason }),
        }
      );
      setClaimMessage({ type: 'success', text: res.message });
      setShowSafetyReport(false);
      setUnsafeReason('');
      await loadDonations();
    } catch (err: unknown) {
      setClaimMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to submit safety report.',
      });
    }
  };

  const isApprovedNgo =
    user?.role === 'ngo' && user?.ngoProfile?.verificationStatus === 'approved';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Find Available Food Donations
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Search live surplus food by city, PIN code, category, quantity, and safe collection deadline.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-gray-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'split' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            Split View
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setViewMode('map')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
              viewMode === 'map' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            Map
          </button>
        </div>
      </div>

      {/* Food Safety Notice */}
      <div className="mt-5 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          <strong>Food Safety &amp; Privacy Policy:</strong> FoodShare does not automatically certify food safety. Verified NGOs must inspect storage temperatures and allergens per FSSAI guidelines prior to distribution. Exact pickup addresses and donor contacts remain hidden from public visitors until authorized.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 p-4 rounded-xl border border-gray-200 bg-white space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search food name, description..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg"
            />
          </div>
          <input
            type="text"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            placeholder="City (e.g. Mumbai)"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
          <input
            type="text"
            value={filters.pinCode}
            onChange={(e) => setFilters({ ...filters, pinCode: e.target.value })}
            placeholder="PIN Code"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
          <input
            type="number"
            min="0"
            value={filters.minQuantity}
            onChange={(e) => setFilters({ ...filters, minQuantity: e.target.value })}
            placeholder="Min Qty"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilters({ ...filters, category: cat })}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  filters.category === cat
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filters.dietaryType}
              onChange={(e) => setFilters({ ...filters, dietaryType: e.target.value })}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg bg-white"
            >
              <option value="All">All Dietary</option>
              <option value="veg">Vegetarian</option>
              <option value="vegan">Vegan</option>
              <option value="non-veg">Non-Vegetarian</option>
            </select>
            <input
              type="datetime-local"
              title="Collection deadline before"
              value={filters.deadlineBefore}
              onChange={(e) => setFilters({ ...filters, deadlineBefore: e.target.value })}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Results Area */}
      <div
        className={`mt-6 grid gap-6 ${
          viewMode === 'split' ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'
        }`}
      >
        {viewMode !== 'map' && (
          <div className={viewMode === 'split' ? 'lg:col-span-7' : ''}>
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-64 rounded-xl border border-gray-200 bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : donations.length === 0 ? (
              <div className="p-12 rounded-xl border border-gray-200 bg-gray-50 text-center">
                <p className="text-sm font-medium text-gray-900">No matching surplus food listings</p>
                <p className="mt-1 text-xs text-gray-500">
                  Try clearing your city, PIN code, or category filters to explore other areas.
                </p>
              </div>
            ) : (
              <div
                className={`grid gap-5 ${
                  viewMode === 'split'
                    ? 'grid-cols-1 sm:grid-cols-2'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {donations.map((d) => (
                  <div
                    key={d.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-green-700/60 transition-colors flex flex-col"
                  >
                    <div className="aspect-[4/3] bg-gray-100">
                      <FoodImage src={d.images[0]?.imageUrl} alt={d.foodName} />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>{d.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{d.dietaryType}</span>
                        <span aria-hidden="true">·</span>
                        <span>{d.status}</span>
                      </div>
                      <h3 className="mt-1 font-display text-base font-semibold text-gray-900 line-clamp-1">
                        {d.foodName}
                      </h3>
                      <p className="mt-1 text-xs text-gray-600 line-clamp-2">{d.description}</p>

                      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-green-700" />
                          {d.city} {d.pinCode}
                        </span>
                        <span className="font-mono font-semibold text-green-800 tabular-nums">
                          {d.remainingQuantity} {d.quantityUnit}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          By {new Date(d.collectionDeadline).toLocaleString()}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => openDonationModal(d.id)}
                        className="mt-4 w-full py-2 text-xs font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg transition-colors"
                      >
                        {isApprovedNgo ? 'View & Claim Food' : 'View Details'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewMode !== 'grid' && (
          <div className={viewMode === 'split' ? 'lg:col-span-5' : ''}>
            <div className="sticky top-20">
              <DonationMap
                donations={donations}
                onSelectDonation={openDonationModal}
                heightClass={viewMode === 'map' ? 'h-[580px]' : 'h-[520px]'}
              />
              <p className="mt-2 text-xs text-gray-500">
                Map markers powered by OpenStreetMap. Exact street locations unlock for verified NGOs and assigned volunteers.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Donation Detail & Claim Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">
                  {selected.category} · {selected.dietaryType.toUpperCase()} · {selected.status}
                </p>
                <h2 className="font-display text-lg font-bold text-gray-900">{selected.foodName}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="aspect-[16/9] rounded-xl overflow-hidden bg-gray-100">
                <FoodImage src={selected.images[0]?.imageUrl} alt={selected.foodName} />
              </div>

              <p className="text-sm text-gray-700 leading-relaxed">{selected.description}</p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block">Available Quantity</span>
                  <span className="font-mono font-semibold text-gray-900 tabular-nums">
                    {selected.remainingQuantity} / {selected.totalQuantity} {selected.quantityUnit}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Prepared On</span>
                  <span className="font-semibold text-gray-900">
                    {selected.prepDate} at {selected.prepTime}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Collection Deadline</span>
                  <span className="font-semibold text-amber-700">
                    {new Date(selected.collectionDeadline).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block">Storage Conditions</span>
                  <span className="font-semibold text-gray-900">{selected.storageConditions}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500 block">Allergen Declaration</span>
                  <span className="font-semibold text-gray-900">{selected.allergenInfo}</span>
                </div>
              </div>

              {/* Location & Privacy Section */}
              <div className="p-4 rounded-xl border border-gray-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">
                    Pickup Location ({selected.city} · {selected.pinCode})
                  </span>
                  {selected.hasExactAccess && (
                    <a
                      href={`https://www.openstreetmap.org/directions?to=${selected.latitude},${selected.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-green-700 font-semibold hover:underline"
                    >
                      OpenStreetMap Directions
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
                <p className="text-gray-700">{selected.pickupAddress}</p>
                <p className="text-gray-600">Contact: {selected.contactInfo}</p>
                {selected.pickupInstructions && (
                  <p className="text-gray-500">Instructions: {selected.pickupInstructions}</p>
                )}
              </div>

              {claimMessage && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    claimMessage.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {claimMessage.text}
                </div>
              )}

              {/* Verified NGO Claim Form */}
              {isApprovedNgo && ['Available', 'Partially Claimed'].includes(selected.status) && (
                <form onSubmit={handleClaim} className="p-5 rounded-xl bg-green-50 border border-green-200 space-y-4">
                  <h3 className="font-display text-sm font-bold text-green-900">
                    Claim This Food Donation
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Required Quantity ({selected.quantityUnit})
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="0.5"
                        max={selected.remainingQuantity}
                        required
                        value={claimQty}
                        onChange={(e) => setClaimQty(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                      />
                    </div>
                    <div className="flex items-end pb-2">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={needsVolunteer}
                          onChange={(e) => setNeedsVolunteer(e.target.checked)}
                          className="rounded border-gray-300 text-green-700"
                        />
                        Request Volunteer Pickup Driver
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Pickup Notes for Donor / Volunteer
                    </label>
                    <input
                      type="text"
                      value={claimNotes}
                      onChange={(e) => setClaimNotes(e.target.value)}
                      placeholder="e.g. Bringing insulated crates, arriving within 45 mins"
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={claiming}
                    className="w-full py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg"
                  >
                    {claiming ? 'Submitting Claim...' : 'Confirm Claim & Schedule Pickup'}
                  </button>
                </form>
              )}

              {!user && (
                <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between gap-4 text-xs">
                  <span className="text-gray-600">
                    Verified NGOs can sign in to claim surplus food and unlock exact pickup directions.
                  </span>
                  <Link
                    to="/login"
                    className="px-4 py-2 font-semibold text-white bg-green-700 rounded-lg shrink-0"
                  >
                    NGO Login
                  </Link>
                </div>
              )}

              {user?.role === 'ngo' && !isApprovedNgo && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  Your NGO account is awaiting administrator verification. Once approved, you can claim food here.
                </div>
              )}

              {/* Unsafe Food Reporting */}
              {user && (
                <div className="pt-3 border-t border-gray-200">
                  {!showSafetyReport ? (
                    <button
                      type="button"
                      onClick={() => setShowSafetyReport(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:underline"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Report Unsafe Food or Incorrect Handling
                    </button>
                  ) : (
                    <form onSubmit={handleReportUnsafe} className="space-y-3 p-4 rounded-xl bg-red-50 border border-red-200">
                      <label className="block text-xs font-semibold text-red-900">
                        Describe the food safety concern
                      </label>
                      <textarea
                        required
                        minLength={5}
                        rows={2}
                        value={unsafeReason}
                        onChange={(e) => setUnsafeReason(e.target.value)}
                        placeholder="e.g. Spoiled odor, unrefrigerated dairy, missing packaging..."
                        className="w-full px-3 py-2 text-xs border border-red-300 rounded-lg bg-white"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="px-4 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg"
                        >
                          Submit Safety Alert
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowSafetyReport(false)}
                          className="px-3 py-1.5 text-xs text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Status History */}
              {selected.statusHistory && selected.statusHistory.length > 0 && (
                <div className="pt-3 border-t border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-900 mb-2">Status History</h4>
                  <div className="space-y-2">
                    {selected.statusHistory.map((h, i) => (
                      <div key={i} className="flex items-start justify-between gap-4 text-xs text-gray-600">
                        <span>
                          <strong className="text-gray-900">{h.status}:</strong> {h.note}
                        </span>
                        <span className="font-mono text-[11px] text-gray-400 shrink-0">
                          {new Date(h.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
