# System Integrity & Non-Regression Rules
# OpticalManager Broadcast Engine

These rules MUST be preserved across all future updates, refactors, and feature additions.

---

## 1. Dual-Authentication Non-Regression Rule
- **SSO Authentication**: OpticalManager CRM 1-click SSO (`/api/auth/sso?token=...`) MUST remain 100% supported via `broadcasting_session` cookie.
- **Standalone Authentication**: Independent Email + Password (`/login`, `/signup`) MUST remain supported via JWT `broadcast_auth_token` cookie and localStorage.
- **Unified Decoded Payload**: Both auth methods MUST produce a matching session object (`organizationId`, `sub`/`userId`, `email`, `fullName`, `role`) so downstream API guards and WhatsApp sessions work seamlessly for both.

---

## 2. Database Isolation Guarantee
- **Standalone App Data**: All standalone users, contacts, CSV phonebooks, and audience segments MUST reside in the dedicated Supabase project (`mouybojqnhvhuzcdwxuz` on `aws-0-ap-northeast-1.pooler.supabase.com:6543`).
- **Zero CRM Pollution**: Standalone data must NEVER bloat or interfere with the main OpticalManager CRM database.

---

## 3. Baileys Engine & WhatsApp Session Guarantee
- **Zero Session Loss**: Baileys multi-file/Redis credentials must remain intact across server reloads.
- **Multi-Device Pairing**: 1-click QR modal and reconnection drawer MUST always be accessible from the header status badge.
- **Anti-Ban Throttling**: The randomized 8s–20s delay jitter, human typing indicator emulation, and tiered warm-up dispatch limits MUST NEVER be bypassed or hardcoded to zero.

---

## 4. Real-Time Telemetry & Read Receipts (Blue Ticks)
- **Live Blue Ticks**: WebSocket listeners for `messages.update` and `message-receipt.update` MUST continue streaming read/delivered timestamps in real-time.
- **Zero UI Polling Flicker**: Polling in campaigns list and detail pages MUST perform silent background updates (`fetch(false)`) without resetting `loading: true` or re-rendering entire screen DOM.

---

## 5. Strict Route Architecture
- **Public Routes**: `/` (Landing Page), `/welcome`, `/login`, `/signup`, `/sso`
- **Protected Routes**: `/dashboard`, `/campaigns`, `/contacts`, `/audiences`, `/templates`, `/numbers`, `/analytics`, `/media`, `/settings`
- **Edge Middleware**: Any unauthenticated request to protected routes MUST be strictly redirected to `/login?redirect=...`.
