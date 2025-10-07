// api/tours/index.js - Get all active tours
import admin from 'firebase-admin';
import { initializeFirebase } from '../../lib/firebase';

if (!admin.apps.length) {
  initializeFirebase();
}

const db = admin.firestore();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const toursSnapshot = await db.collection('tours')
      .where('isActive', '==', true)
      .get();
    
    const tours = [];
    toursSnapshot.forEach(doc => {
      tours.push({ id: doc.id, ...doc.data() });
    });
    
    res.status(200).json(tours);
  } catch (error) {
    console.error('Error getting tours:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}