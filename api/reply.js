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

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Gagal membaca form data' });

    const tiket_id = fields.tiket_id?.[0] || fields.tiket_id;
    const parent_message_id = parseInt(fields.parent_message_id?.[0] || fields.parent_message_id);
    const chat_id = parseInt(fields.chat_id?.[0] || fields.chat_id);
    const thread_id = fields.thread_id?.[0] || fields.thread_id;
    const pesan = fields.pesan?.[0] || fields.pesan || '';
    const hd_nama = fields.hd_nama?.[0] || fields.hd_nama;
    const hd_id_telegram = fields.hd_id_telegram?.[0] || fields.hd_id_telegram;
    const segmen = fields.segmen?.[0] || fields.segmen;

    const file = files.image ? (Array.isArray(files.image) ? files.image[0] : files.image) : null;

    if (!tiket_id || !chat_id || !parent_message_id) {
      return res.status(400).json({ error: 'Parameter tiket_id, chat_id, dan parent_message_id wajib ada' });
    }

    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    let telegramRes;
    let sentMessageId = null;
    let file_id = null;

    try {
      const textWithHeader = `💬 *Balasan HD (${hd_nama}):*\n\n${pesan}`;

      if (file) {
        const formData = new FormData();
        formData.append('chat_id', chat_id);
        formData.append('reply_to_message_id', parent_message_id);
        if (thread_id && thread_id !== 'null') formData.append('message_thread_id', thread_id);
        formData.append('caption', textWithHeader);
        formData.append('parse_mode', 'Markdown');
        formData.append('photo', fs.createReadStream(file.filepath));

        telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
          method: 'POST',
          body: formData,
        });
      } else {
        telegramRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chat_id,
            reply_to_message_id: parent_message_id,
            message_thread_id: (thread_id && thread_id !== 'null') ? thread_id : undefined,
            text: textWithHeader,
            parse_mode: 'Markdown'
          })
        });
      }

      const tgResult = await telegramRes.json();
      if (!tgResult.ok) {
        return res.status(500).json({ error: 'Gagal mengirim pesan Telegram: ' + tgResult.description });
      }

      sentMessageId = tgResult.result.message_id;
      if (tgResult.result.photo) {
        const photos = tgResult.result.photo;
        file_id = photos[photos.length - 1].file_id;
      }

      // Simpan Balasan ke `permintaan`
      const newReplyRef = db.collection('permintaan').doc();
      const replyData = {
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
        file_id: file_id,
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
      };
      await newReplyRef.set(replyData);

      // Update status Tiket Utama ke PROGRESS & timestamp_taken
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
