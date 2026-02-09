# UGV Result Analysis & GPA Dashboard

**TEAM doTs**

A comprehensive academic performance management system built for the University of Global Village (UGV). This full-stack web application enables students, teachers, and administrators to analyze academic results, calculate GPAs, and manage academic records efficiently.

## Features

- **Student Dashboard**: View GPA trends, semester-wise results, and academic progress
- **Teacher Dashboard**: Grade entry, subject analytics, and student performance tracking
- **Admin Dashboard**: User management, enrollments, and academic session configuration
- **Real-time GPA Calculation**: Automatic grade-to-GPA conversion with visual insights
- **Role-based Access Control**: Secure authentication with distinct permissions for each role

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **Charts**: Recharts
- **State Management**: TanStack Query

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm or bun

### Installation

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:8080`

## Project Structure

```
src/
├── components/     # Reusable UI components
│   ├── admin/      # Admin-specific components
│   ├── auth/       # Authentication components
│   ├── layout/     # Layout components
│   ├── student/    # Student dashboard components
│   ├── teacher/    # Teacher dashboard components
│   └── ui/         # shadcn/ui components
├── contexts/       # React contexts
├── hooks/          # Custom hooks
├── integrations/   # External service integrations
├── lib/            # Utility functions
└── pages/          # Page components
```

## License

This project was developed for educational purposes as part of a hackathon submission.
