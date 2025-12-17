const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;
