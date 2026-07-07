# DarziApp - Project Documentation

**Version:** 1.0.0
**Platform:** React Native (Expo)
**Prepared by:** Development Team
**Date:** May 7, 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture & Data Flow](#4-architecture--data-flow)
5. [Navigation Structure](#5-navigation-structure)
6. [Authentication System](#6-authentication-system)
7. [State Management](#7-state-management)
8. [API Layer](#8-api-layer)
9. [Mock Data System](#9-mock-data-system)
10. [Screens & Features](#10-screens--features)
11. [Reusable Components](#11-reusable-components)
12. [Custom Hooks](#12-custom-hooks)
13. [Theme & Design System](#13-theme--design-system)
14. [API Specification Summary](#14-api-specification-summary)
15. [How to Run the Project](#15-how-to-run-the-project)
16. [Future Scalability](#16-future-scalability)

---

## 1. Project Overview

**DarziApp** is a production-ready mobile application for booking tailors and ordering custom stitching services. Built with React Native and Expo, it allows users to:

- Register and log in securely
- Browse tailoring services (suits, blouses, sherwanis, etc.)
- Book appointments with tailors
- Place and track custom stitching orders
- Chat with tailors
- Manage their profile and body measurements

The app is designed with a **mock data system** that simulates real backend API calls. When the backend is ready, only the service layer needs to be updated - all screens, stores, and components remain unchanged.

---

## 2. Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| React Native | 0.81.5 | Mobile app framework |
| Expo | ~54.0.33 | Development platform |
| Expo Router | ~6.0.23 | File-based navigation |
| TypeScript | ~5.9.2 | Type safety |
| Zustand | ^5.0.13 | Global state management |
| React Native Reanimated | ~4.1.1 | Smooth animations |
| expo-secure-store | ~15.0.8 | Secure token storage |
| @react-native-async-storage | 2.2.0 | Persistent state storage |
| expo-linear-gradient | ~15.0.8 | Gradient UI elements |
| @expo/vector-icons | ^15.0.3 | Icon library (Ionicons) |
| react-native-safe-area-context | ~5.6.0 | Device safe area handling |
| react-native-gesture-handler | ~2.28.0 | Touch gesture support |
| axios | ^1.16.0 | HTTP client (available) |

---

## 3. Project Structure

```
DarziApp/
│
├── app/                          # Expo Router screens (file-based routing)
│   ├── _layout.tsx               # Root layout - Stack navigator
│   ├── index.tsx                 # Entry point - redirects after hydration
│   ├── (auth)/                   # Auth route group
│   │   ├── _layout.tsx           # Auth stack layout
│   │   ├── login.tsx             # Login screen
│   │   ├── signup.tsx            # Signup screen
│   │   ├── forgot-password.tsx   # Forgot password screen
│   │   └── otp-login.tsx         # OTP login screen
│   └── (tabs)/                   # Main app route group (bottom tabs)
│       ├── _layout.tsx           # Custom animated tab bar
│       ├── index.tsx             # Home screen
│       ├── orders.tsx            # Orders screen
│       ├── bookings.tsx          # Bookings screen
│       ├── chat.tsx              # Chat screen
│       └── profile.tsx           # Profile screen
│
├── src/                          # Core application logic
│   ├── types/
│   │   └── index.ts              # All TypeScript interfaces
│   ├── data/                     # Mock data (read-only)
│   │   ├── services.ts           # 8 tailoring services
│   │   ├── tailors.ts            # 5 tailor profiles
│   │   ├── orders.ts             # Sample orders with tracking
│   │   ├── bookings.ts           # Sample bookings
│   │   └── chats.ts              # Conversations & messages
│   ├── services/                 # API abstraction layer
│   │   ├── _mockHelper.ts        # Network simulation helper
│   │   ├── orderService.ts       # Order API functions
│   │   ├── bookingService.ts     # Booking API functions
│   │   ├── searchService.ts      # Search API functions
│   │   ├── profileService.ts     # Profile API functions
│   │   └── chatService.ts        # Chat API functions
│   ├── store/                    # Feature Zustand stores
│   │   ├── useOrderStore.ts      # Orders state
│   │   ├── useBookingStore.ts    # Bookings state
│   │   ├── useSearchStore.ts     # Search state
│   │   └── useChatStore.ts       # Chat state
│   ├── components/               # Reusable UI components
│   │   ├── common/
│   │   │   ├── EmptyState.tsx    # Empty list state
│   │   │   └── ErrorState.tsx    # Error with retry button
│   │   ├── orders/
│   │   │   └── OrderCard.tsx     # Order card with tracking
│   │   ├── bookings/
│   │   │   └── BookingCard.tsx   # Booking card with actions
│   │   └── skeletons/
│   │       ├── SkeletonBox.tsx   # Animated skeleton base
│   │       ├── OrderCardSkeleton.tsx
│   │       └── ServiceCardSkeleton.tsx
│   ├── hooks/
│   │   ├── useDebounce.ts        # Debounce hook (400ms)
│   │   └── usePullToRefresh.ts   # Pull-to-refresh hook
│   └── utils/
│       └── formatters.ts         # Price, date, status formatters
│
├── services/                     # Auth API layer
│   ├── api.ts                    # Fetch wrapper + token management
│   └── authService.ts            # Auth API functions
│
├── store/
│   └── useAuthStore.ts           # Auth Zustand store (persisted)
│
├── components/                   # Legacy/home components
│   └── home/
│       ├── ServiceCard.tsx
│       ├── TailorCard.tsx
│       ├── OfferCard.tsx
│       └── SectionHeader.tsx
│
├── constants/
│   ├── theme.ts                  # Colors, spacing, shadows, radius
│   └── data.ts                   # Legacy data constants
│
├── assets/
│   ├── logo.png                  # App logo
│   └── images/                   # App icons, splash screen
│
└── docs/
    ├── PROJECT_DOCUMENTATION.md  # This file
    └── api-spec/                 # API specification CSV files
        ├── 00_API_Summary.csv
        ├── 01_Authentication.csv
        ├── 02_User_Profile.csv
        ├── 03_Services.csv
        ├── 04_Tailors.csv
        ├── 05_Orders.csv
        ├── 06_Bookings.csv
        ├── 07_Search.csv
        ├── 08_Chat.csv
        ├── 09_Notifications.csv
        └── 10_Response_Format_and_Status_Codes.csv
```

---

## 4. Architecture & Data Flow

The app follows a strict layered architecture. UI components never access data directly.

```
┌─────────────────────────────────────────────┐
│              UI Layer (Screens)              │
│  app/(tabs)/index.tsx, orders.tsx, etc.      │
└──────────────────┬──────────────────────────┘
                   │ reads/dispatches
┌──────────────────▼──────────────────────────┐
│           State Management Layer             │
│  useAuthStore, useOrderStore, useSearchStore │
│  (Zustand - persisted via AsyncStorage)      │
└──────────────────┬──────────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────────┐
│             Service Layer                    │
│  orderService.ts, searchService.ts, etc.     │
│  (Promise-based, simulates network delay)    │
└──────────────────┬──────────────────────────┘
                   │ reads from
┌──────────────────▼──────────────────────────┐
│              Mock Data Layer                 │
│  src/data/services.ts, tailors.ts, etc.      │
│  (TypeScript arrays - replace with API)      │
└─────────────────────────────────────────────┘
```

**Key principle:** When the real backend is ready, only the service layer files change. All stores, screens, and components remain untouched.

---

## 5. Navigation Structure

The app uses **Expo Router** for file-based navigation.

```
app/
├── index.tsx              → Entry: shows spinner → redirects to (tabs)
├── (auth)/
│   ├── login.tsx          → /login or /(auth)/login
│   ├── signup.tsx         → /signup
│   ├── forgot-password.tsx→ /forgot-password
│   └── otp-login.tsx      → /otp-login
└── (tabs)/
    ├── index.tsx          → / (Home tab)
    ├── orders.tsx         → /orders
    ├── bookings.tsx       → /bookings
    ├── chat.tsx           → /chat
    └── profile.tsx        → /profile
```

**Navigation flow:**
1. App opens → `index.tsx` shows spinner
2. Zustand-persist reads AsyncStorage (max 300ms)
3. Redirects to `/(tabs)` (home screen always shown first)
4. Login button in header → navigates to `/(auth)/login`
5. After login/signup → redirects to `/(tabs)`
6. Logout → redirects to `/(auth)/login`

---

## 6. Authentication System

### Token Storage
- **Access Token** → `expo-secure-store` (hardware-backed encryption)
- **Refresh Token** → `expo-secure-store`
- **User data** → Zustand persist → `AsyncStorage`

### Auth Flow

```
Signup/Login
    ↓
POST /auth/signup or /auth/login
    ↓
Backend returns { user, access_token, refresh_token }
    ↓
saveTokens() → expo-secure-store
    ↓
useAuthStore.set({ user, accessToken, refreshToken, isAuthenticated: true })
    ↓
Zustand persist → AsyncStorage (user, tokens saved)
    ↓
Navigate to /(tabs)
```

### Token Refresh (Automatic)
When any API call returns 401:
1. `services/api.ts` intercepts the 401
2. Calls `POST /auth/refresh-token` with the refresh token
3. Saves new access token to SecureStore
4. Retries the original request
5. If refresh fails → clears tokens → user must log in again

### Signup Payload
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "mobile": "9876543210",
  "password": "secret123"
}
```

### Login Payload
```json
{
  "email": "john@example.com",
  "password": "secret123"
}
```

---

## 7. State Management

The app uses **Zustand** for all global state.

### Auth Store (`store/useAuthStore.ts`)

| State | Type | Persisted | Description |
|---|---|---|---|
| `user` | User \| null | ✅ | Logged-in user object |
| `accessToken` | string \| null | ✅ | JWT access token |
| `refreshToken` | string \| null | ✅ | JWT refresh token |
| `isAuthenticated` | boolean | ✅ | Login status |
| `loading` | boolean | ❌ | API call in progress |
| `error` | string \| null | ❌ | Last error message |
| `_hasHydrated` | boolean | ❌ | AsyncStorage read complete |

**Actions:** `register()`, `login()`, `loginWithOtp()`, `verifyOtp()`, `logout()`

### Order Store (`src/store/useOrderStore.ts`)

| State | Description |
|---|---|
| `orders` | Array of Order objects |
| `loading` | Fetch in progress |
| `error` | Error message |
| `lastFetched` | Cache timestamp (5 min TTL) |

**Actions:** `fetchOrders()`, `placeOrder()`, `cancelOrder()` (with optimistic updates)

### Booking Store (`src/store/useBookingStore.ts`)

**Actions:** `fetchBookings()`, `createBooking()`, `cancelBooking()`, `rescheduleBooking()`

### Search Store (`src/store/useSearchStore.ts`)

**Actions:** `search()`, `loadHomeData()`, `clearSearch()`

**Features:** 400ms debounced search, filters services by title/description/category, filters tailors by name/specialty

### Chat Store (`src/store/useChatStore.ts`)

**Actions:** `fetchConversations()`, `fetchMessages()`, `sendMessage()`, `markRead()`

---

## 8. API Layer

### Base Configuration (`services/api.ts`)

```
Base URL: http://192.168.1.17:8000/api/v1
Configured via `src/config/api.ts` (`API_BASE_URL`) and `EXPO_PUBLIC_API_URL` in `.env`
Timeout: 30 seconds
Auth: Bearer token (auto-attached from SecureStore)
```

### Request Function

All API calls go through a central `request<T>(endpoint, options)` function that:
- Attaches `Authorization: Bearer <token>` header automatically
- Handles 401 → silent token refresh → retry
- Normalises all errors to user-friendly messages
- Has 15-second timeout

### Auth Service (`services/authService.ts`)

| Function | Endpoint | Method | Description |
|---|---|---|---|
| `registerRequest()` | `/auth/signup` | POST | Register new user |
| `loginRequest()` | `/auth/login` | POST | Login with email/password |
| `requestOtpRequest()` | `/auth/otp/request` | POST | Send OTP to phone |
| `verifyOtpRequest()` | `/auth/otp/verify` | POST | Verify OTP code |
| `logoutRequest()` | `/auth/logout` | POST | Invalidate refresh token |

---

## 9. Mock Data System

All app data is stored in `src/data/` as TypeScript arrays. Service functions read from these files and simulate network delay using `mockRequest()`.

### Mock Helper (`src/services/_mockHelper.ts`)

```typescript
// Simulates 400-600ms network delay
mockRequest(() => data, { delay: 400 })

// Toggle SIMULATE_ERRORS = true to test error states
```

### Data Files

| File | Contents |
|---|---|
| `services.ts` | 8 tailoring services with prices, icons, categories |
| `tailors.ts` | 5 tailor profiles with ratings, experience, badges |
| `orders.ts` | 3 sample orders with tracking timelines |
| `bookings.ts` | 2 sample bookings |
| `chats.ts` | 2 conversations with messages |

### Replacing Mock Data with Real API

When backend is ready, update each service file:

```typescript
// BEFORE (mock):
export async function getOrders(userId: string): Promise<Order[]> {
  return mockRequest(() => [...ordersState]);
}

// AFTER (real API):
export async function getOrders(userId: string): Promise<Order[]> {
  return request<Order[]>(`/users/${userId}/orders`);
}
```

**Nothing else changes** - stores, screens, and components are untouched.

---

## 10. Screens & Features

### Home Screen (`app/(tabs)/index.tsx`)

**Features:**
- Greeting with time-based message (Good Morning/Afternoon/Evening)
- Login button (top-right) → navigates to login screen
- Avatar button (if logged in) → navigates to profile
- **Live search** with 400ms debounce - filters services and tailors
- "No Results Found" empty state
- Hero banner with gradient and CTA buttons
- Services grid (popular services from mock data)
- Offers carousel (horizontal FlatList)
- Featured Tailors carousel (horizontal FlatList)
- Pull-to-refresh (5-minute cache)
- Skeleton loaders on first load

### Orders Screen (`app/(tabs)/orders.tsx`)

**Features:**
- Skeleton loaders while fetching
- Empty state with "No Orders Yet" message
- Order cards with:
  - Color-coded status badges (Pending/In Progress/Ready/Delivered/Cancelled)
  - Tailor info (avatar + name + specialty)
  - Price + payment status
  - Delivery date
  - Expandable tracking timeline (accordion)
  - Cancel button with confirmation alert
- Pull-to-refresh
- Optimistic cancel (updates UI immediately, rolls back on failure)

### Bookings Screen (`app/(tabs)/bookings.tsx`)

**Features:**
- Skeleton loaders
- Empty state with "No Bookings Yet"
- Booking cards with:
  - Tailor info
  - Service name + price
  - Date and time
  - Status badge
  - Cancel button with confirmation
- Pull-to-refresh

### Chat Screen (`app/(tabs)/chat.tsx`)

**Features:**
- Conversation list with:
  - Tailor avatar + online indicator (green dot)
  - Last message preview
  - Relative timestamp (e.g., "2h ago")
  - Unread count badge
- Empty state
- Pull-to-refresh

### Profile Screen (`app/(tabs)/profile.tsx`)

**Features:**
- Guest state (not logged in) with Login button
- Avatar with camera edit button
- User name and email display
- **Inline edit form** (no new screen):
  - First Name, Last Name, Phone, Address
  - Validation with error messages
  - Save/Cancel buttons
  - Loading state during save
- Personal info display cards
- Menu items: Measurements, Addresses, Notifications, Privacy, Help, Rate App
- Logout with confirmation alert

---

## 11. Reusable Components

### Common Components

| Component | Props | Description |
|---|---|---|
| `EmptyState` | icon, title, subtitle, actionLabel, onAction | Empty list state with optional CTA |
| `ErrorState` | message, onRetry | Error display with retry button |
| `SkeletonBox` | width, height, borderRadius | Animated shimmer placeholder |

### Home Components

| Component | Props | Description |
|---|---|---|
| `ServiceCard` | item, onPress | Animated service card with press scale |
| `TailorCard` | item, onBook | Tailor card with rating and book button |
| `OfferCard` | item | Gradient promotional card |
| `SectionHeader` | title, onSeeAll | Section title with "See all" link |

### Feature Components

| Component | Props | Description |
|---|---|---|
| `OrderCard` | item, index, onCancel | Full order card with tracking timeline |
| `BookingCard` | item, index, onCancel | Booking card with cancel action |
| `OrderCardSkeleton` | - | Loading placeholder for order cards |
| `ServiceCardSkeleton` | - | Loading placeholder for service cards |

---

## 12. Custom Hooks

### `useDebounce<T>(value, delayMs)`

Delays updating a value until the user stops changing it for `delayMs` milliseconds. Used for search to avoid firing API calls on every keystroke.

```typescript
const debouncedQuery = useDebounce(searchQuery, 400);
// Only fires search after user stops typing for 400ms
```

### `usePullToRefresh(onRefresh)`

Manages the `refreshing` state for `RefreshControl`. Automatically sets `refreshing = false` when the async callback completes.

```typescript
const { refreshing, handleRefresh } = usePullToRefresh(async () => {
  await orderStore.fetchOrders(userId, true); // forceRefresh = true
});
```

---

## 13. Theme & Design System

All design tokens are in `constants/theme.ts`.

### Colors

| Token | Value | Usage |
|---|---|---|
| `COLORS.primary` | `#1aa3b0` | Primary teal |
| `COLORS.primaryDark` | `#0c6c75` | Buttons, active states |
| `COLORS.primaryLight` | `#e0f7f8` | Backgrounds, avatars |
| `COLORS.gold` | `#C9A84C` | Badges, ratings |
| `COLORS.black` | `#0D0D0D` | Primary text |
| `COLORS.gray` | `#6B7280` | Secondary text |
| `COLORS.error` | `#B91C1C` | Error states |
| `COLORS.white` | `#FFFFFF` | Card backgrounds |
| `COLORS.offWhite` | `#FAFAFA` | Screen backgrounds |

### Spacing

```
xs: 4px  |  sm: 8px  |  md: 16px  |  lg: 24px  |  xl: 32px  |  xxl: 48px
```

### Border Radius

```
sm: 8  |  md: 12  |  lg: 16  |  xl: 22  |  full: 999
```

### Shadows

```typescript
SHADOW.card   // elevation: 5, subtle shadow
SHADOW.strong // elevation: 10, prominent shadow
```

---

## 14. API Specification Summary

The complete API specification is in `docs/api-spec/` as CSV files (open in Excel).

### Total APIs: 30

| Module | Count | Auth Required |
|---|---|---|
| Authentication | 6 | No |
| User Profile | 4 | Yes |
| Services | 3 | No |
| Tailors | 3 | No |
| Orders | 4 | Yes |
| Bookings | 4 | Yes |
| Search | 1 | No |
| Chat | 4 | Yes |
| Notifications | 2 | Yes |

### Standard Response Format

```json
{
  "success": true,
  "data": { ... },
  "message": "Success",
  "error": null
}
```

### Authentication Header

```
Authorization: Bearer <access_token>
```

---

## 15. How to Run the Project

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo Go app on your phone (or Android/iOS simulator)

### Installation

```bash
# Navigate to project folder
cd DarziApp

# Install dependencies
npm install

# Start the development server
npx expo start
```

### Running on Device

1. Install **Expo Go** from App Store / Play Store
2. Run `npx expo start`
3. Scan the QR code with Expo Go (Android) or Camera app (iOS)

### Running on Simulator

```bash
# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android
```

### Environment Configuration

Set the API base URL in `.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.17:8000
```

`services/api.ts` reads this value and appends `/api/v1` automatically.

---

## 16. Future Scalability

### Adding a New Screen

1. Create `app/(tabs)/new-screen.tsx`
2. Add it to `app/(tabs)/_layout.tsx` tab config
3. Create a Zustand store in `src/store/useNewStore.ts`
4. Create a service in `src/services/newService.ts`
5. Add mock data in `src/data/newData.ts`

### Connecting Real Backend

Only update service files. Example for orders:

```typescript
// src/services/orderService.ts
// Change this:
return mockRequest(() => [...ordersState]);

// To this:
return request<Order[]>(`/users/${userId}/orders`);
```

### Adding Push Notifications

1. Install `expo-notifications`
2. Create `src/services/notificationService.ts`
3. Create `src/store/useNotificationStore.ts`
4. Add notification handling in `app/_layout.tsx`

### Adding Payments

1. Install `expo-stripe` or similar
2. Create `src/services/paymentService.ts`
3. Add payment screens in `app/(tabs)/`
4. Update order flow to include payment step

---

## TypeScript Interfaces Reference

### User
```typescript
interface User {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  mobile?: string;
}
```

### Order
```typescript
interface Order {
  id: string;
  item: string;
  status: "pending" | "in_progress" | "ready" | "delivered" | "cancelled";
  delivery_date: string;
  cloth_type: string;
  tailor: Tailor;
  price: number;
  payment_status: "paid" | "pending" | "failed";
  created_at: string;
  tracking?: OrderTracking[];
}
```

### Booking
```typescript
interface Booking {
  id: string;
  tailor: Tailor;
  service: Service;
  date: string;
  time: string;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  notes?: string;
  created_at: string;
}
```

### Service
```typescript
interface Service {
  id: string;
  title: string;
  description: string;
  price_starting: number;
  duration: string;
  category: "men" | "women" | "kids" | "alteration" | "wedding";
  popular?: boolean;
}
```

---

*This documentation covers the complete DarziApp codebase as of May 7, 2026.*
*For API specification details, refer to the CSV files in `docs/api-spec/`.*
