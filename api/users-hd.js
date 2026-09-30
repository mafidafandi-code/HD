import { db, admin } from './_firebase.js';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // 1. READ ALL USERS
    if (method === 'GET') {
      const snapshot = await db.collection('users_hd').get();
      const users = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        users.push({
          id: doc.id,
          ...d,
          created_at: d.created_at?.toDate?.() || null
        });
      });
      return res.status(200).json({ success: true, users });
    }

    // 2. CREATE USER
    if (method === 'POST') {
      const { nik, nama, username, password, segmen, status, id_telegram } = req.body || {};

      if (!nik || !nama || !password || !segmen) {
        return res.status(400).json({ error: 'NIK, Nama, Password, dan Segmen wajib diisi' });
      }

      // Cek NIK unik
      const existing = await db.collection('users_hd').where('nik', '==', String(nik).trim()).get();
      if (!existing.empty) {
        return res.status(400).json({ error: 'NIK sudah terdaftar!' });
      }

      const newUser = {
        nik: String(nik).trim(),
        nama: String(nama).trim(),
        username: username ? String(username).trim() : '',
        password: String(password).trim(),
        segmen: String(segmen).trim().toUpperCase(),
        status: status ? String(status).trim().toUpperCase() : 'ACTIVE',
        id_telegram: id_telegram ? String(id_telegram).trim() : null,
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('users_hd').add(newUser);
      return res.status(200).json({ success: true, id: docRef.id });
    }

    // 3. UPDATE USER
    if (method === 'PUT') {
      const { id, nik, nama, username, password, segmen, status, id_telegram } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID User wajib diisi' });

      const updateData = {
        nik: String(nik).trim(),
        nama: String(nama).trim(),
        username: username ? String(username).trim() : '',
        password: String(password).trim(),
        segmen: String(segmen).trim().toUpperCase(),
        status: String(status).trim().toUpperCase(),
        id_telegram: id_telegram ? String(id_telegram).trim() : null
      };

      await db.collection('users_hd').doc(id).update(updateData);
      return res.status(200).json({ success: true });
    }

    // 4. DELETE USER
    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID User wajib diisi' });

      await db.collection('users_hd').doc(id).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
