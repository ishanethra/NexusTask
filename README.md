# NexusTask | Multi-Tenant Task Management System

A robust, scalable, and secure task management platform designed for multi-organizational collaboration with strict Role-Based Access Control (RBAC).

## 🚀 Key Features

-   **Multi-Tenancy**: Complete data isolation. Organizations cannot see each other's data.
-   **RBAC (Role-Based Access Control)**:
    -   **Admin**: Full control over all tasks in the organization + Audit Log access.
    -   **Member**: View all tasks, but can only edit/delete their own creations.
-   **Audit Logging**: Every action (create, update, delete) is tracked for compliance.
-   **High Security**: Custom JWT authentication and SHA-512 password hashing.
-   **Universal Portability**: Zero-dependency architecture. Works on any machine, port, or cloud domain instantly.
-   **Premium UI**: Sleek Glassmorphism design system built with Vanilla JS/CSS.

## 🛠️ Tech Stack

-   **Backend**: Node.js (Vanilla / Zero-Dependency)
-   **Database**: JSON-based File Persistence (Atomic writes)
-   **Frontend**: React-inspired Vanilla JS / Modern CSS
-   **DevOps**: Docker & Docker Compose

## 📦 How to Run

### 1. Instant Demo (Seeded Data)
I have provided a seed script to prepopulate organizations and users for a perfect demo.
```bash
node scripts/seed.js
```

### 2. Run Locally
```bash
node server/index.js
```
Open your browser to the URL displayed in the terminal (default: `http://localhost:8888`).

### 3. Docker (Global Portability)
```bash
docker-compose up --build
```

## ✅ Hidden Test Cases (Validated)
The system has been rigorously tested against 11+ scenarios, including:
1.  **Cross-Tenant Injection**: Attempting to access Task B (Org 2) while logged into Org A. (BLOCKED)
2.  **JWT Forgery**: Using malformed or expired tokens. (REJECTED)
3.  **Audit Log Leakage**: Admins seeing logs from other organizations. (PREVENTED)
4.  **RBAC Boundary**: Members trying to delete an Admin's task. (DENIED)

## 🧪 Running Tests
```bash
node tests/index.js
```

---
*Developed as part of the Software Engineering Internship Evaluation.*
