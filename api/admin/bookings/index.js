// api/admin/bookings/index.js - Get all bookings with optional filters
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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let query = db.collection('bookings');
    
    // Apply filters if provided
    const { status, tourId, eventId, startDate, endDate } = req.query;
    
    if (status) {
      query = query.where('status', '==', status);
    }
    
    if (tourId) {
      query = query.where('tourId', '==', tourId);
    }
    
    if (eventId) {
      query = query.where('eventId', '==', eventId);
    }
    
    if (startDate) {
      query = query.where('bookingDate', '>=', new Date(startDate));
    }
    
    if (endDate) {
      query = query.where('bookingDate', '<=', new Date(endDate));
    }
    
    // Order by creation date, most recent first
    query = query.orderBy('createdAt', 'desc');
    
    const snapshot = await query.get();
    const bookings = [];
    
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error getting bookings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});