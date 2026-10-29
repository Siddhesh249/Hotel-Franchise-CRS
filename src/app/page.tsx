import Link from 'next/link';
import { Suspense } from 'react';
import { Icon } from '@/components/icons';
import { SearchForm } from '@/components/search-form';
import { HotelCard } from '@/components/hotel-card';
import { featuredHotels, getVirtualToday, listCities, resolveStay } from '@/lib/data';
import { addDaysIso } from '@/lib/format';

export const metadata = {
  title: 'Nightingale CRS · Book a stay across the franchise',
};

async function HeroSearch() {
  const [cities, today] = await Promise.all([listCities(), getVirtualToday()]);
  const checkIn = addDaysIso(today, 1);
  return (
    <SearchForm
      cities={cities}
      defaults={{ checkIn, checkOut: addDaysIso(checkIn, 2), guests: 2 }}
    />
  );
}

async function FeaturedStays() {
  const [hotels, stay] = await Promise.all([featuredHotels(3), resolveStay()]);
  if (!hotels.length) {
    return (
      <div className="card-muted p-8 text-center">
        <p className="font-semibold text-ink-800">No hotels are published yet</p>
        <p className="muted mt-1">An administrator can add the first property from the admin dashboard.</p>
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {hotels.map((hotel) => (
        <HotelCard key={hotel.hotel_id} hotel={hotel} checkIn={stay.checkIn} checkOut={stay.checkOut} guests={2} />
      ))}
    </div>
  );
}

const steps = [
  {
    icon: 'search' as const,
    title: 'Search real availability',
    body: 'Pick a city and dates. Every room type shows the rooms actually left for every night of your stay.',
  },
  {
    icon: 'calendar' as const,
    title: 'Book with a clear outcome',
    body: 'You will always know whether you are confirmed, confirmed against the buffer, or on the FIFO waitlist.',
  },
  {
    icon: 'sparkles' as const,
    title: 'Manage it yourself',
    body: 'Pay, cancel, and watch a waitlisted booking promote automatically when a room frees up.',
  },
];

export default function HomePage() {
  return (
    <main>
      <section className="relative overflow-hidden bg-ink-950 text-white">
        <div className="absolute inset-0 opacity-[0.18] [background-image:radial-gradient(circle_at_15%_20%,#38cba7,transparent_32%),radial-gradient(circle_at_85%_10%,#f5b027,transparent_30%),radial-gradient(circle_at_60%_90%,#0b8f75,transparent_35%)]" />
        <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="container-page relative py-16 sm:py-20 lg:py-24">
          <div className="max-w-3xl">
            <span className="badge border border-white/15 bg-white/10 text-brand-100 backdrop-blur">
              <Icon name="shield" size={12} />
              One franchise · one reservation system
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find a room. Book it honestly.
              <span className="block text-brand-300">Every outcome is visible.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-ink-200 sm:text-lg">
              Search live availability across Nightingale Suites properties, book in a few clicks,
              and see exactly when a stay relies on the overbooking buffer or joins the waitlist.
            </p>
          </div>

          <div className="mt-9 max-w-5xl">
            <Suspense fallback={<div className="skeleton h-[86px] w-full max-w-5xl bg-white/10" />}>
              <HeroSearch />
            </Suspense>
          </div>

          <dl className="mt-10 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/10 pt-6 text-sm">
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-300 uppercase">Properties</dt>
              <dd className="mt-1 text-xl font-semibold text-white">Franchise-wide</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-300 uppercase">Booking outcomes</dt>
              <dd className="mt-1 text-xl font-semibold text-white">3, never hidden</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold tracking-wide text-ink-300 uppercase">Waitlist</dt>
              <dd className="mt-1 text-xl font-semibold text-white">Automatic FIFO</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Featured stays</p>
            <h2 className="section-title mt-2">A room for every kind of trip</h2>
            <p className="muted mt-2 max-w-xl">
              Standard, Deluxe, and Suite categories across Bengaluru and Mumbai — each with live
              availability for your dates.
            </p>
          </div>
          <Link href="/hotels" className="btn-secondary">
            View all hotels
            <Icon name="arrow-right" size={16} />
          </Link>
        </div>
        <div className="mt-8">
          <Suspense fallback={<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-72" />)}</div>}>
            <FeaturedStays />
          </Suspense>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-white">
        <div className="container-page py-16">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title mt-2">No surprises between search and check-in</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <article key={step.title} className="card p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                    <Icon name={step.icon} size={20} />
                  </span>
                  <span className="text-xs font-bold tracking-[0.18em] text-ink-300">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="muted mt-2">{step.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="grid gap-5 lg:grid-cols-3">
          <article className="card flex flex-col p-6">
            <span className="badge-brand w-fit">For guests</span>
            <h3 className="mt-4 text-lg font-semibold">Your bookings, in one place</h3>
            <p className="muted mt-2 flex-1">
              See payment status, cancel an active booking, and follow a waitlisted stay as it is
              promoted to confirmed.
            </p>
            <Link href="/my-bookings" className="btn-secondary mt-5 w-fit">Open my bookings</Link>
          </article>
          <article className="card flex flex-col p-6">
            <span className="badge-amber w-fit">For staff</span>
            <h3 className="mt-4 text-lg font-semibold">Arrivals without guesswork</h3>
            <p className="muted mt-2 flex-1">
              A hotel-scoped desk that lists today&apos;s arrivals and assigns only rooms that are
              physically free for the stay.
            </p>
            <Link href="/staff" className="btn-secondary mt-5 w-fit">Open staff desk</Link>
          </article>
          <article className="card flex flex-col p-6">
            <span className="badge-slate w-fit">For admins</span>
            <h3 className="mt-4 text-lg font-semibold">Run the whole franchise</h3>
            <p className="muted mt-2 flex-1">
              Catalog, overbooking buffers, amenities, reports, the virtual clock, and a synthetic
              traffic simulator — all in one control plane.
            </p>
            <Link href="/admin" className="btn-secondary mt-5 w-fit">Open admin</Link>
          </article>
        </div>
      </section>

      <section className="container-page pb-8">
        <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-center text-white sm:px-12">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,#38cba7,transparent_35%),radial-gradient(circle_at_80%_70%,#f5b027,transparent_30%)]" />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-white">Ready for your next stay?</h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-200">
              Create a free guest account, pick your dates, and book in under a minute.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link href="/register" className="btn-primary bg-brand-500 hover:bg-brand-400">
                Create an account
                <Icon name="arrow-right" size={16} />
              </Link>
              <Link href="/hotels" className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">
                Browse hotels
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
