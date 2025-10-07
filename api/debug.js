// api/debug.js - Simple endpoint to test Firebase connection
import admin from 'firebase-admin';
import { initializeFirebase } from '../lib/firebase';

export default async function handler(req, res) {
  try {
    // Try to initialize Firebase if not already initialized
    if (!admin.apps.length) {
      initializeFirebase();
    }

    // Test the connection by trying to access Firestore
    const db = admin.firestore();
    
    // Try to get a simple collection count to test connection
    const toursSnapshot = await db.collection('tours').limit(1).get();
    
    res.status(200).json({ 
      message: 'Firebase connection successful',
      timestamp: new Date().toISOString(),
      toursCount: toursSnapshot.size,
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  } catch (error) {
    console.error('Firebase connection error:', error);
    res.status(500).json({ 
      error: 'Firebase connection failed',
      message: error.message,
      stack: error.stack 
    });
  }
}