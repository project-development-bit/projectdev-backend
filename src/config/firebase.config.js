const admin = require('firebase-admin');
const dotenv = require("dotenv");
dotenv.config();

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
  "type": "service_account",
  "project_id": "gigafaucet-dev",
  "private_key_id": "f0b51fdeb0d0fec7010ce5063891255b3896f9f8",
  "private_key": process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  "client_email": "firebase-adminsdk-fbsvc@gigafaucet-dev.iam.gserviceaccount.com",
  "client_id": "117793434867376063555",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40gigafaucet-dev.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}
)
});

module.exports = admin;
