// api/admin/bookings/[bookingId]/status.js - Update booking status
import admin from 'firebase-admin';
import { initializeFirebase } from '../../../lib/firebase';

if (!admin.apps.length) {
  initializeFirebase();
}

const db = admin.firestore();

// Admin authentication middleware
function requireAdmin(handler) {
  return async (req, res) => {
    if (req.headers['x-admin-secret-key'] !== process.env.ADMIN_KEY) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    return handler(req, res);
  };
}

export default requireAdmin(async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bookingId } = req.query; // bookingId comes from the URL parameter
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }
  
  // Validate status
  const validStatuses = ['pending', 'confirmed', 'paid', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingDoc = await bookingRef.get();
    
    if (!bookingDoc.exists) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const bookingData = bookingDoc.data();
    
    // If changing to cancelled, update event's booked slots
    if (status === 'cancelled' && bookingData.status !== 'cancelled') {
      const eventRef = db.collection('tourEvents').doc(bookingData.eventId);
      
      await db.runTransaction(async (transaction) => {
        const eventDoc = await transaction.get(eventRef);
        if (eventDoc.exists) {
          const currentBookedSlots = eventDoc.data().bookedSlots;
          const newBookedSlots = currentBookedSlots - bookingData.pax;
          
          // Update event with new booked slots and adjust status if needed
          const updates = {
            bookedSlots: newBookedSlots
          };
          
          // If event was full and we're cancelling a booking, it's no longer full
          if (eventDoc.data().status === 'full') {
            updates.status = 'active';
          }
          
          transaction.update(eventRef, updates);
        }
      });
    }
    
    // Update booking status
    await bookingRef.update({
      status: status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'admin'
    });
    
    res.status(200).json({ success: true, message: 'Booking status updated successfully' });
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});