import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';

// Firebase configuration from environment variables (matching client-side config)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyCBggFZbQeuMTe5WI6k336O_Jz3bIkVJxo',
  authDomain: 'nextdealapp-e749f.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'nextdealapp-e749f',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'nextdealapp-e749f.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '288338485924',
  appId: process.env.FIREBASE_APP_ID || '1:288338485924:android:06a927f94bcaea369ffc31',
  // VAPID key for web push notifications (client-side only)
  vapidKey:
    process.env.FIREBASE_WEB_PUSH_KEY_PAIR ||
    'BEtlsyeo7RGVFmGzVjasgV_rc2BdC7NgJQXKA0y9xqyw-cguaPqM99LEGiUEdlvDFWK6DSL7-Jb3T_8NoTs8IN4',
};

// Initialize Firebase Admin SDK
let firebaseInitialized = false;

try {
  // Check if Firebase app is already initialized
  const apps = getApps();

  if (apps.length === 0) {
    // Check if service account credentials are available
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    const hasServiceAccount = clientEmail && privateKey && clientEmail.trim() !== '' && privateKey.trim() !== '';

    if (hasServiceAccount) {
      // Use service account credentials (recommended for production)
      initializeApp({
        credential: cert({
          projectId: firebaseConfig.projectId,
          clientEmail: clientEmail!,
          privateKey: privateKey!.replace(/\\n/g, '\n'),
        }),
        projectId: firebaseConfig.projectId,
        storageBucket: firebaseConfig.storageBucket,
      });

      // console.log(`Firebase Admin SDK initialized with service account credentials (${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode)`);
      firebaseInitialized = true;
    } else {
      // Initialize without service account (for development only)
      if (!isProduction) {
        initializeApp({
          projectId: firebaseConfig.projectId,
          storageBucket: firebaseConfig.storageBucket,
        });
        // console.log('Firebase Admin SDK initialized without service account (DEVELOPMENT mode)');
        firebaseInitialized = true;
      } else {
        console.warn(
          '⚠️  Firebase service account credentials not found in PRODUCTION mode. Push notifications may not work.'
        );
      }
    }
  } else {
    // console.log('Firebase Admin SDK already initialized');
    firebaseInitialized = true;
  }

  // if (firebaseInitialized) {
  //   console.log('Firebase Admin SDK initialized successfully with config:', {
  //     projectId: firebaseConfig.projectId,
  //     storageBucket: firebaseConfig.storageBucket,
  //     messagingSenderId: firebaseConfig.messagingSenderId,
  //     appId: firebaseConfig.appId,
  //     environment: isProduction ? 'PRODUCTION' : 'DEVELOPMENT',
  //   });
  // }
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error);

  // Final fallback - try to initialize with minimal config
  try {
    const apps = getApps();
    if (apps.length === 0) {
      initializeApp();
      // console.log('Firebase Admin SDK initialized with minimal config (fallback)');
      firebaseInitialized = true;
    }
  } catch (fallbackError) {
    console.error('❌ All Firebase initialization attempts failed:', fallbackError);
    console.log('⚠️  Firebase Admin SDK will not be available for this session');
    firebaseInitialized = false;
  }
}

// Utility function to check if Firebase is properly initialized
export const isFirebaseReady = (): boolean => {
  return firebaseInitialized && typeof getMessaging === 'function';
};

// Note: VAPID key is only required on the client (web) for FCM web push, not in the Admin SDK.
// Do not set VAPID key here; use it in your frontend when calling getToken().

export { firebaseConfig };
export { getMessaging };
export default { getMessaging, isFirebaseReady };
