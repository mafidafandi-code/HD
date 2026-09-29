import { db } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { nik, password } = req.body || {};
  if (!nik || !password) return res.status(400).json({ error: 'NIK dan Password harus diisi' });

  try {
    const snapshot = await db.collection('users_hd')
      .where('nik', '==', String(nik).trim())
      .where('password', '==', String(password).trim())
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(401).json({ error: 'NIK atau Password salah!' });
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    const statusUpper = (userData.status || '').toUpperCase();
    if (statusUpper !== 'ACTIVE' && statusUpper !== 'AKTIFF' && statusUpper !== 'AKTIF') {
      return res.status(403).json({ error: 'Akun HD Anda tidak aktif' });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: userDoc.id,
        nama: userData.nama,
        nik: userData.nik,
        username: userData.username || '',
        segmen: (userData.segmen || '').toUpperCase(),
        id_telegram: userData.id_telegram || null
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
