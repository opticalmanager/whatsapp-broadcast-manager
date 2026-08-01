# 📱 WhatsApp Broadcast Manager

Production-Grade WhatsApp Marketing & Automated Recall Broadcast Platform for OpticalManager SaaS.

---

## 🚀 Features
- 🔑 **Owner-Only SSO Bridge:** RSA-256 / HMAC JWT Single Sign-On from OpticalManager CRM (`role = OWNER`).
- 📱 **Baileys Multi-Device Socket Engine:** QR Code scanning modal over WebSockets with Redis auth store.
- 📝 **Template Engine & Live Smartphone Preview:** Auto-parses variable tags (`{{customer_name}}`, `{{city}}`, `{{last_prescription_date}}`) with live preview.
- 🖼️ **Cloudflare R2 Storage:** S3-compatible media presigned upload URLs ($0 egress bandwidth fees).
- ⚡ **Anti-Spam Human Engine:** Inter-message random delays ($8\text{--}20\text{s}$), typing presence simulation (`composing`), and business-hours window validation ($09:00\text{ AM} - 08:00\text{ PM}$).
- 🔄 **BullMQ Queue Orchestrator:** Concurrent dispatches with pause, resume, and retry dispatches.

---

## 🛠️ Quick Start (Local Development)

```powershell
# 1. Install dependencies
npm install

# 2. Run Backend API (Port 4000)
cd apps/backend; npm run start:dev

# 3. Run Frontend App (Port 3001)
cd apps/frontend; npm run dev
```
