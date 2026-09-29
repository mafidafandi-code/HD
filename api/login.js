import admin from 'firebase-admin';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { nik, password } = req.body;
  if (!nik || !password) return res.status(400).json({ error: 'NIK dan Password harus diisi' });

  try {
    const snapshot = await db.collection('users_hd')
      .where('nik', '==', nik)
      .where('password', '==', password)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'NIK atau Password salah!' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    if (userData.status !== 'ACTIVE' && userData.status !== 'aktif') {
      return res.status(403).json({ error: 'Akun HD tidak aktif' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: userDoc.id,
        nama: userData.nama,
        nik: userData.nik,
        segmen: userData.segmen,
        id_telegram: userData.id_telegram || null
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Terjadi kesalahan server' });
  }
}
