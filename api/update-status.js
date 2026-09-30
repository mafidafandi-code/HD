import { db, admin } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { tiket_id, status } = req.body || {};
  if (!tiket_id || !status) return res.status(400).json({ error: 'tiket_id & status wajib diisi' });

  try {
    const snapshot = await db.collection('permintaan')
      .where('tiket_id', '==', tiket_id)
      .where('msg_type', '==', 'UTAMA')
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Tiket tidak ditemukan' });

    const docRef = snapshot.docs[0].ref;
    const updateData = { status: status.toUpperCase() };

    if (status.toUpperCase() === 'CLOSED') {
      updateData.timestamp_close = admin.firestore.FieldValue.serverTimestamp();
    } else if (status.toUpperCase() === 'OPEN') {
      updateData.timestamp_close = null;
    }

    await docRef.update(updateData);
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
