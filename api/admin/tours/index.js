// api/admin/tours/index.js - Admin endpoints for managing tours
const admin = require('firebase-admin');
const { initializeFirebase } = require('../../../lib/firebase');

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

module.exports = requireAdmin(async function handler(req, res) {
  if (req.method === 'POST') {
    // Create a new tour
    const { tourId, name, shortDescription, longDescription, details, itinerary, inclusions, recommendations, faqs, pricingTiers, isActive = true } = req.body;

    // Validation
    if (!tourId || !name || !pricingTiers) {
      return res.status(400).json({ error: 'Missing required fields: tourId, name, or pricingTiers' });
    }

    // Validate bilingual fields
    const requiredBilingualFields = [name, shortDescription, longDescription];
    for (const field of requiredBilingualFields) {
      if (field && (typeof field !== 'object' || !field.es || !field.en)) {
        return res.status(400).json({ error: 'All text fields must be bilingual objects with "es" and "en" properties' });
      }
    }

    try {
      const tourRef = db.collection('tours').doc(tourId);
      const tourDoc = await tourRef.get();

      if (tourDoc.exists) {
        return res.status(409).json({ error: 'Tour with this ID already exists' });
      }

      // Create tour document
      const tourData = {
        tourId,
        name: name || { es: 'Nombre no especificado', en: 'Name not specified' },
        shortDescription: shortDescription || { es: 'Sin descripción corta', en: 'No short description' },
        longDescription: longDescription || { es: 'Sin descripción larga', en: 'No long description' },
        details: details || [],
        itinerary: itinerary || {},
        inclusions: inclusions || [],
        recommendations: recommendations || [],
        faqs: faqs || [],
        pricingTiers: pricingTiers || [],
        isActive: isActive,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await tourRef.set(tourData);

      res.status(201).json({ 
        success: true, 
        message: 'Tour created successfully',
        tourId: tourId 
      });
    } catch (error) {
      console.error('Error creating tour:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else if (req.method === 'GET') {
    // Get all tours (admin only)
    try {
      const toursSnapshot = await db.collection('tours').get();
      const tours = [];
      
      toursSnapshot.forEach(doc => {
        tours.push({ id: doc.id, ...doc.data() });
      });
      
      res.status(200).json(tours);
    } catch (error) {
      console.error('Error getting tours:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
});
