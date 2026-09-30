import { db, admin } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { tiket_id, status, kategori_pekerjaan } = req.body || {};

  // 1. Validasi: Tiket ID wajib ada, dan minimal salah satu (status atau kategori_pekerjaan) diisi
  if (!tiket_id || (!status && !kategori_pekerjaan)) {
    return res.status(400).json({ error: 'tiket_id & status wajib diisi' });
  }

  try {
    const snapshot = await db.collection('permintaan')
      .where('tiket_id', '==', tiket_id)
      .where('msg_type', '==', 'UTAMA')
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Tiket tidak ditemukan' });

    const docRef = snapshot.docs[0].ref;
    const updateData = {};

    // 2. Jika status dikirim, update status & timestamp
    if (status) {
      const formattedStatus = status.toUpperCase();
      updateData.status = formattedStatus;

      if (formattedStatus === 'CLOSED') {
        updateData.timestamp_close = admin.firestore.FieldValue.serverTimestamp();
      } else if (formattedStatus === 'OPEN') {
        updateData.timestamp_close = null;
      }
    }

    // 3. Jika kategori_pekerjaan dikirim, simpan ke Firestore
    if (kategori_pekerjaan) {
      updateData.kategori_pekerjaan = kategori_pekerjaan;
    }

    await docRef.update(updateData);
    return res.status(200).json({ success: true, message: 'Berhasil diperbarui' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
