import { db, admin } from './_firebase.js';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // 1. READ ALL REQUESTS
    if (method === 'GET') {
      const snapshot = await db.collection('permintaan').get();
      const requests = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        requests.push({
          id: doc.id,
          ...d,
          created_at: d.created_at?.toDate?.() || null
        });
      });
      return res.status(200).json({ success: true, requests });
    }

    // 2. CREATE REQUEST
    if (method === 'POST') {
      const { pemohon, nama_permintaan, jumlah, status, keterangan } = req.body || {};

      if (!pemohon || !nama_permintaan || !jumlah) {
        return res.status(400).json({ error: 'Pemohon, Nama Permintaan, dan Jumlah wajib diisi' });
      }

      const newRequest = {
        pemohon: String(pemohon).trim(),
        nama_permintaan: String(nama_permintaan).trim(),
        jumlah: Number(jumlah),
        status: status ? String(status).trim().toUpperCase() : 'PENDING',
        keterangan: keterangan ? String(keterangan).trim() : '',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('permintaan').add(newRequest);
      return res.status(200).json({ success: true, id: docRef.id });
    }

    // 3. UPDATE REQUEST
    if (method === 'PUT') {
      const { id, pemohon, nama_permintaan, jumlah, status, keterangan } = req.body || {};
      if (!id) return res.status(400).json({ error: 'ID Permintaan wajib diisi' });

      const updateData = {
        pemohon: String(pemohon).trim(),
        nama_permintaan: String(nama_permintaan).trim(),
        jumlah: Number(jumlah),
        status: String(status).trim().toUpperCase(),
        keterangan: keterangan ? String(keterangan).trim() : ''
      };

      await db.collection('permintaan').doc(id).update(updateData);
      return res.status(200).json({ success: true });
    }

    // 4. DELETE REQUEST
    if (method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'ID Permintaan wajib diisi' });

      await db.collection('permintaan').doc(id).delete();
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
