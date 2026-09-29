import admin from 'firebase-admin';
import { Telegraf } from 'telegraf';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    tiket_id,
    pesan,
    image_base64,
    nama_hd,
    nik_hd,
    id_telegram_hd,
    chat_id,
    message_id_utama,
    segmen,
    kategori_pekerjaan
  } = req.body;

  if (!tiket_id || (!pesan && !image_base64)) {
    return res.status(400).json({ error: 'Data balasan tidak lengkap' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const bot = new Telegraf(BOT_TOKEN);

  try {
    let telegramMsg = null;
    const captionText = `💬 *Balasan HD (${nama_hd})*:\n${pesan || ''}`;

    // 1. Kirim Ke Telegram
    if (image_base64) {
      // Jika ada gambar (Base64 dari paste / upload)
      const buffer = Buffer.from(image_base64.split(',')[1], 'base64');
      telegramMsg = await bot.telegram.sendPhoto(
        chat_id,
        { source: buffer },
        {
          caption: captionText,
          parse_mode: 'Markdown',
          reply_to_message_id: message_id_utama
        }
      );
    } else {
      // Jika balasan teks saja
      telegramMsg = await bot.telegram.sendMessage(chat_id, captionText, {
        parse_mode: 'Markdown',
        reply_to_message_id: message_id_utama
      });
    }

    // 2. Simpan Balasan HD ke Collection `permintaan` di Firestore
    const newDocRef = db.collection('permintaan').doc();
    const replyData = {
      id_permintaan: newDocRef.id,
      tiket_id: tiket_id,
      msg_type: 'BALASAN',
      sender_type: 'HD',
      chat_id: chat_id,
      message_id: telegramMsg ? telegramMsg.message_id : null,
      reply_to_message_id: message_id_utama,
      segmen: segmen,
      kategori_pekerjaan: kategori_pekerjaan,
      pesan: pesan || '',
      file_id: image_base64 ? 'PHOTO_ATTACHED' : null,
      id_telegram_hd: id_telegram_hd || nik_hd,
      nama_hd: nama_hd,
      nik_hd: nik_hd,
      status: null,
      timestamp_created: admin.firestore.FieldValue.serverTimestamp()
    };

    await newDocRef.set(replyData);

    return res.status(200).json({ ok: true, id_permintaan: newDocRef.id });
  } catch (err) {
    console.error('Error sending reply via API:', err);
    return res.status(500).json({ error: err.message });
  }
}
