# 💎 NexusTask | Cinematic Enterprise Task Management 🚀

**NexusTask** is a production-grade, multi-tenant task orchestration platform designed for high-performance organization collaboration. Engineered with a "Persistence-First" philosophy, it features hardened security, sophisticated Role-Based Access Control (RBAC), and a premium glassmorphic aesthetic.

---

## ✨ Core Pillars & Advanced Features

### 🛡️ Multi-Tenancy & Data Persistence
*   **Production PostgreSQL**: Full SQL integration for permanent data storage. Once a user or task is created, it is remembered forever (no more "ephemeral" data on Render).
*   **Smart Fallback**: The system automatically detects your environment. It uses **PostgreSQL** in production (via `DATABASE_URL`) and seamlessly switches to **JSON mode** for local development.
*   **Tenant Isolation**: Strict data separation ensures users only ever interact with their own organization's tasks.

### 🎭 Role-Based Access Control (RBAC)
*   **ADMIN**: High-contrast, styled badges for global oversight. Admins can manage all tasks and access the **Audit Log Dashboard**.
*   **MEMBER**: Fully collaborative. Members can view the team progress but are restricted to modifying only their own tasks.
*   **Task Ownership**: Every task card now explicitly displays **"By: [Creator Email]"**, ensuring total team accountability.

### 🔐 Identity & Session Resilience
*   **Self-Healing UI**: The platform core (app.js) is hardened against script crashes. It defensively binds all event listeners to ensure a smooth, zero-failure experience.
*   **Google OAuth 2.0**: Native support for Google Identity Services (GSI) with automatic domain-based organization onboarding.
*   **Virtual Inbox Simulator**: A professional "Forgot Password" flow with a real-time, 6-digit security key system and a floating notification inbox.

### 📊 Organizational Audit Tracking
*   **Activity Ledger**: Real-time logging of task creation, status pivots, and deletions.
*   **Compliance Oversight**: Admins can audit every action to ensure data integrity across the organization.

---

## 🛠️ The Professional Technology Stack

| Layer | Technology | Highlights |
| :--- | :--- | :--- |
| **Backend** | **Vanilla Node.js** | High-concurrency engine, zero-dependency core architecture. |
| **Frontend** | **Modern JS + Vanilla CSS** | Cinematic glassmorphism, abstract animated backgrounds. |
| **Database** | **PostgreSQL (Prod)** | Permanent relational storage for enterprise reliability. |
| **Security** | **PBKDF2 + JWT** | Military-grade password hashing and stateless token signing. |
| **UX** | **UX Fluidity** | Automatic form clearing on transition; defensive error handling. |

---

## 📦 Getting Started

### 💻 Local Development
```bash
# 1. Install dependencies
npm install

# 2. Start the cinematic server
node server/index.js
```
*Access the platform at: `http://localhost:3035`*

### 🚀 Production Deployment (Render)
NexusTask is optimized for **Render.com**. To enable permanent storage:
1.  Add `DATABASE_URL` as an Environment Variable in your Render Dashboard.
2.  The server will automatically log: `✅ DATABASE MODE: PRODUCTION`.

---

## 📬 Key Demonstration Flow: Password Recovery
To showcase the secure recovery system without needing a real SMTP server:
1.  Go to the **Login** screen -> click **"Forgot Password?"**.
2.  Enter your email. Observe the 📬 **Floating Inbox** (bottom-left) notification.
3.  Open the inbox, copy your **6-digit Security Key**, and use it to reset your password.
4.  Notice how the forms **automatically clear themselves** for the next user!

---

## ✅ Stability & Compliance
*   **Resource Integrity**: Tested against memory leakage and session hijacking.
*   **Visual Excellence**: Zero Layout Shift (ZLS) and modern Google Typography (Inter).
*   **Browser Resilience**: Fully responsive from mobile to ultra-wide displays.

---

*Designed for the next generation of collaborative task management.* 🛰️
