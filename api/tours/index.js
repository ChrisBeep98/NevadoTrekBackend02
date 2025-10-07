// api/tours/index.js - Get all active tours
const admin = require('firebase-admin');
const { initializeFirebase } = require('../../lib/firebase');

if (!admin.apps.length) {
  initializeFirebase();
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
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
