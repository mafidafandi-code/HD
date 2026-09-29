// api/manage_hd.js
import admin from 'firebase-admin';

// Pembersih Private Key dari Vercel Environment Variable
const parsePrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/"/g, '');
};

// Inisialisasi Firebase Admin
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
  } catch (initErr) {
    console.error('Firebase Initialization Error:', initErr);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  // Paksa response berupa JSON
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. BACA ALL USERS (GET)
    if (req.method === 'GET') {
      const snapshot = await db.collection('users_hd').get();
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(users);
    }

    // 2. TAMBAH USER (POST)
    if (req.method === 'POST') {
      const body = req.body || {};

      const payload = {
        nik: String(body.nik || ''),
        nama: String(body.nama || ''),
        username: String(body.username || ''),
        password: String(body.password || ''),
        segmen: String(body.segmen || ''),
        status: String(body.status || 'aktif'),
        id_telegram: String(body.id_telegram || ''),
        created_at: new Date().toISOString()
      };

      const docRef = await db.collection('users_hd').add(payload);
      return res.status(200).json({ success: true, id: docRef.id, message: 'User berhasil disimpan' });
    }

    // 3. HAPUS USER (DELETE)
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID User tidak ditemukan' });

      await db.collection('users_hd').doc(id).delete();
      return res.status(200).json({ success: true, message: 'User berhasil dihapus' });
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });

  } catch (err) {
    console.error('Server execution error:', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan pada Firebase Server' });
  }
}
