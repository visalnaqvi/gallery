import admin, { ServiceAccount } from "firebase-admin";
import serviceAccount from "./firebase-key.json"; // adjust path

// Prevent re-initialization
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as ServiceAccount),
    storageBucket: "gallery-585ee.firebasestorage.app",
  });
}

export const storage = admin.storage();
export default admin;
