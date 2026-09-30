import { db, admin } from './_firebase.js';
import formidable from 'formidable';
import fs from 'fs';
import fetch from 'node-fetch';
import FormData from 'form-data';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const form = formidable({ multiples: true }); // Aktifkan multiples agar bisa handle > 1 file

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Gagal membaca form data' });

    const tiket_id = Array.isArray(fields.tiket_id) ? fields.tiket_id[0] : fields.tiket_id;
    const parent_message_id = parseInt(Array.isArray(fields.parent_message_id) ? fields.parent_message_id[0] : fields.parent_message_id);
    const chat_id = parseInt(Array.isArray(fields.chat_id) ? fields.chat_id[0] : fields.chat_id);
    const thread_id = Array.isArray(fields.thread_id) ? fields.thread_id[0] : fields.thread_id;
    const pesan = (Array.isArray(fields.pesan) ? fields.pesan[0] : fields.pesan) || '';
    const hd_nama = Array.isArray(fields.hd_nama) ? fields.hd_nama[0] : fields.hd_nama;
    const hd_id_telegram = Array.isArray(fields.hd_id_telegram) ? fields.hd_id_telegram[0] : fields.hd_id_telegram;
    const segmen = Array.isArray(fields.segmen) ? fields.segmen[0] : fields.segmen;

    // Normalisasi file (bisa 1 file atau Array file)
    let rawFiles = files.image ? (Array.isArray(files.image) ? files.image : [files.image]) : [];
    
    if (!tiket_id || !chat_id || !parent_message_id) {
      return res.status(400).json({ error: 'Parameter tiket_id, chat_id, dan parent_message_id wajib ada' });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    let sentMessageId = null;
    let fileIdList = [];

    try {
      const textWithHeader = `💬 *Balasan HD (${hd_nama}):*\n\n${pesan}`;

      if (rawFiles.length > 0) {
        // Kirim Setiap Gambar ke Telegram
        for (let i = 0; i < rawFiles.length; i++) {
          const file = rawFiles[i];
          const formData = new FormData();
          formData.append('chat_id', chat_id);
          formData.append('reply_to_message_id', parent_message_id);
          if (thread_id && thread_id !== 'null' && thread_id !== '') {
            formData.append('message_thread_id', thread_id);
          }
          // Caption hanya pada gambar pertama
          if (i === 0) formData.append('caption', textWithHeader);
          formData.append('parse_mode', 'Markdown');
          formData.append('photo', fs.createReadStream(file.filepath));

          const telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
            method: 'POST',
            body: formData,
          });

          const tgResult = await telegramRes.json();
          if (tgResult.ok) {
            if (!sentMessageId) sentMessageId = tgResult.result.message_id;
            const photos = tgResult.result.photo;
            fileIdList.push(photos[photos.length - 1].file_id); // Ambil resolusi tertinggi
          }
        }
      } else {
        // Jika HD Hanya Mengirim Teks
        const telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat_id,
            reply_to_message_id: parent_message_id,
            message_thread_id: (thread_id && thread_id !== 'null' && thread_id !== '') ? thread_id : undefined,
            text: textWithHeader,
            parse_mode: 'Markdown'
          })
        });

        const tgResult = await telegramRes.json();
        if (!tgResult.ok) {
          return res.status(500).json({ error: 'Gagal mengirim pesan ke Telegram: ' + tgResult.description });
        }
        sentMessageId = tgResult.result.message_id;
      }

      // Gabungkan semua file_id dengan KOMA (misal: "id1,id2,id3")
      const combinedFileIds = fileIdList.length > 0 ? fileIdList.join(',') : null;

      // Simpan Balasan HD ke collection `permintaan`
      const newReplyRef = db.collection('permintaan').doc();
      await newReplyRef.set({
        id_permintaan: newReplyRef.id,
        tiket_id: tiket_id,
        msg_type: 'BALASAN',
        sender_type: 'HD',
        chat_id: chat_id,
        thread_id: thread_id || null,
        message_id: sentMessageId,
        reply_to_message_id: parent_message_id,
        segmen: segmen,
        kategori_pekerjaan: null,
        pesan: pesan,
        file_id: combinedFileIds, // <--- Tersimpan dipisahkan koma jika >1
        id_telegram_teknisi: null,
        nama_teknisi: null,
        username_teknisi: null,
        id_telegram_hd: hd_id_telegram || null,
        nama_hd: hd_nama,
        status: null,
        keterangan: null,
        timestamp_created: admin.firestore.FieldValue.serverTimestamp(),
        timestamp_taken: null,
        timestamp_close: null
      });

      // Update status Tiket Utama ke PROGRESS
      const mainTicketSnapshot = await db.collection('permintaan')
        .where('tiket_id', '==', tiket_id)
        .where('msg_type', '==', 'UTAMA')
        .limit(1)
        .get();

      if (!mainTicketSnapshot.empty) {
        const mainDoc = mainTicketSnapshot.docs[0];
        const updateObj = {
          status: 'PROGRESS',
          id_telegram_hd: hd_id_telegram || null,
          nama_hd: hd_nama
        };
        if (!mainDoc.data().timestamp_taken) {
          updateObj.timestamp_taken = admin.firestore.FieldValue.serverTimestamp();
        }
        await db.collection('permintaan').doc(mainDoc.id).update(updateObj);
      }

      return res.status(200).json({ success: true, message: 'Balasan terkirim' });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  });
}
