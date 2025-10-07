// api/getTour.js - Get tour details by tourId
const admin = require('firebase-admin');
const { initializeFirebase } = require('../lib/firebase');

if (!admin.apps.length) {
  initializeFirebase();
}

const db = admin.firestore();

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tourId } = req.query;
  if (!tourId) {
    return res.status(400).json({ error: 'Missing tourId' });
  }

  try {
    const tourDoc = await db.collection('tours').doc(tourId).get();
    if (!tourDoc.exists) {
      return res.status(404).json({ error: 'Tour not found' });
    }
    
    res.status(200).json(tourDoc.data());
  } catch (error) {
    console.error('Error getting tour:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
