# Nevado Trek Backend

Backend for Nevado Trek tour booking system deployed on Vercel with Firestore.

## Overview

This is the backend for the "Nevado Trek" tour booking system. It provides REST API endpoints for managing tours, events, and bookings with the following features:

- Bilingual support (English/Spanish)
- Tour management
- Event booking system with dynamic pricing
- Rate limiting by IP
- Admin controls with secret key authentication
- Private/public event types

## Technologies Used

- Node.js with Express
- Firebase Admin SDK
- Firestore (NoSQL database)
- Vercel for deployment

## Setup Instructions

### Prerequisites

1. Node.js (version 14 or higher)
2. A Firebase project with Firestore enabled
3. A service account key JSON file from Firebase
4. Vercel account for deployment

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/your-username/nevado-trek-backend.git
   cd nevado-trek-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the `.env.example` file to `.env`:
   ```bash
   cp .env.example .env
   ```

4. Configure your environment variables in the `.env` file:
   - `ADMIN_KEY`: Your admin secret key
   - `FIREBASE_PROJECT_ID`: Your Firebase project ID
   - `FIREBASE_PRIVATE_KEY`: Your Firebase private key
   - `FIREBASE_CLIENT_EMAIL`: Your Firebase client email

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. The server will run on `http://localhost:3000`

## API Endpoints

On Vercel, each file in the `api/` directory becomes an API endpoint. The structure is as follows:

### Public Endpoints

- `GET /api/tours` - Get all active tours
- `GET /api/getTour?tourId={tourId}` - Get details of a specific tour
- `POST /api/createBooking` - Create a new booking (creates private event)
- `POST /api/joinEvent` - Join an existing public event

### Admin Endpoints (require `X-Admin-Secret-Key` header)

- `GET /api/admin/bookings` - Get all bookings with optional filters
- `PUT /api/admin/bookings/[bookingId]/status` - Update booking status
- `POST /api/admin/events/[eventId]/publish` - Publish an event (make it public)

### Health Check

- `GET /api/health` - Check server health status

### Vercel API Routes Structure

- `api/getTour.js` - Get tour by ID
- `api/tours/index.js` - Get all tours
- `api/createBooking.js` - Create new booking
- `api/joinEvent.js` - Join existing event
- `api/health.js` - Health check
- `api/admin/bookings/index.js` - Admin: get bookings
- `api/admin/bookings/[bookingId]/status.js` - Admin: update booking status
- `api/admin/events/[eventId]/publish.js` - Admin: publish event

## Environment Variables

- `ADMIN_KEY`: Secret key for admin authentication
- `FIREBASE_PROJECT_ID`: Your Firebase project ID
- `FIREBASE_PRIVATE_KEY`: Your Firebase service account private key
- `FIREBASE_CLIENT_EMAIL`: Your Firebase service account client email

## Authentication

Admin endpoints require the `X-Admin-Secret-Key` header with your admin secret key.

## Firestore Collections

- `tours`: Tour catalog with bilingual content
- `tourEvents`: Specific tour instances with dates and capacity
- `bookings`: Individual bookings
- `rateLimiter`: IP-based rate limiting

## Deployment on Vercel

1. Push your code to a GitHub repository
2. Import the repository in Vercel
3. Add your environment variables in the Vercel dashboard
4. Deploy!

The project is configured to work as Vercel serverless functions in the `api/` directory.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT