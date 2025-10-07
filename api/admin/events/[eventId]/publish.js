// api/admin/events/[eventId]/publish.js - Publish an event (make it public)
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventId } = req.query; // eventId comes from the URL parameter
  
  try {
    const eventRef = db.collection('tourEvents').doc(eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const eventData = eventDoc.data();
    
    // Update event type to public
    await eventRef.update({
      type: 'public',
      publishedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(200).json({ success: true, message: 'Event published successfully' });
  } catch (error) {
    console.error('Error publishing event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});