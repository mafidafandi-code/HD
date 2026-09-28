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

  try {
    if (method === 'GET') {
      const snapshot = await db.collection('users_hd').orderBy('timestamp_created', 'desc').get();
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.status(200).json(users);
    } 
    
    if (method === 'POST') {
      const data = req.body;
      data.timestamp_created = admin.firestore.FieldValue.serverTimestamp();
      const docRef = await db.collection('users_hd').add(data);
      return res.status(200).json({ id: docRef.id, message: 'User berhasil ditambahkan' });
    }

    if (method === 'PUT') {
      const { id, ...data } = req.body;
      await db.collection('users_hd').doc(id).update(data);
      return res.status(200).json({ message: 'User berhasil diperbarui' });
    }

    if (method === 'DELETE') {
      const { id } = req.query;
      await db.collection('users_hd').doc(id).delete();
      return res.status(200).json({ message: 'User berhasil dihapus' });
    }

    res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
    res.status(405).end(`Method ${method} Not Allowed`);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Terjadi kesalahan pada server' });
  }
};
