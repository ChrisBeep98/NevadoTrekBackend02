// api/joinEvent.js - Join an existing public event
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

  const { eventId, pax, customer } = req.body;
  
  if (!eventId || !pax || !customer) {
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

    // Get the event
    const eventRef = db.collection('tourEvents').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const eventData = eventDoc.data();
    
    // Check if event is public
    if (eventData.type !== 'public') {
      return res.status(400).json({ error: 'Cannot join a private event' });
    }
    
    // Check if event is full
    if (eventData.status === 'full') {
      return res.status(400).json({ error: 'Event is already full' });
    }
    
    // Check capacity
    const totalPaxAfterJoin = eventData.bookedSlots + pax;
    if (totalPaxAfterJoin > eventData.maxCapacity) {
      return res.status(400).json({ error: `Not enough space. Only ${eventData.maxCapacity - eventData.bookedSlots} spots left.` });
    }

    // Get tour details to calculate price
    const tourDoc = await db.collection('tours').doc(eventData.tourId).get();
    if (!tourDoc.exists) {
      return res.status(404).json({ error: 'Tour not found' });
    }
    
    const tourData = tourDoc.data();
    if (!tourData.isActive) {
      return res.status(400).json({ error: 'Tour is not active' });
    }

    // Calculate new price based on total pax after joining
    const pricingTiers = tourData.pricingTiers || [];
    let pricePerPerson = 0;
    
    if (pricingTiers.length > 0) {
      const tier = pricingTiers.find(t => t.pax === totalPaxAfterJoin) || 
                  pricingTiers.reduce((prev, curr) => (curr.pax <= totalPaxAfterJoin && curr.pax > prev.pax) ? curr : prev, { pax: 0, pricePerPerson: 0 });
                  
      pricePerPerson = tier.pricePerPerson || pricingTiers[pricingTiers.length - 1].pricePerPerson;
    }

    // Use a transaction to update event and create booking atomically
    await db.runTransaction(async (transaction) => {
      // Update event booked slots
      transaction.update(eventRef, {
        bookedSlots: totalPaxAfterJoin,
        status: totalPaxAfterJoin >= eventData.maxCapacity ? 'full' : 'active'
      });
      
      // Create booking document
      const bookingId = `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const bookingRef = db.collection('bookings').doc(bookingId);
      
      transaction.set(bookingRef, {
        bookingId,
        eventId,
        tourId: eventData.tourId,
        tourName: eventData.tourName,
        customer,
        pax,
        pricePerPerson,
        totalPrice: pricePerPerson * pax,
        bookingDate: admin.firestore.FieldValue.serverTimestamp(),
        status: 'pending',
        isEventOrigin: false, // This booking joined an existing event
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
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
      message: 'Successfully joined the event',
      totalPaxAfterJoin
    });
  } catch (error) {
    console.error('Error joining event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}