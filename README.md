# 🏆 AthleteConnect — Backend API
> **"LinkedIn for Sports"** — Empowering Athletes, Coaches, Academies & Sponsors with AI-Driven Matching & Career Opportunities. Built for Smart India Hackathon (SIH).

---

## 🌟 Features Overview

- 🔐 **Authentication & RBAC**: JWT Access & Refresh Token rotation, role-based access control (`athlete`, `organization`, `admin`), bcrypt password hashing.
- 🎯 **AI Matching Engine**: 5-factor weighted algorithm matching athletes to opportunities, trials, jobs, and sponsorships (Sport 25%, Age 20%, Location 20%, Experience 20%, Level 15%).
- 🏅 **Athlete Profile & Achievements**: Dual ID pattern (UUID + MongoDB ObjectId), dynamic sport performance metrics, verifiable certificates.
- 🏢 **Organization & Academy Portal**: Post opportunities, verify athlete achievements, search talent by location, sport, and level.
- 🏋️‍♂️ **Training & Recovery Intelligence**: Log training sessions, wearable data sync simulation, recovery percentage calculation, fatigue alerts.
- 🤖 **AI Assistant & Exercise Analysis**: Multi-agent chatbot, computer vision joint angle form correction with graceful fallback.
- ☁️ **Media Management**: Direct cloud uploads to Cloudinary with local storage fallback.
- 🛡️ **Security & Production Readiness**: Helmet headers, CORS policies, rate limiting, Zod input validation, structured JSON logging, graceful shutdown.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Runtime** | Node.js v20+ (ES Modules) |
| **Framework** | Express.js 4.x |
| **Database** | MongoDB Atlas (Native Driver v6) |
| **Cloud Media** | Cloudinary v2 |
| **Validation** | Zod |
| **Security** | Helmet, CORS, Custom Rate Limiting, Bcrypt |
| **Scheduling** | node-cron (Daily 9 AM deadline alerts) |
| **Caching** | In-Memory Cache with Redis interface fallback |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js >= 20.0.0
- MongoDB Atlas account (or local MongoDB)

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Copy `.env.example` to `.env` and fill in your credentials:
```bash
cp .env.example .env
```

Ensure these key variables are present:
```env
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5500

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.mongodb.net/athleteconnect?retryWrites=true&w=majority
MONGODB_DB_NAME=athleteconnect

# Cloudinary
CLOUDINARY_CLOUD_NAME=cpvmjr50
CLOUDINARY_API_KEY=867279377284455
CLOUDINARY_API_SECRET=your_cloudinary_secret

# Admin Seed
ADMIN_EMAIL=admin@athleteconnect.com
ADMIN_PASSWORD=AdminPass123!
```

### 4. Seed Initial Admin Account
```bash
node scripts/seed-admin.js
```

### 5. Start Server
```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```
The server will run on `http://localhost:3000`.

---

## 🧪 Testing

AthleteConnect comes with 4 automated test suites covering 120+ tests:

```bash
# Run ALL 4 test suites sequentially (Recommended)
npm run test:all

# Or run individually:
npm test              # Unit & imports verification (45 tests)
npm run test:features # Feature schemas & algorithm audit (33 tests)
npm run test:api      # Real HTTP REST API integration tests (43 tests)
npm run test:atlas    # Live MongoDB Atlas end-to-end tests
```

---

## 📡 API Endpoints Summary

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/register/athlete` | Register a new athlete | Public |
| `POST` | `/register/organization` | Register a new organization | Public |
| `POST` | `/login` | Login and obtain JWT pair | Public |
| `POST` | `/refresh` | Refresh access token | Public |
| `POST` | `/logout` | Invalidate refresh token | Authenticated |

### Athlete Profile (`/api/v1/athletes`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/profile` | Get current athlete profile | Athlete |
| `GET` | `/:id` | Get public athlete profile | Authenticated |
| `PATCH` | `/:id` | Update physical stats / bio | Athlete |
| `POST` | `/:id/achievements` | Add achievement with proof | Athlete |
| `POST` | `/stats` | Record sport-specific stats | Athlete |
| `GET` | `/stats` | Query sport-specific metrics | Athlete |

### Opportunities & Matching (`/api/v1/opportunities`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/matched` | Get AI-ranked matched trials & camps | Athlete |
| `POST` | `/` | Post opportunity | Organization |
| `POST` | `/:id/apply` | Apply for opportunity | Athlete |
| `GET` | `/` | Browse opportunities with filters | Authenticated |

### Jobs & Sponsorships
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/api/v1/jobs/matched` | AI-matched sports jobs | Athlete |
| `GET` | `/api/v1/sponsorships/matched` | AI-matched sponsorship deals | Athlete |

### Training & Health (`/api/v1/training`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/` | Log training session | Athlete |
| `GET` | `/` | Get training history | Athlete |
| `GET` | `/dashboard` | Weekly volume & recovery score | Athlete |
| `GET` | `/recovery` | Fatigue analysis & recommendations | Athlete |
| `POST` | `/plan` | Generate AI weekly training plan | Athlete |

### AI Assistant & Exercise Form (`/api/v1`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/ai-assistant/chat` | Sports nutrition/training AI chat | Authenticated |
| `POST` | `/exercise/analyze` | Video/keypoints pose form correction | Authenticated |

### Media Upload (`/api/v1/upload`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `POST` | `/file` | Upload image/certificate/video to Cloudinary | Authenticated |

### Admin & Moderation (`/api/v1/admin`)
| Method | Endpoint | Description | Access |
|---|---|---|---|
| `GET` | `/stats` | High-level platform analytics | Admin |
| `GET` | `/users` | List platform users with filter | Admin |
| `PATCH` | `/users/:id/status` | Suspend / activate account | Admin |
| `PATCH` | `/organizations/:id/verify` | Verify organization legitimacy | Admin |

---

## 🏆 SIH Judges Demo Tips

1. **Health Check**: Open `http://localhost:3000/api/v1/health` in browser to show server status.
2. **Postman Collection**: Import `AthleteConnect.postman_collection.json` into Postman for quick demo calls.
3. **Q&A Guide**: Refer to `SIH-JUDGES-QA-GUIDE.md` for answers to 25+ technical questions on architecture, database choices, scalability, and algorithms.
