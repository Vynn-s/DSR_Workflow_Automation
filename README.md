<div align="center">

# ⛪ CathedralFlow

**Governance-Centered Workflow Automation for Faith-Based Organizations**

A Transaction Processing System (TPS) designed to digitize and formalize venue and facility request management at San Pedro Cathedral, Davao City — replacing informal, paper-based approval processes with structured, role-based digital workflows and a complete audit trail.

[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white&labelColor=20232A)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white&labelColor=1a1a1a)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white&labelColor=1C1C1C)](https://supabase.com/)
[![AWS Cognito](https://img.shields.io/badge/AWS-Cognito-FF9900?logo=amazonaws&logoColor=white&labelColor=232F3E)](https://aws.amazon.com/cognito/)
[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white)](https://vercel.com/)
[![Backend on Render](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=white&labelColor=1a1a1a)](https://render.com/)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [The Problem](#-the-problem)
- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [User Roles](#-user-roles)
- [AWS Integration](#-aws-integration)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [Research Context](#-research-context)
- [Team](#-team)

---

## 🏛 Overview

CathedralFlow is a full-stack web application developed as a capstone project for the **BS Information Systems** program at **Mapúa Malayan Colleges Mindanao**. The system was built for and piloted at **San Pedro Cathedral** in Davao City, Philippines.

It addresses a common but underresearched problem: faith-based organizations with hierarchical authority structures that still rely on informal, manual processes for administrative coordination. CathedralFlow formalizes venue and facility request management through defined approval workflows, automated conflict detection, and a tamper-evident audit trail.

The project follows a **Design Science Research (DSR)** methodology and was evaluated using ISO/IEC 25010, the System Usability Scale (SUS), the Technology Acceptance Model (TAM), and a Digital Transformation Readiness Assessment with **32 participants**.

> **Research framing:** This system is positioned as a foundational digital transformation mechanism — governance-centered workflow automation as the first step toward institutional digitization in a faith-based organization.

---

## 🚧 The Problem

Before CathedralFlow, venue and facility requests at the parish were handled through:

- Verbal coordination and text messages
- Paper forms with no digital record
- No formal escalation path when an approver was unavailable
- No way to detect scheduling conflicts before they happened
- No audit trail of who approved what, and when

This led to double-bookings, inconsistent policy enforcement, and no institutional memory across personnel transitions.

---

## ✨ Features

### Core Workflow
- **Request submission** — structured form capturing all information approvers need upfront
- **Automatic conflict detection** — rule-based scheduling checks flag overlapping bookings before routing to an approver
- **Approval routing** — requests move through a defined hierarchy: Requester → Parish Secretary → Parish Priest (if escalated)
- **Approval / Rejection with remarks** — approvers document their decision; requesters receive the outcome with context
- **Status tracking** — requesters can monitor their request through every stage without following up manually

### Governance & Accountability
- **Immutable audit trail** — every action (submission, approval, rejection, escalation) is logged with timestamp and user ID
- **Transaction archive** — completed request records are preserved for institutional memory
- **Governance analytics dashboard** — Admin view showing approval rates, conflict frequency, and scheduling utilization

### Access Control
- **Role-based interfaces** — each role sees only the features and data relevant to their function
- **AWS Cognito authentication** — enterprise-grade identity management with JWT-based session handling
- **Group-enforced permissions** — role assignments managed in Cognito User Pool Groups, embedded in JWT claims

---

## 🏗 System Architecture

​```
┌─────────────────────────────────────────────────────────┐
│                    USER MODULES                         │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  │  Requester   │ │   Approver   │ │     Admin      │  │
│  │   Module     │ │   Module     │ │    Module      │  │
│  └──────┬───────┘ └──────┬───────┘ └───────┬────────┘  │
└─────────┼────────────────┼─────────────────┼───────────┘
          │                │                 │
          └────────────────┼─────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   WORKFLOW ENGINE                       │
│  ┌────────────────────────┐ ┌────────────────────────┐  │
│  │   Conflict Detection   │ │   Approval Routing     │  │
│  │        (TPS)           │ │ (Role-based escalation)│  │
│  └────────────────────────┘ └────────────────────────┘  │
└─────────────────┬────────────────────┬──────────────────┘
                  │                    │
           writes │                    │ logs
                  ▼                    ▼
        ┌─────────────────┐  ┌──────────────────┐
        │    Database     │  │   Audit Logs     │
        │  (Supabase PG)  │  │ (Immutable trail)│
        └─────────────────┘  └──────────────────┘
​```

**Authentication** sits upstream of all three modules — AWS Cognito validates identity and injects role information before any module is accessed.

**Request lifecycle:**
​```
Requester → Submit Request → System Validation → Conflict Detection
→ Approver Routing → Approval / Rejection → Notification
→ Audit Trail Generation → Transaction Archive
​```

---

## 🛠 Tech Stack

| Layer | Technology | Platform |
|---|---|---|
| Frontend | React + TypeScript, Tailwind CSS v4, shadcn/ui | Vercel |
| Backend | Node.js + Express (REST API) | Render |
| Database | PostgreSQL (via Supabase) | Supabase |
| Authentication | AWS Cognito (User Pool, JWT, RBAC Groups) | Amazon Web Services |
| ORM | Prisma | — |
| Monitoring | UptimeRobot | — |

---

## 👥 User Roles

CathedralFlow implements three roles that mirror the Cathedral's actual authority hierarchy:

| Role | Description | Key Capabilities |
|---|---|---|
| **Requester** | Ministry leaders and parish volunteers submitting requests | Submit requests, track status, receive notifications |
| **Parish Secretary** | Administrative staff handling day-to-day approvals | Review queue, approve/reject with remarks, escalate to Admin |
| **Parish Priest (Admin)** | Final authority and full system oversight | Final approvals, governance dashboard, user management, analytics |

Role assignment is managed through **AWS Cognito User Pool Groups**. Group membership is embedded in the JWT claims on login and enforced by the backend on every protected route — no role logic is stored solely in the application database.

---

## ☁️ AWS Integration

CathedralFlow integrates two AWS services:

### Amazon Cognito *(Active)*
The primary authentication and identity management layer for the system.

- **User Pool** — stores all user accounts; password policies enforced at the AWS level
- **User Pool Groups** — `cathedralflow-requesters`, `cathedralflow-approvers`, `cathedralflow-admins`
- **JWT tokens** — issued on login, validated by the Express backend via Cognito's public JWKS endpoint
- **Stateless auth** — no server-side session state required; each request carries its own verifiable identity proof

### AWS RDS *(Decommissioned — Snapshot Preserved)*
AWS RDS PostgreSQL was provisioned as the original database during early development. As the project scope stabilized, the team migrated to Supabase for its integrated feature set (realtime, storage, dashboard) and lighter management overhead for a project at this scale.

The **RDS snapshot is preserved**. If CathedralFlow scales to multiple parishes, higher traffic volumes, or stricter data residency requirements, the snapshot provides a clean migration path back to fully managed AWS database infrastructure without data loss.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn
- A Supabase project (PostgreSQL)
- AWS account with a configured Cognito User Pool

### Clone the repository

​```bash
git clone https://github.com/YOUR_USERNAME/cathedralflow.git
cd cathedralflow
​```

### Install dependencies

​```bash
# Frontend
cd client
npm install

# Backend
cd ../server
npm install
​```

### Set up environment variables
See [Environment Variables](#-environment-variables) below.

### Run database migrations

​```bash
cd server
npx prisma migrate dev
​```

### Start development servers

​```bash
# Backend (from /server)
npm run dev

# Frontend (from /client)
npm run dev
​```

The frontend runs on `http://localhost:5173` and the backend on `http://localhost:3000` by default.

---

## 🔐 Environment Variables

### Backend (`/server/.env`)

​```env
# Database
DATABASE_URL=postgresql://...         # Supabase connection string

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_XXXXX
COGNITO_CLIENT_ID=your_app_client_id
COGNITO_REGION=us-east-1
​```

### Frontend (`/client/.env`)

​```env
VITE_API_URL=http://localhost:3000

# AWS Cognito
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXX
VITE_COGNITO_CLIENT_ID=your_app_client_id
VITE_COGNITO_REGION=us-east-1
​```

> ⚠️ Never commit `.env` files. Add them to `.gitignore`.

---

## 📚 Research Context

CathedralFlow was developed as part of a BS Information Systems capstone thesis at Mapúa Malayan Colleges Mindanao, following **Design Science Research (DSR)** methodology.

**Research focus:** How can a traditional faith-based institution initiate digital transformation through governance-centered workflow automation?

**Evaluation instruments used:**
- ISO/IEC 25010 — System quality attributes
- System Usability Scale (SUS) — Usability assessment
- Technology Acceptance Model (TAM) — User acceptance
- Digital Transformation Readiness Assessment — Baseline organizational readiness

**Pilot:** 32 participants from San Pedro Cathedral administrative staff and ministry leaders.

The system is framed as a **Transaction Processing System (TPS)** with embedded decision-support capabilities for conflict detection and approval routing.

---

## 👨‍💻 Team

| Name | Role |
|---|---|
| **Jervin Andoy** | Full-stack Developer, Cloud Integration (AWS) |
| **Nepthali Sollano** | Developer |
| **Francis Elixer Tupaz** | Developer |

**Institution:** Mapúa Malayan Colleges Mindanao — College of Computer and Information Science  
**Pilot site:** San Pedro Cathedral, Davao City, Philippines

---

<div align="center">

*Built as a capstone project — BS Information Systems, Mapúa Malayan Colleges Mindanao*

</div>
