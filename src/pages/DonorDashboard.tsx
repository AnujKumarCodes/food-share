import React, { useCallback, useEffect, useState } from 'react';
import { Check, Edit3, Plus, Trash2, Upload, X } from 'lucide-react';
import { FoodImage } from '../components/FoodImage';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface DonorDonation {
  id: number;
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
  dietaryType: 'veg' | 'non-veg' | 'vegan';
  allergenInfo: string;
  pickupAddress: string;
  city: string;
  pinCode: string;
  contactInfo: string;
  pickupInstructions: string;
  status: string;
  images: Array<{ id: number; imageUrl: string }>;
  claims: Array<{
    id: number;
    claimedQuantity: number;
    status: string;
    ngoName: string;
    ngoOrg: string | null;
    ngoPhone: string;
    handoverConfirmedByDonor: boolean;
  }>;
}

interface DonorSummary {
  totalDonations: number;
  activeDonations: number;
  claimedDonations: number;
  completedDonations: number;
  expiredDonations: number;
}

const CATEGORIES = [
  'Cooked food',
  'Fruits',
  'Vegetables',
  'Bakery products',
  'Packaged food',
  'Dairy products',
  'Other',
];

const emptyForm = () => {
  const defaultDeadline = new Date(Date.now() + 6 * 60 * 60 * 1000);
  const localIso = new Date(defaultDeadline.getTime() - defaultDeadline.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return {
    foodName: '',
    category: 'Cooked food',
    description: '',
    totalQuantity: '',
    quantityUnit: 'kg',
    prepDate: new Date().toISOString().slice(0, 10),
    prepTime: '11:00',
    collectionDeadline: localIso,
    storageConditions: 'Hot-held in insulated containers (>60°C)',
    dietaryType: 'veg',
    allergenInfo: 'None declared',
    fssaiSafetyAck: false,
    pickupAddress: '',
    city: '',
    pinCode: '',
    contactInfo: '',
    pickupInstructions: '',
    imageUrl: '',
    publicId: '',
  };
};

export function DonorDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DonorSummary>({
    totalDonations: 0,
    activeDonations: 0,
    claimedDonations: 0,
    completedDonations: 0,
    expiredDonations: 0,
  });
  const [donations, setDonations] = useState<DonorDonation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [uploading, setUploading] = useState(false);
  const [uploadNotice, setUploadNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ summary: DonorSummary; donations: DonorDonation[] }>(
        '/api/donations/mine'
      );
      setSummary(res.summary);
      setDonations(res.donations);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenCreate = () => {
    setEditingId(null);
    const f = emptyForm();
    f.city = user?.donorProfile?.city || '';
    f.pinCode = user?.donorProfile?.pinCode || '';
    f.pickupAddress = user?.donorProfile?.address || '';
    f.contactInfo = `${user?.fullName || ''} · ${user?.phone || user?.email || ''}`;
    setForm(f);
    setError('');
    setUploadNotice('');
    setShowForm(true);
  };

  const handleOpenEdit = (d: DonorDonation) => {
    setEditingId(d.id);
    const dt = new Date(d.collectionDeadline);
    const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setForm({
      foodName: d.foodName,
      category: d.category,
      description: d.description,
      totalQuantity: String(d.totalQuantity),
      quantityUnit: d.quantityUnit,
      prepDate: d.prepDate,
      prepTime: d.prepTime,
      collectionDeadline: localIso,
      storageConditions: d.storageConditions,
      dietaryType: d.dietaryType,
      allergenInfo: d.allergenInfo,
      fssaiSafetyAck: true,
      pickupAddress: d.pickupAddress,
      city: d.city,
      pinCode: d.pinCode,
      contactInfo: d.contactInfo,
      pickupInstructions: d.pickupInstructions,
      imageUrl: d.images[0]?.imageUrl || '',
      publicId: '',
    });
    setError('');
    setShowForm(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadNotice('');
    setError('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const res = await apiFetch<{
        url: string;
        publicId: string;
        provider: string;
        cloudinaryConfigured: boolean;
      }>('/api/upload', {
        method: 'POST',
        body: fd,
      });
      setForm((prev) => ({ ...prev, imageUrl: res.url, publicId: res.publicId }));
      setUploadNotice(
        res.cloudinaryConfigured
          ? 'Uploaded to Cloudinary CDN.'
          : 'Cloudinary keys not configured — saved securely to local server storage.'
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        totalQuantity: Number(form.totalQuantity),
        collectionDeadline: new Date(form.collectionDeadline).toISOString(),
      };
      if (editingId) {
        await apiFetch(`/api/donations/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/donations', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save donation');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/donations/${id}`, { method: 'DELETE' });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Cannot delete donation');
    }
  };

  const handleConfirmHandover = async (id: number) => {
    try {
      await apiFetch(`/api/donations/${id}/handover`, { method: 'POST' });
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm handover');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Donor Dashboard</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            {user?.donorProfile?.organizationName || user?.fullName} · Manage surplus listings and NGO handovers
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg transition-colors self-start"
        >
          <Plus className="w-4 h-4" />
          Add Food Donation
        </button>
      </div>

      {/* Overview KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Total Donations</p>
          <p className="mt-1 font-display text-2xl font-bold text-gray-900 tabular-nums">
            {summary.totalDonations}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Active</p>
          <p className="mt-1 font-display text-2xl font-bold text-green-700 tabular-nums">
            {summary.activeDonations}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Claimed / In Transit</p>
          <p className="mt-1 font-display text-2xl font-bold text-amber-600 tabular-nums">
            {summary.claimedDonations}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Completed</p>
          <p className="mt-1 font-display text-2xl font-bold text-gray-900 tabular-nums">
            {summary.completedDonations}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-gray-200 bg-white">
          <p className="text-xs text-gray-500">Expired</p>
          <p className="mt-1 font-display text-2xl font-bold text-red-600 tabular-nums">
            {summary.expiredDonations}
          </p>
        </div>
      </div>

      {error && !showForm && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
          {error}
        </div>
      )}

      {/* Donations List */}
      {loading ? (
        <div className="h-48 rounded-xl border border-gray-200 bg-gray-100 animate-pulse" />
      ) : donations.length === 0 ? (
        <div className="p-12 rounded-xl border border-gray-200 bg-gray-50 text-center">
          <p className="text-sm font-semibold text-gray-900">No donations listed yet</p>
          <p className="mt-1 text-xs text-gray-600">
            Click "Add Food Donation" to publish your first surplus batch for verified NGOs.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {donations.map((d) => (
            <div
              key={d.id}
              className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col lg:flex-row gap-5"
            >
              <div className="w-full lg:w-44 h-32 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                <FoodImage src={d.images[0]?.imageUrl} alt={d.foodName} />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs text-gray-500">
                      {d.category} · {d.dietaryType.toUpperCase()} · Status:{' '}
                      <span className="font-semibold text-gray-900">{d.status}</span>
                    </p>
                    <h3 className="font-display text-lg font-bold text-gray-900">{d.foodName}</h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {!['Completed', 'Cancelled', 'Delivered'].includes(d.status) && (
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(d)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                <p className="text-xs text-gray-600">{d.description}</p>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600 pt-1">
                  <span className="font-mono tabular-nums">
                    Remaining: <strong>{d.remainingQuantity}</strong> / {d.totalQuantity} {d.quantityUnit}
                  </span>
                  <span>City: {d.city} {d.pinCode}</span>
                  <span>Deadline: {new Date(d.collectionDeadline).toLocaleString()}</span>
                </div>

                {/* Claim Requests */}
                {d.claims && d.claims.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    <p className="text-xs font-semibold text-gray-900">NGO Claim Requests</p>
                    {d.claims.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-green-50 border border-green-200 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-gray-900">
                            {c.ngoOrg || c.ngoName}
                          </span>{' '}
                          claimed{' '}
                          <span className="font-mono font-semibold">
                            {c.claimedQuantity} {d.quantityUnit}
                          </span>{' '}
                          · Status: <span className="capitalize">{c.status.replace('_', ' ')}</span>
                          {c.ngoPhone && <span className="text-gray-600"> · {c.ngoPhone}</span>}
                        </div>
                        {!c.handoverConfirmedByDonor ? (
                          <button
                            type="button"
                            onClick={() => handleConfirmHandover(d.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Confirm Handover
                          </button>
                        ) : (
                          <span className="text-green-800 font-semibold">Handover Confirmed</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Donation Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[92vh] overflow-y-auto border border-gray-200">
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-gray-900">
                {editingId ? 'Edit Food Donation' : 'Create Food Donation'}
              </h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Food Name</label>
                  <input
                    type="text"
                    required
                    value={form.foodName}
                    onChange={(e) => setForm({ ...form, foodName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="e.g. Vegetable Pulao & Dal Meal Trays"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Food Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  required
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  placeholder="Describe preparation, packaging, and serving estimate..."
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    required
                    value={form.totalQuantity}
                    onChange={(e) => setForm({ ...form, totalQuantity: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={form.quantityUnit}
                    onChange={(e) => setForm({ ...form, quantityUnit: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="kg">kg</option>
                    <option value="meals">meals</option>
                    <option value="boxes">boxes</option>
                    <option value="trays">trays</option>
                    <option value="liters">liters</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Dietary Type</label>
                  <select
                    value={form.dietaryType}
                    onChange={(e) => setForm({ ...form, dietaryType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white"
                  >
                    <option value="veg">Vegetarian</option>
                    <option value="vegan">Vegan</option>
                    <option value="non-veg">Non-Vegetarian</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Allergens</label>
                  <input
                    type="text"
                    required
                    value={form.allergenInfo}
                    onChange={(e) => setForm({ ...form, allergenInfo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="Dairy, Nuts, Gluten..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Preparation Date
                  </label>
                  <input
                    type="date"
                    required
                    value={form.prepDate}
                    onChange={(e) => setForm({ ...form, prepDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Preparation Time
                  </label>
                  <input
                    type="time"
                    required
                    value={form.prepTime}
                    onChange={(e) => setForm({ ...form, prepTime: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Safe Collection Deadline
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={form.collectionDeadline}
                    onChange={(e) => setForm({ ...form, collectionDeadline: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Storage Conditions
                </label>
                <input
                  type="text"
                  required
                  value={form.storageConditions}
                  onChange={(e) => setForm({ ...form, storageConditions: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>

              {/* Food Image Upload */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Food Image</label>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                  {form.imageUrl && (
                    <span className="text-xs text-green-700 font-medium truncate max-w-xs">
                      Image attached
                    </span>
                  )}
                </div>
                {uploadNotice && <p className="mt-1 text-[11px] text-gray-500">{uploadNotice}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    required
                    value={form.pinCode}
                    onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Contact Info
                  </label>
                  <input
                    type="text"
                    required
                    value={form.contactInfo}
                    onChange={(e) => setForm({ ...form, contactInfo: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pickup Street Address
                  </label>
                  <input
                    type="text"
                    required
                    value={form.pickupAddress}
                    onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Pickup Instructions
                  </label>
                  <input
                    type="text"
                    value={form.pickupInstructions}
                    onChange={(e) => setForm({ ...form, pickupInstructions: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg"
                    placeholder="Gate, loading dock, ask for..."
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-green-50 border border-green-200 text-xs text-green-900 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={form.fssaiSafetyAck}
                  onChange={(e) => setForm({ ...form, fssaiSafetyAck: e.target.checked })}
                  className="mt-0.5 rounded border-green-400 text-green-700"
                />
                <span>
                  <strong>FSSAI Surplus Food Handling Checklist:</strong> I confirm this food is uncontaminated, stored in clean food-grade containers at safe temperatures, and free from spoilage. FoodShare does not certify food safety.
                </span>
              </label>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg"
                >
                  {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Donation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
