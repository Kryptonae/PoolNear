# PoolNear

**Pool orders with people nearby.** Don't buy extra just to reach the minimum — pool your demand with people nearby.

PoolNear is a real-time web application that helps nearby users pool small quick-commerce orders so they can collectively reach minimum-order thresholds.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Backend:** Supabase (Auth, PostgreSQL, Storage, RLS)
- **Routing:** React Router v7
- **UI:** Custom component library with glassmorphism, animations, responsive design
- **Geolocation:** Browser Geolocation API + Haversine distance

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repository:

```bash
git clone <repo-url>
cd poolnear
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file from the template:

```bash
cp .env.example .env
```

4. Fill in your Supabase credentials in `.env`:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

5. Run the database schema in your Supabase SQL editor:

   - Open `supabase/schema.sql`
   - Execute it in the Supabase Dashboard → SQL Editor

6. Create a storage bucket:

   - Go to Supabase Dashboard → Storage
   - Create a bucket called `order-proofs` (private)
   - Set up storage policies (see `supabase/schema.sql` bottom for policy docs)

7. Start the development server:

```bash
npm run dev
```

## Features

### Core
- 🔐 **Real Auth** — Email/password signup/signin via Supabase Auth
- 📍 **Geolocation** — Browser-based location with privacy controls
- 🎯 **Smart Matching** — Multi-factor pool matching (platform, distance, amount, timing, capacity)
- 🏊 **Pool Lifecycle** — Full lifecycle from creation to completion
- 💰 **Payment Coordination** — Payment sent/confirmed state machine
- 📦 **Order Proof** — Real file uploads via Supabase Storage
- ✅ **Delivery/Receipt** — Per-member receipt confirmation
- 🔔 **Notifications** — Real-time notification center with unread counts

### Pages
- **Home** — Location, nearby pools, smart match banner
- **Discover** — Full pool discovery with platform/distance/search filters
- **Create** — Pool creation form with platform, amount, time, destination
- **Pool Detail** — Complete lifecycle UI with join, order, pay, deliver, confirm
- **Dashboard** — My requirements, active pools, completed pools
- **Profile** — Trust stats, settings, public profile view
- **Admin** — User stats, pool metrics, report management
- **Notifications** — Notification center with mark-read

### Security
- 🔒 Row Level Security (RLS) on all tables
- 🛡️ SECURITY DEFINER functions with safe `search_path`
- 🚫 Users cannot self-promote to admin
- 🚫 Users cannot modify trust/reputation counters directly
- ⚛️ Atomic database operations for critical state changes

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Layout.tsx       # Responsive layout (mobile + desktop)
│   ├── ProtectedRoute.tsx
│   └── ui.tsx           # Design system components
├── contexts/
│   └── AuthContext.tsx   # Supabase auth state management
├── hooks/
│   └── useGeolocation.ts # Geolocation React hook
├── lib/
│   ├── constants.ts     # App config, platforms, statuses
│   ├── geo.ts           # Geolocation utilities, Haversine
│   └── supabase.ts      # Supabase client instance
├── pages/               # Route pages
│   ├── AdminPage.tsx
│   ├── AuthPage.tsx
│   ├── CreatePoolPage.tsx
│   ├── DashboardPage.tsx
│   ├── DiscoverPage.tsx
│   ├── HomePage.tsx
│   ├── NotificationsPage.tsx
│   ├── PoolDetailPage.tsx
│   └── ProfilePage.tsx
├── services/
│   ├── matching.ts      # Smart pool matching algorithm
│   ├── pools.ts         # All Supabase queries/mutations
│   └── uploads.ts       # Supabase Storage file uploads
├── App.tsx              # Router and providers
├── App.css
├── index.css            # Global styles and design tokens
└── main.tsx             # Entry point
supabase/
└── schema.sql           # Complete database schema with RLS
```

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # TypeScript check + production build
npm run preview  # Preview production build
npm run lint     # Run oxlint
```

## License

Private — not open source.
