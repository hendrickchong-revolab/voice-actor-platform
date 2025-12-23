VA Contribution Platform: Master Project Plan

Part 1: Product Requirements Document (PRD)

1. Executive Summary

The VA Contribution Platform is a web-based application designed to facilitate the collection of high-quality voice datasets for Voice Acting (VA) jobs. The system manages the distribution of script lines to voice agents, captures audio recordings, and acts as a strict quality control gate using automated signal processing and speech recognition.

Core Philosophy:

Blind Contribution: Agents focus solely on their current active tasks without access to past submissions or other agents' data, ensuring data privacy and focused workflow.

Quality First: The system enforces strict technical (SNR, Clipping) and content (Script Matching) checks.

Decoupled Processing: Heavy audio analysis (MOS, ASR) happens asynchronously to keep the UI snappy.

2. User Roles & Permissions

2.1 Voice Acting Agent (Contributor)

Access: Authenticated access to assigned projects only.

Capabilities:

View performance stats (Merit Score, Acceptance Rate, Earnings).

Accept task batches (Script Locking).

Record audio (Browser-based, One-take constraint).

Client-side Pre-check (Amplitude/Clipping feedback).

Restrictions: NO history view of past jobs. NO peer view (leaderboards).

2.2 Manager (Admin)

Access: Full administrative dashboard.

Capabilities:

Create Projects & Import Scripts (CSV/JSON).

Configure Quality Gates (Target MOS, Max Noise Floor).

Manual Review Interface for "Flagged" recordings.

Monitor Global Stats.

3. Functional Requirements

3.1 Task Distribution (The "Lock" System)

Project Logic: Scripts are grouped into "Projects".

Batch Locking: Agents lock a batch (e.g., 20 lines) to prevent duplicates.

Expiration: If a session is abandoned, scripts release back to the pool.

3.2 Audio Capture & Pre-Check

Latency Check: Verify network before session start.

Client-Side Check: Block submission if:

Amplitude: Too low (Silence).

Clipping: Too high (Distortion).

3.3 Automated Quality Scoring (Server-Side)

The "Scoring Worker" evaluates recordings on two axes:

Technical Quality: Noise Floor (SNR) and Naturalness (MOS via NISQA).

Content Accuracy: Transcription (ASR) vs. Script Text = Word Error Rate (WER).

Part 2: Technical Design & Stack

To support "Solo-Development" while meeting the "Decoupled Architecture" requirement, we will use Next.js for the core app and a separate Python worker for the heavy lifting (ASR/NISQA).

1. The Stack

Layer

Technology

Why?

Core App

Next.js (App Router)

Handles UI, Auth, and API logic in one place.

Language

TypeScript

Type safety for the complex state management.

Database

PostgreSQL

Relational data for Users, Scripts, and Recordings.

ORM

Prisma

Easy database management.

Auth

NextAuth.js (v5)

Secure role-based login (Agent vs Manager).

Storage

AWS S3 / Supabase Storage

Cheap, scalable storage for .wav files.

Queue

Redis (via BullMQ)

Essential. Buffers uploads so the Python worker can process them one by one without crashing the server.

Worker

Python (FastAPI or Script)

Runs NISQA and Whisper (ASR). Python is mandatory for these ML libraries.

2. Architecture & Data Flow

graph TD
    User[Agent] -->|1. Record & Pre-Check| NextJS[Next.js Frontend]
    NextJS -->|2. Upload .wav| S3[Object Storage]
    NextJS -->|3. Create Job| Redis[Redis Queue]
    
    subgraph "Async Processing"
        Redis -->|4. Pull Job| PyWorker[Python Worker]
        PyWorker -->|5. Download .wav| S3
        PyWorker -->|6. Run Analysis (SNR/MOS/WER)| ML[ML Models]
        ML --> PyWorker
        PyWorker -->|7. Update Score| DB[(PostgreSQL)]
    end
    
    DB -->|8. Status Update| NextJS


3. Development Rules

Browser Audio is Tricky: Use a reliable hook (like react-media-recorder or native MediaRecorder API) and ensure sample rate consistency (44.1kHz or 48kHz).

Security: API endpoints for fetching scripts must validate that the requesting User ID owns the current "Lock" on those scripts.

Idempotency: A script line can only have one active valid recording per project requirement.

Part 3: Development Roadmap

Phase 1: MVP (Core Logic & Manual Review)

Goal: Agents can record, Managers can manually review. No AI yet.

[ ] Setup: Next.js + Prisma + S3 Bucket setup.

[ ] Auth: Login with Role (Agent/Manager).

[ ] Data: Import Scripts (CSV) -> DB.

[ ] Task Logic: Implement "Batch Locking" (Agent clicks "Start Session" -> locks 20 scripts).

[ ] Recorder: Browser recording with Client-Side Pre-check (Volume check).

[ ] Upload: Save file to S3 and create Recording entry in DB (Status: PENDING).

[ ] Manager UI: A simple list to listen to and Approve/Reject recordings manually.

Phase 2: The Pipeline (Async Architecture)

Goal: Connect the Python Worker.

[ ] Queue: Set up Redis and BullMQ in Next.js.

[ ] Worker: Create a basic Python script that listens to Redis.

[ ] Integration: When File Uploads -> Push Job to Redis -> Python Worker prints "Received".

[ ] Basic Analysis: Implement WADA-SNR (Signal-to-Noise) in Python. Update DB status based on noise.

Phase 3: Automation (The "Smart" Phase)

Goal: Full AI Scoring.

[ ] ASR: Integrate Whisper (OpenAI) into the Python Worker for transcription.

[ ] Comparison: Implement Levenshtein distance for WER (Word Error Rate).

[ ] MOS: Integrate NISQA (or a lighter alternative) for quality scoring.

[ ] Auto-Decision: Write the logic: IF (WER < 15% AND SNR > 20db) THEN Status = APPROVED.

Phase 4: Gamification & Polish

[ ] Merit System: Calculate scores based on Approval Rate.

[ ] Tiers: Restrict high-paying projects to high-merit agents.

[ ] Dashboard: Visual graphs for Managers.

Part 4: Database Schema (schema.prisma)

This schema supports the complex relationships between Projects, Scripts, and the "One-Take" recording workflow.

// This is your Prisma schema file.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// --- ENUMS ---

enum UserRole {
  AGENT
  MANAGER
  ADMIN
}

enum RecordingStatus {
  PENDING     // Uploaded, waiting for queue
  PROCESSING  // Worker is analyzing
  APPROVED    // Passed checks (or manual approval)
  REJECTED    // Failed checks
  FLAGGED     // Borderline score, needs human review
}

enum ScriptStatus {
  AVAILABLE
  LOCKED
  COMPLETED
}

// --- MODELS ---

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  password      String?   
  name          String?
  role          UserRole  @default(AGENT)
  
  // Agent Stats
  meritScore    Float     @default(100.0) // 0-100
  walletBalance Float     @default(0.0)
  
  // Relations
  sessions      Session[]
  recordings    Recording[]
  lockedScripts ScriptLine[] // Scripts currently locked by this user
  
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

model Project {
  id          String   @id @default(cuid())
  title       String
  description String?
  
  // Requirements (stored as simple fields or JSON)
  targetMos       Float   @default(3.5)
  maxNoiseFloorDb Float   @default(-40.0)
  maxWer          Float   @default(0.15) // 15% error rate
  
  payPerLine      Float   @default(0.50)
  
  isActive    Boolean  @default(true)
  
  scripts     ScriptLine[]
  createdAt   DateTime @default(now())
}

model ScriptLine {
  id          String   @id @default(cuid())
  projectId   String
  text        String   // The line to read: "Hello traveler!"
  context     String?  // Direction: "Angry", "Whisper"
  
  status      ScriptStatus @default(AVAILABLE)
  
  // Locking Logic
  lockedByUserId String?
  lockedAt       DateTime? // For checking expiration
  
  // Relations
  project     Project  @relation(fields: [projectId], references: [id])
  lockedBy    User?    @relation(fields: [lockedByUserId], references: [id])
  recordings  Recording[]

  @@index([projectId, status]) // Fast lookup for "Get next available scripts"
}

model Recording {
  id          String   @id @default(cuid())
  
  // Links
  userId      String
  scriptId    String
  
  // File Data
  audioUrl    String   // S3 URL
  durationSec Float?
  
  // Processing Status
  status      RecordingStatus @default(PENDING)
  
  // --- QUALITY METRICS (Set by Python Worker) ---
  snrScore    Float?   // Signal-to-Noise Ratio
  mosScore    Float?   // Mean Opinion Score (1-5)
  werScore    Float?   // Word Error Rate (0.0 - 1.0)
  transcript  String?  // What the ASR heard
  
  // Review Data
  reviewedBy  String?  // If manually reviewed
  reviewNote  String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User       @relation(fields: [userId], references: [id])
  script      ScriptLine @relation(fields: [scriptId], references: [id])
}

// --- NEXTAUTH BOILERPLATE ---

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
