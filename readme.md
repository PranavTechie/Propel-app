# Propel

### Modern Windows Optimization, Maintenance & Performance Suite

<p align="center">
  <strong>Keep your PC clean. Keep it fast. Keep it under control.</strong>
</p>

<p align="center">
  Propel is a modern Windows desktop application designed to help users
  understand, clean, optimize, and maintain their system from one focused workspace.
</p>

<p align="center">
  <a href="https://cleanmasterpro.in">Website</a>
  ·
  <a href="https://cleanmasterpro.in/pricing">Pricing</a>
  ·
  <a href="https://cleanmasterpro.in/support">Support</a>
</p>

---

## ✦ Overview

**Propel** is a Windows optimization and maintenance application built around one simple idea:

> **Your PC should feel as clean and responsive as the day you started using it.**

Instead of relying on a collection of disconnected utilities, Propel brings system health, cleanup, memory management, performance monitoring, maintenance, privacy controls, and intelligent recommendations into one unified desktop experience.

The application is designed with a modern, focused interface that keeps important system information visible without overwhelming the user.

---

## ✦ What Propel Does

Propel provides a centralized toolkit for everyday Windows maintenance and optimization.

### System Dashboard

Get a real-time overview of your system from one place.

- CPU usage
- Memory usage
- Disk usage
- Network activity
- Running processes
- System uptime
- Overall system health
- Smart system insights
- Quick cleanup actions

---

### System Check

Analyze your PC and identify areas that may require attention.

- System health checks
- Performance indicators
- Resource usage analysis
- Potential optimization opportunities
- Actionable recommendations

---

### Cleaner

Remove unnecessary files and reclaim storage space.

- Temporary files
- Application junk
- Browser cleanup
- System cache
- Unnecessary files
- Deep cleanup workflows

Propel is designed to make cleanup understandable rather than forcing users to navigate complicated system utilities.

---

### Memory

Monitor and manage memory usage.

- Real-time RAM usage
- Memory availability
- Process-level memory visibility
- Memory optimization
- Resource monitoring

---

### Smart Maintenance

Keep routine maintenance organized.

- Automated maintenance
- Scheduled cleanup
- Maintenance recommendations
- System health monitoring
- Background optimization workflows

---

### Performance

Understand how your PC is performing over time.

- CPU monitoring
- Memory monitoring
- Disk activity
- Process information
- Performance insights
- Optimization recommendations

---

### Permissions

Review system and application permissions from a centralized interface.

Propel aims to make privacy and system access easier to understand without exposing users to unnecessary technical complexity.

---

### AI Features

Propel is designed to evolve beyond traditional PC cleaning utilities.

AI-powered functionality can help interpret system information and provide more understandable optimization recommendations.

The goal is not simply to show numbers, but to explain:

**What is happening → Why it matters → What you can do about it.**

---

## ✦ Built for Windows

Propel is built as a native-feeling desktop experience for Windows.

The application focuses on:

- Fast startup
- Responsive navigation
- Lightweight UI
- Real-time system information
- Secure authentication
- Account-based entitlements
- Modern desktop workflows

---

## ✦ Account & Plans

Propel uses account-based access to manage product entitlements.

### Free

A permanent free experience for essential system maintenance and cleanup.

### PRO

Advanced optimization and maintenance capabilities.

New verified accounts receive a:

**7-Day PRO Trial**

The trial is provisioned and controlled server-side.

### MAX

An advanced tier intended for users who want the complete Propel experience and deeper system control.

> Plan availability and feature access are controlled by the Propel account entitlement system.

---

## ✦ Security

Security is a core part of Propel's architecture.

### Authentication

Propel uses **Supabase Auth** for user authentication.

- Email/password authentication
- Email verification
- Secure password recovery
- Session management
- JWT-based authenticated API requests
- Authentication rate limiting
- Cloudflare Turnstile protection
- Account enumeration protection

### Backend Security

Protected backend operations require a verified Supabase access token.

The backend:

- Verifies authenticated users server-side
- Does not trust client-supplied user IDs
- Keeps service-role credentials server-side
- Protects sensitive API routes
- Uses server-controlled entitlements
- Prevents client-side manipulation of subscription state

### Payment Security

Payment-related operations are validated server-side.

- Server-controlled pricing
- Razorpay signature verification
- Webhook signature verification
- Authenticated subscription ownership

### Desktop Authentication

The desktop authentication handoff uses:

- Cryptographically secure random codes
- Single-use authorization codes
- Short expiration windows
- Rate-limited exchange endpoints

Sensitive authentication credentials are never intentionally logged.

---

## ✦ Architecture

Propel is composed of several connected systems.

```text
                         ┌─────────────────────┐
                         │    Propel Website   │
                         │                     │
                         │ Authentication      │
                         │ Account             │
                         │ Plans               │
                         │ Downloads           │
                         └──────────┬──────────┘
                                    │
                                    │ HTTPS / JWT
                                    ▼
                         ┌─────────────────────┐
                         │   Propel Backend    │
                         │                     │
                         │ Authentication      │
                         │ Entitlements        │
                         │ Payments            │
                         │ Desktop Handoff     │
                         └──────────┬──────────┘
                                    │
                       ┌────────────┴────────────┐
                       ▼                         ▼
              ┌─────────────────┐       ┌─────────────────┐
              │     Supabase    │       │    Razorpay     │
              │                 │       │                 │
              │ Auth            │       │ Payments        │
              │ PostgreSQL      │       │ Verification    │
              │ RLS             │       │ Webhooks        │
              └─────────────────┘       └─────────────────┘
                                   
                                    │
                                    ▼
                         ┌─────────────────────┐
                         │   Propel Desktop    │
                         │                     │
                         │ Windows Application │
                         │ System Optimization │
                         │ Maintenance         │
                         └─────────────────────┘
✦ Technology
Desktop
Electron
React
TypeScript
Rust
Windows APIs
Modern desktop UI architecture
Web
React
TypeScript
React Router
Modern responsive UI
Backend
Node.js
Express
Supabase
PostgreSQL
Authentication
Supabase Auth
JWT
Email verification
Cloudflare Turnstile
Payments
Razorpay
Server-side payment verification
Secure webhook verification
✦ Design Philosophy

Propel follows a clean, modern visual language built around clarity rather than visual noise.

Visual direction
Green-first brand identity
Soft warm backgrounds
Clean white surfaces
Subtle borders
Controlled shadows
Clear typography
Focused information hierarchy
Minimal visual noise
Responsive interactions

The interface is designed to feel like a modern software product rather than a traditional Windows utility.

✦ Project Structure
propel-app/
│
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   ├── utils/
│   └── ...
│
├── electron/
│   └── ...
│
├── src-tauri/
│   └── ...
│
├── public/
│   └── ...
│
├── package.json
├── tsconfig.json
├── vite.config.*
├── .gitignore
└── README.md

The exact directory structure may evolve as Propel's architecture develops.

✦ Development
Requirements

Before running Propel locally, make sure you have:

Node.js
npm
Rust toolchain
Windows development environment
Required environment variables
Install
git clone https://github.com/pranavop45/propel-app.git

cd propel-app

npm install
Environment

Create your local environment file using the project's expected variables.

# Example only
# Never commit production secrets.

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

Never commit:

.env
.env.local
.env.production
private keys
service-role keys
API secrets
payment secrets
✦ Development Commands
npm run dev

Build the application:

npm run build

Run type checking:

npm run typecheck

The exact available commands may vary as the project evolves.

✦ Production Principles

Propel follows several principles when new functionality is introduced:

Security first

Authentication, authorization, payment verification, and entitlement decisions must be server-controlled where appropriate.

No client trust

The client should never be treated as the authority for:

User identity
Subscription status
Trial duration
Payment success
Protected resource ownership
Minimal permissions

System-level operations should request only the permissions required to perform their intended task.

Reversible optimization

Where practical, optimization operations should avoid destructive behavior and provide predictable outcomes.

Transparent recommendations

System recommendations should explain what is being changed and why.

✦ Roadmap

Propel is actively evolving.

Potential areas of development include:

 Advanced Windows optimization
 Smarter maintenance automation
 AI-powered system recommendations
 Advanced performance analytics
 Gaming optimization
 Deeper privacy controls
 System health history
 Advanced automation
 Multi-device account management
 Expanded diagnostic tools

Roadmap items are subject to change.

✦ Project Status

Propel is currently under active development.

The product is being developed as a production-oriented Windows optimization platform with an accompanying web account and subscription system.

✦ Links

Website

https://cleanmasterpro.in

GitHub

https://github.com/pranavop45/propel-app

✦ License

This repository is private and proprietary.

The source code, design, branding, assets, and associated intellectual property are owned by the Propel project.

Unauthorized copying, redistribution, resale, or commercial use is not permitted.