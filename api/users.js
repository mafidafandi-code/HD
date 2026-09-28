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
    databaseURL: "https://proyeksaya-74320-default-rtdb.asia-southeast1.firebasedatabase.app"
  });
}

const db = admin.database();

module.exports = async (req, res) => {
  const { method } = req;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const ref = db.ref('users_hd');

    // A. BACA ALL USERS (GET)
    if (method === 'GET') {
      const snapshot = await ref.once('value');
      const data = snapshot.val();
      const users = data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : [];
      return res.status(200).json(users);
    }

    // B. TAMBAH USER BARU (POST)
    if (method === 'POST') {
      const data = req.body;
      data.timestamp_created = Date.now();
      const newRef = ref.push();
      await newRef.set(data);
      return res.status(200).json({ id: newRef.key, message: 'User HD berhasil ditambahkan' });
    }

    // C. UPDATE USER (PUT)
    if (method === 'PUT') {
      const { id, ...data } = req.body;
      if (!id) return res.status(400).json({ error: 'ID User diperlukan' });
      await ref.child(id).update(data);
      return res.status(200).json({ message: 'User HD berhasil diperbarui' });
    }

    // D. HAPUS USER (DELETE)
    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID User diperlukan' });
      await ref.child(id).remove();
      return res.status(200).json({ message: 'User HD berhasil dihapus' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    return res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error('Error di API Users:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan pada server Firebase' });
  }
};
