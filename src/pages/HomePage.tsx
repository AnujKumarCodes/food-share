import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  MapPin,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { FoodImage } from '../components/FoodImage';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface PublicStatsResponse {
  stats: {
    totalFoodRescuedKg: number;
    totalDonationsCompleted: number;
    ngoPartnersCount: number;
    volunteersCount: number;
  };
  featuredDonations: Array<{
    id: number;
    foodName: string;
    category: string;
    remainingQuantity: number;
    quantityUnit: string;
    city: string;
    pinCode: string;
    dietaryType: string;
    collectionDeadline: string;
    status: string;
    images: Array<{ id: number; imageUrl: string }>;
  }>;
  partnerNgos: Array<{
    organizationName: string;
    city: string;
    dailyCapacityMeals: number;
  }>;
  testimonials: Array<{
    id: number;
    rating: number;
    comment: string;
    reviewerName: string;
    reviewerRole: string;
  }>;
}

const FAQS = [
  {
    q: 'Is FoodShare free for food donors and NGOs?',
    a: 'Yes. Listing surplus food and claiming verified donations on FoodShare is 100% free. Platform operations are sustained through optional CSR partnerships, logistics sponsorships, and voluntary community contributions.',
  },
  {
    q: 'Who is allowed to claim food donations?',
    a: 'Only NGOs and charitable organizations whose registration details have been reviewed and approved by a FoodShare Administrator can claim donations. This protects food accountability and ensures aid reaches genuine communities.',
  },
  {
    q: 'How does FoodShare handle food safety and expiry?',
    a: 'Every donation requires preparation date, preparation time, storage condition details, allergen declarations, and an FSSAI surplus food handling checklist confirmation. Expired donations are automatically blocked from claiming.',
  },
  {
    q: 'How is donor privacy protected on public listings?',
    a: 'Public visitors only see city, PIN code, food category, and approximate zone on the map. Exact street addresses and contact numbers are disclosed exclusively to verified NGOs and assigned volunteers.',
  },
];

export function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<PublicStatsResponse | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    topic: 'General Inquiry',
    message: '',
  });
  const [contactStatus, setContactStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [contactSubmitting, setContactSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<PublicStatsResponse>('/api/public/stats')
      .then((res) => setData(res))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactSubmitting(true);
    setContactStatus(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      setContactStatus({ type: 'success', text: res.message });
      setContactForm({ name: '', email: '', topic: 'General Inquiry', message: '' });
    } catch (err: unknown) {
      setContactStatus({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send message.',
      });
    } finally {
      setContactSubmitting(false);
    }
  };

  const stats = data?.stats || {
    totalFoodRescuedKg: 0,
    totalDonationsCompleted: 0,
    ngoPartnersCount: 0,
    volunteersCount: 0,
  };

  return (
    <div className="bg-white text-gray-800">
      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-sm font-semibold text-green-700 tracking-wide mb-3">
              Save Food. Share Hope.
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-gray-900 leading-[1.08] text-balance">
              Don't Waste Food. Share It.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-gray-600 leading-relaxed max-w-xl">
              Connect surplus food with people who need it. Together, we can build a world with less food waste.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to={user?.role === 'donor' ? '/dashboard/donor' : '/register?role=donor'}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Donate Food
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/find-food"
                className="inline-flex items-center gap-2 px-6 py-3.5 text-sm font-semibold text-green-800 bg-green-100 hover:bg-green-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Find Food
              </Link>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-gray-500">
              <span>Restaurants, Hotels &amp; Catering</span>
              <span aria-hidden="true">·</span>
              <span>Admin-Verified NGOs</span>
              <span aria-hidden="true">·</span>
              <span>Volunteer Dispatch &amp; FSSAI Checklists</span>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="h-full min-h-[320px] lg:min-h-[440px] rounded-2xl overflow-hidden border border-gray-200 bg-green-50">
              <FoodImage
                src="/src/assets/images/hero_foodshare_community_1795010298305.jpg"
                alt="Volunteers and community coordinators organizing fresh surplus food crates at a FoodShare hub"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Full-width 4-column Database-Driven Impact Statistics */}
        <div className="mt-12 pt-10 border-t border-gray-200 grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-xs font-medium text-gray-500">Total Food Rescued</p>
            <p className="mt-2 font-display text-3xl font-bold text-gray-900 tabular-nums">
              {statsLoading ? '—' : `${stats.totalFoodRescuedKg.toLocaleString()} kg`}
            </p>
            <p className="mt-1 text-xs text-gray-500">Verified completed deliveries</p>
          </div>
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-xs font-medium text-gray-500">Donations Completed</p>
            <p className="mt-2 font-display text-3xl font-bold text-gray-900 tabular-nums">
              {statsLoading ? '—' : stats.totalDonationsCompleted.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-500">Handovers confirmed</p>
          </div>
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-xs font-medium text-gray-500">Verified NGO Partners</p>
            <p className="mt-2 font-display text-3xl font-bold text-green-700 tabular-nums">
              {statsLoading ? '—' : stats.ngoPartnersCount.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-500">Admin-vetted organizations</p>
          </div>
          <div className="p-5 rounded-xl bg-gray-50 border border-gray-200">
            <p className="text-xs font-medium text-gray-500">Active Volunteers</p>
            <p className="mt-2 font-display text-3xl font-bold text-gray-900 tabular-nums">
              {statsLoading ? '—' : stats.volunteersCount.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-gray-500">Last-mile rescue drivers</p>
          </div>
        </div>
      </section>

      {/* 2. How FoodShare Works */}
      <section id="how-it-works" className="bg-gray-50 border-y border-gray-200 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight text-balance">
              How FoodShare Works
            </h2>
            <p className="mt-3 text-base text-gray-600">
              A structured, time-bound redistribution pipeline built for kitchens, verified shelters, and community couriers.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-green-100 text-green-800 flex items-center justify-center mb-4">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-gray-900">
                01. List Surplus Safely
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Restaurants, hotels, grocers, and event hosts log food type, quantity, preparation time, storage condition, allergens, and safe collection deadline.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-green-100 text-green-800 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-gray-900">
                02. Verified NGOs Claim
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Admin-verified NGOs search live inventory by city, PIN code, and OpenStreetMap location, then atomically claim exact quantities without over-claiming.
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl border border-gray-200">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center mb-4">
                <Truck className="w-5 h-5" />
              </div>
              <h3 className="font-display text-lg font-semibold text-gray-900">
                03. Volunteer Rescue &amp; Delivery
              </h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                Nearby volunteers accept pickup assignments, collect sealed containers before the deadline, and upload delivery proof at the shelter doorstep.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Featured Food Donations */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Featured Food Donations
            </h2>
            <p className="mt-2 text-base text-gray-600">
              Live surplus listings currently open for verified NGO pickup.
            </p>
          </div>
          <Link
            to="/find-food"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:text-green-800 whitespace-nowrap shrink-0"
          >
            Browse all donations
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {data?.featuredDonations && data.featuredDonations.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.featuredDonations.map((item) => (
              <Link
                key={item.id}
                to={`/find-food?highlight=${item.id}`}
                className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-green-600/50 transition-colors flex flex-col"
              >
                <div className="aspect-[4/3] bg-gray-100 overflow-hidden">
                  <FoodImage
                    src={item.images[0]?.imageUrl}
                    alt={item.foodName}
                    className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{item.category}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{item.dietaryType}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.status}</span>
                  </div>
                  <h3 className="mt-1.5 font-display text-base font-semibold text-gray-900 line-clamp-1">
                    {item.foodName}
                  </h3>
                  <div className="mt-auto pt-4 flex items-center justify-between text-xs text-gray-600 border-t border-gray-100">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-green-700" />
                      {item.city} {item.pinCode}
                    </span>
                    <span className="font-mono font-semibold text-green-800 tabular-nums">
                      {item.remainingQuantity} {item.quantityUnit}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 p-10 rounded-xl border border-gray-200 bg-gray-50 text-center">
            <p className="text-sm text-gray-600">
              No active surplus donations are currently listed. Donors can publish surplus food in under two minutes.
            </p>
            <Link
              to="/register?role=donor"
              className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-700 rounded-lg"
            >
              List Surplus Food
            </Link>
          </div>
        )}
      </section>

      {/* 4. Why Choose FoodShare & Our Mission */}
      <section id="about" className="bg-green-50/60 border-y border-green-100 py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6">
            <div className="h-full min-h-[300px] rounded-2xl overflow-hidden border border-green-200 bg-white">
              <FoodImage
                src="/src/assets/images/mission_ngo_delivery_1795010299894.jpg"
                alt="Volunteer handing fresh produce and meal boxes to community center coordinator"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-center">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight text-balance">
              Why Choose FoodShare &amp; Our Mission
            </h2>
            <p className="mt-4 text-base text-gray-600 leading-relaxed">
              Every day, tons of nutritious, untouched food from hospitality kitchens and grocers are discarded while neighborhood shelters struggle to meet daily meal demand. FoodShare closes that logistics gap with accountability, speed, and food-safety discipline.
            </p>

            <div className="mt-6 space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Transactional Claim Integrity</p>
                  <p className="text-sm text-gray-600">
                    PostgreSQL row-level locking prevents duplicate NGO claims and quantity over-booking during peak lunch and dinner rescues.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">FSSAI Surplus Compliance &amp; Audit Trails</p>
                  <p className="text-sm text-gray-600">
                    Mandatory preparation timestamps, cold/hot storage specs, allergen notes, and end-to-end delivery photo proof.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">Free Core Platform Forever</p>
                  <p className="text-sm text-gray-600">
                    Essential food donations are never conditional on payment. Supported optionally by CSR partners and voluntary community grants.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. NGO Partners & Donor Testimonials */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-5">
            <h2 className="font-display text-2xl font-bold text-gray-900 tracking-tight">
              Verified NGO Partners
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Registered charitable trusts and shelters approved by FoodShare compliance reviewers.
            </p>
            <div className="mt-6 divide-y divide-gray-200 border border-gray-200 rounded-xl bg-white">
              {data?.partnerNgos && data.partnerNgos.length > 0 ? (
                data.partnerNgos.map((ngo, idx) => (
                  <div key={idx} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{ngo.organizationName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{ngo.city || 'Regional Chapter'}</p>
                    </div>
                    <span className="text-xs font-mono text-green-800 tabular-nums whitespace-nowrap">
                      {ngo.dailyCapacityMeals} meals/day
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-6 text-sm text-gray-500">
                  Approved NGO partners will appear here as verifications are completed.
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-bold text-gray-900 tracking-tight">
              Community Impact Feedback
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Verified feedback from donors and NGO coordinators after completed rescues.
            </p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
              {data?.testimonials && data.testimonials.length > 0 ? (
                data.testimonials.map((rev) => (
                  <div key={rev.id} className="p-6 rounded-xl border border-gray-200 bg-gray-50 flex flex-col justify-between">
                    <p className="text-sm text-gray-700 leading-relaxed">“{rev.comment}”</p>
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-900">{rev.reviewerName}</span>
                      <span className="text-gray-500 uppercase">{rev.reviewerRole} · {rev.rating}/5</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sm:col-span-2 p-6 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-500">
                  Reviews from completed food handovers will appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 6. FAQ */}
      <section id="faq" className="bg-gray-50 border-y border-gray-200 py-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight text-center">
            Frequently Asked Questions
          </h2>
          <div className="mt-8 space-y-3">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={idx} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-gray-900"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 7. CTA & Contact Section */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5 bg-green-700 text-white p-8 rounded-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              Ready to rescue surplus food in your city?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-green-100 leading-relaxed">
              Join restaurants, hotels, verified NGOs, and volunteer drivers working together to eliminate preventable food waste.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="px-5 py-2.5 text-sm font-semibold text-green-900 bg-white hover:bg-green-50 rounded-lg transition-colors whitespace-nowrap"
              >
                Create Free Account
              </Link>
              <Link
                to="/support"
                className="px-5 py-2.5 text-sm font-semibold text-white border border-green-400 hover:bg-green-800 rounded-lg transition-colors whitespace-nowrap"
              >
                CSR &amp; Voluntary Support
              </Link>
            </div>
          </div>

          <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
            <h3 className="font-display text-xl font-bold text-gray-900">Contact FoodShare</h3>
            <p className="mt-1 text-sm text-gray-600">
              Questions about NGO verification, bulk event rescues, or CSR partnerships? Send us a message.
            </p>

            <form onSubmit={handleContactSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                    placeholder="you@organization.org"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Topic</label>
                <select
                  value={contactForm.topic}
                  onChange={(e) => setContactForm({ ...contactForm, topic: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-700"
                >
                  <option value="General Inquiry">General Inquiry</option>
                  <option value="NGO Verification">NGO Verification</option>
                  <option value="Hotel & Event Partnership">Hotel &amp; Event Partnership</option>
                  <option value="CSR & Logistics Grant">CSR &amp; Logistics Grant</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  required
                  rows={3}
                  minLength={10}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-700"
                  placeholder="How can our team help?"
                />
              </div>

              {contactStatus && (
                <div
                  className={`p-3 rounded-lg text-xs font-medium ${
                    contactStatus.type === 'success'
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {contactStatus.text}
                </div>
              )}

              <button
                type="submit"
                disabled={contactSubmitting}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-green-700 hover:bg-green-800 disabled:opacity-50 rounded-lg transition-colors"
              >
                {contactSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
