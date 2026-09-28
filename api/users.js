const admin = require('firebase-admin');

// Inisialisasi Firebase Admin
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

  // Header CORS agar halaman HTML bisa mengakses API ini
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
      const data = req.body;
      data.timestamp_created = admin.firestore.FieldValue.serverTimestamp();
      const docRef = await db.collection('users_hd').add(data);
      return res.status(200).json({ id: docRef.id, message: 'User HD berhasil ditambahkan' });
    }

    // C. UPDATE USER (PUT)
    if (method === 'PUT') {
      const { id, ...data } = req.body;
      if (!id) return res.status(400).json({ error: 'ID User diperlukan' });
      await db.collection('users_hd').doc(id).update(data);
      return res.status(200).json({ message: 'User HD berhasil diperbarui' });
    }

    // D. HAPUS USER (DELETE)
    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID User diperlukan' });
      await db.collection('users_hd').doc(id).delete();
      return res.status(200).json({ message: 'User HD berhasil dihapus' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('Error di API Users:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server Firebase' });
  }
};
