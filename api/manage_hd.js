// api/manage_hd.js
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY
        ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        : undefined,
    }),
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  const { method } = req;

  // Header CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // A. BACA ALL USERS (GET)
    if (method === 'GET') {
      const snapshot = await db.collection('users_hd').orderBy('timestamp_created', 'desc').get();
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(users);
    }

    // B. TAMBAH USER BARU (POST)
    if (method === 'POST') {
      const body = req.body || {};

      // Pastikan semua field tidak undefined agar Firebase tidak menolak
      const payload = {
        nik: String(body.nik || ''),
        nama: String(body.nama || ''),
        username: String(body.username || ''),
        password: String(body.password || ''),
        segmen: String(body.segmen || ''),
        status: String(body.status || 'aktif'),
        id_telegram: String(body.id_telegram || ''),
        timestamp_created: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('users_hd').add(payload);
      return res.status(200).json({ id: docRef.id, message: 'User HD berhasil ditambahkan' });
    }

    // C. HAPUS USER (DELETE)
    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID User diperlukan' });
      await db.collection('users_hd').doc(id).delete();
      return res.status(200).json({ message: 'User HD berhasil dihapus' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('Error di API Manage HD:', err);
    return res.status(500).json({ error: err.message || 'Terjadi kesalahan pada server Firebase' });
  }
};
