import { db, admin } from './_firebase.js';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // 1. READ ALL PERMINTAAN
    if (method === 'GET') {
      const snapshot = await db.collection('permintaan').get();
      const permintaan = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        permintaan.push({
          id: doc.id,
          ...d,
          timestamp_created: d.timestamp_created?.toDate?.() || d.timestamp_created || null,
          timestamp_taken: d.timestamp_taken?.toDate?.() || d.timestamp_taken || null,
          timestamp_close: d.timestamp_close?.toDate?.() || d.timestamp_close || null
        });
      });
      return res.status(200).json({ success: true, permintaan });
    }

    // 2. CREATE PERMINTAAN
    if (method === 'POST') {
      const {
        pesan,
        kategori_pekerjaan,
        keterangan,
        segmen,
        status,
        nama_teknisi,
        username_teknisi,
        id_telegram_hd,
        id_telegram_teknisi,
        tiket_id
      } = req.body || {};

      if (!pesan && !kategori_pekerjaan) {
        return res.status(400).json({ error: 'Pesan atau Kategori Pekerjaan wajib diisi' });
      }

      const newPermintaan = {
        pesan: pesan ? String(pesan).trim() : '',
        kategori_pekerjaan: kategori_pekerjaan ? String(kategori_pekerjaan).trim() : '',
        keterangan: keterangan ? String(keterangan).trim() : '',
        segmen: segmen ? String(segmen).trim().toUpperCase() : 'B2B',
        status: status ? String(status).trim().toUpperCase() : 'PENDING',
        nama_teknisi: nama_teknisi ? String(nama_teknisi).trim() : '',
        username_teknisi: username_teknisi ? String(username_teknisi).trim() : '',
        id_telegram_hd: id_telegram_hd ? String(id_telegram_hd).trim() : null,
        id_telegram_teknisi: id_telegram_teknisi ? String(id_telegram_teknisi).trim() : null,
        tiket_id: tiket_id ? String(tiket_id).trim() : '',
        timestamp_created: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('permintaan').add(newPermintaan);
      return res.status(200).json({ success: true, id: docRef.id });
    }

    // 3. UPDATE PERMINTAAN
    if (method === 'PUT') {
      const {
        id,
        pesan,
        kategori_pekerjaan,
        keterangan,
        segmen,
        status,
        nama_teknisi,
        username_teknisi,
        id_telegram_hd,
        id_telegram_teknisi,
        tiket_id
      } = req.body || {};

      if (!id) return res.status(400).json({ error: 'ID Permintaan wajib diisi' });

      const updateData = {
        pesan: pesan ? String(pesan).trim() : '',
        kategori_pekerjaan: kategori_pekerjaan ? String(kategori_pekerjaan).trim() : '',
        keterangan: keterangan ? String(keterangan).trim() : '',
        segmen: segmen ? String(segmen).trim().toUpperCase() : '',
        status: status ? String(status).trim().toUpperCase() : 'PENDING',
        nama_teknisi: nama_teknisi ? String(nama_teknisi).trim() : '',
        username_teknisi: username_teknisi ? String(username_teknisi).trim() : '',
        id_telegram_hd: id_telegram_hd ? String(id_telegram_hd).trim() : null,
        id_telegram_teknisi: id_telegram_teknisi ? String(id_telegram_teknisi).trim() : null,
        tiket_id: tiket_id ? String(tiket_id).trim() : ''
      };

      await db.collection('permintaan').doc(id).update(updateData);
      return res.status(200).json({ success: true });
    }

    // 4. DELETE PERMINTAAN
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
