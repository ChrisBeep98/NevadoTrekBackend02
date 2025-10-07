// api/createBooking.js - Create a new booking (initial private event)
import admin from 'firebase-admin';
import { initializeFirebase } from '../lib/firebase';

if (!admin.apps.length) {
  initializeFirebase();
}

const db = admin.firestore();

// Rate limiting time (5 minutes in milliseconds)
const RATE_LIMIT_TIME = 5 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tourId, startDate, pax, customer } = req.body;
  
  if (!tourId || !startDate || !pax || !customer) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const isAdmin = req.headers['x-admin-secret-key'] === process.env.ADMIN_KEY;

  try {
    // Rate limiting (skip for admin)
    if (!isAdmin) {
      const rateLimitDoc = await db.collection('rateLimiter').doc(ip).get();
      if (rateLimitDoc.exists) {
        const lastBookingTime = rateLimitDoc.data().lastBookingTimestamp;
        if (Date.now() - lastBookingTime < RATE_LIMIT_TIME) {
          return res.status(429).json({ error: 'Too many requests. Please try again later.' });
        }
      }
    }

    // Get tour details to calculate price and check if tour exists
    const tourDoc = await db.collection('tours').doc(tourId).get();
    if (!tourDoc.exists) {
      return res.status(404).json({ error: 'Tour not found' });
    }
    
    const tourData = tourDoc.data();
    if (!tourData.isActive) {
      return res.status(400).json({ error: 'Tour is not active' });
    }

    // Calculate initial price based on pricing tiers
    const pricingTiers = tourData.pricingTiers || [];
    let pricePerPerson = 0;
    
    if (pricingTiers.length > 0) {
      // Find the price for the requested number of pax
      const tier = pricingTiers.find(t => t.pax === pax) || 
                  pricingTiers.reduce((prev, curr) => (curr.pax <= pax && curr.pax > prev.pax) ? curr : prev, { pax: 0, pricePerPerson: 0 });
                  
      // For pax counts above the defined tiers, use the highest defined price
      pricePerPerson = tier.pricePerPerson || pricingTiers[pricingTiers.length - 1].pricePerPerson;
    }

    // Create event ID based on tourId and start date
    const eventId = `${tourId}-${new Date(startDate).toISOString().replace(/[:.]/g, '-')}`;
    
    // Create or update the event in tourEvents collection
    const eventRef = db.collection('tourEvents').doc(eventId);
    
    // Use a transaction to ensure atomicity
    await db.runTransaction(async (transaction) => {
      const eventDoc = await transaction.get(eventRef);
      
      if (eventDoc.exists) {
        // Event already exists, return error
        throw new Error('Event already exists');
      }
      
      // Calculate end date (default to 3 days after start for demo)
      const endDate = new Date(new Date(startDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
      
      transaction.set(eventRef, {
        eventId,
        tourId,
        tourName: tourData.name.en, // Use English name as default for denormalization
        startDate,
        endDate,
        maxCapacity: 8,
        bookedSlots: pax,
        type: 'private', // All initial events are private
        status: 'active',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    // Create booking document
    const bookingId = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const bookingRef = db.collection('bookings').doc(bookingId);
    
    await bookingRef.set({
      bookingId,
      eventId,
      tourId,
      tourName: tourData.name.en, // Use English name as default for denormalization
      customer,
      pax,
      pricePerPerson,
      totalPrice: pricePerPerson * pax,
      bookingDate: admin.firestore.FieldValue.serverTimestamp(),
      status: 'pending', // All initial bookings are pending
      isEventOrigin: true, // This booking created the event
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update rate limiter (skip for admin)
    if (!isAdmin) {
      await db.collection('rateLimiter').doc(ip).set({
        ipAddress: ip,
        lastBookingTimestamp: Date.now()
      });
    }

    res.status(200).json({ 
      success: true, 
      bookingId,
      eventId,
      message: 'Booking created successfully. An admin will contact you to confirm the event.'
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    if (error.message === 'Event already exists') {
      res.status(409).json({ error: 'Event already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}