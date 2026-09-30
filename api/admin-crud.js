import { db, admin } from './_firebase.js';

export default async function handler(req, res) {
  const { method } = req;

  try {
    // 1. READ ALL PERMINTAAN (21 FIELD)
    if (method === 'GET') {
      const snapshot = await db.collection('permintaan').get();
      const permintaan = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        permintaan.push({
          id: doc.id,
          chat_id: d.chat_id || null,
          file_id: d.file_id || null,
          id_permintaan: d.id_permintaan || null,
          id_telegram_hd: d.id_telegram_hd || null,
          id_telegram_teknisi: d.id_telegram_teknisi || null,
          kategori_pekerjaan: d.kategori_pekerjaan || '',
          keterangan: d.keterangan || '',
          message_id: d.message_id || null,
          msg_type: d.msg_type || '',
          nama_teknisi: d.nama_teknisi || '',
          pesan: d.pesan || '',
          reply_to_message_id: d.reply_to_message_id || null,
          segmen: d.segmen || '',
          sender_type: d.sender_type || '',
          status: d.status || '',
          thread_id: d.thread_id || null,
          tiket_id: d.tiket_id || '',
          timestamp_created: d.timestamp_created?.toDate?.() || d.timestamp_created || null,
          timestamp_taken: d.timestamp_taken?.toDate?.() || d.timestamp_taken || null,
          timestamp_close: d.timestamp_close?.toDate?.() || d.timestamp_close || null,
          username_teknisi: d.username_teknisi || ''
        });
      });
      return res.status(200).json({ success: true, permintaan });
    }

    // 2. CREATE PERMINTAAN
    if (method === 'POST') {
      const b = req.body || {};
      const newPermintaan = {
        chat_id: b.chat_id ? String(b.chat_id) : null,
        file_id: b.file_id ? String(b.file_id) : null,
        id_permintaan: b.id_permintaan ? String(b.id_permintaan) : null,
        id_telegram_hd: b.id_telegram_hd ? String(b.id_telegram_hd) : null,
        id_telegram_teknisi: b.id_telegram_teknisi ? String(b.id_telegram_teknisi) : null,
        kategori_pekerjaan: b.kategori_pekerjaan ? String(b.kategori_pekerjaan).trim() : '',
        keterangan: b.keterangan ? String(b.keterangan).trim() : '',
        message_id: b.message_id ? String(b.message_id) : null,
        msg_type: b.msg_type ? String(b.msg_type).trim() : 'text',
        nama_teknisi: b.nama_teknisi ? String(b.nama_teknisi).trim() : '',
        pesan: b.pesan ? String(b.pesan).trim() : '',
        reply_to_message_id: b.reply_to_message_id ? String(b.reply_to_message_id) : null,
        segmen: b.segmen ? String(b.segmen).trim().toUpperCase() : 'B2B',
        sender_type: b.sender_type ? String(b.sender_type).trim() : 'user',
        status: b.status ? String(b.status).trim().toUpperCase() : 'PENDING',
        thread_id: b.thread_id ? String(b.thread_id) : null,
        tiket_id: b.tiket_id ? String(b.tiket_id).trim() : '',
        username_teknisi: b.username_teknisi ? String(b.username_teknisi).trim() : '',
        timestamp_created: admin.firestore.FieldValue.serverTimestamp()
      };

      const docRef = await db.collection('permintaan').add(newPermintaan);
      return res.status(200).json({ success: true, id: docRef.id });
    }

    // 3. UPDATE PERMINTAAN
    if (method === 'PUT') {
      const b = req.body || {};
      if (!b.id) return res.status(400).json({ error: 'ID Permintaan wajib diisi' });

      const updateData = {
        chat_id: b.chat_id ? String(b.chat_id) : null,
        file_id: b.file_id ? String(b.file_id) : null,
        id_permintaan: b.id_permintaan ? String(b.id_permintaan) : null,
        id_telegram_hd: b.id_telegram_hd ? String(b.id_telegram_hd) : null,
        id_telegram_teknisi: b.id_telegram_teknisi ? String(b.id_telegram_teknisi) : null,
        kategori_pekerjaan: b.kategori_pekerjaan ? String(b.kategori_pekerjaan).trim() : '',
        keterangan: b.keterangan ? String(b.keterangan).trim() : '',
        message_id: b.message_id ? String(b.message_id) : null,
        msg_type: b.msg_type ? String(b.msg_type).trim() : '',
        nama_teknisi: b.nama_teknisi ? String(b.nama_teknisi).trim() : '',
        pesan: b.pesan ? String(b.pesan).trim() : '',
        reply_to_message_id: b.reply_to_message_id ? String(b.reply_to_message_id) : null,
        segmen: b.segmen ? String(b.segmen).trim().toUpperCase() : '',
        sender_type: b.sender_type ? String(b.sender_type).trim() : '',
        status: b.status ? String(b.status).trim().toUpperCase() : 'PENDING',
        thread_id: b.thread_id ? String(b.thread_id) : null,
        tiket_id: b.tiket_id ? String(b.tiket_id).trim() : '',
        username_teknisi: b.username_teknisi ? String(b.username_teknisi).trim() : ''
      };

      await db.collection('permintaan').doc(b.id).update(updateData);
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
