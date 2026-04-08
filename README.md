# NexusTask | Multi-Tenant Platform 🚀

**NexusTask** is a production-grade, multi-tenant task management ecosystem built with a focus on security, data isolation, and granular Role-Based Access Control (RBAC). Designed for high-performance organizational collaboration, it features a native Google OAuth integration and a sophisticated audit logging engine.

---

## ✨ Advanced Features

### 🛡️ Multi-Tenancy & Data Isolation
- **Strict Isolation**: Enforced at the architectural level. Users can never view, update, or delete data belonging to a different organization.
- **Domain-Based Auto-Detection**: Dynamically assigns organizations during OAuth registration.

### 🎭 Role-Based Access Control (RBAC)
- **ADMIN**: Complete organizational oversight. Can manage all tasks and access sensitive audit logs.
- **MEMBER**: Collaborative access. Can view all team tasks but is restricted to managing only their own contributions.
- **Identity Enforcement**: Security checks happen on both the UI and the Backend API for absolute compliance.

### 🔐 Modern Authentication & Identity
- **Google OAuth 2.0 Integration**: Native support via Google Identity Services (GSI) with a secure JWT backend.
- **Password Recovery System**: A professional "Forgot Password" flow with an integrated **Virtual Inbox Simulator** for demonstration purposes.
- **JWT Security**: Custom implementation of RFC 7519 for stateless, secure session management.

### 📊 Organizational Audit Logs
- **Activity Tracking**: Automatic logging of every task creation, status update, and deletion.
- **Compliance Ready**: Admins can audit team activity to ensure accountability.

---

## 🛠️ Technology Stack

- **Backend**: Pure Node.js (High-performance, zero-dependency engine).
- **Authentication**: JWT & PBKDF2 Password Hashing.
- **Frontend**: Premium UI with Glassmorphism, Cinematic Abstract backgrounds, and smooth Micro-animations.
- **Containerization**: Optimized Docker & Docker Compose setup for cloud deployment.

---

## 📦 Getting Started

### 🐳 Run with Docker (Recommended)
This is the fastest path to a production-ready instance:
```bash
docker-compose up --build
```
Access the platform at `http://localhost:3000`.

### 💻 Run Locally
```bash
node server/index.js
```
The server will bind to `0.0.0.0` and automatically attempt to open your default browser.

---

## 📬 Demonstration Notes (Virtual Inbox)
To demonstrate **Password Recovery** without requiring a live SMTP server:
1. Click **"Forgot Password?"** on the login screen.
2. Enter your email and request a key.
3. Click the floating **📬 Demo Inbox** button (bottom-left) to view the incoming virtual mail.
4. Copy the security code and proceed with the reset.

---

## ✅ Compliance & Performance Docs
This platform has been rigorously tested against strict multi-tenant boundary scenarios to prevent resource leakage, privilege escalation, and cross-site request forgery.
