// api/send-reply.js
import admin from 'firebase-admin';
import { Telegraf } from 'telegraf';

const parsePrivateKey = (key) => {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n').replace(/"/g, '');
};

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: parsePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
      }),
    });
  } catch (err) {
    console.error('Firebase Admin Init Error:', err);
  }
}

const db = admin.firestore();

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
  } = req.body || {};

  if (!tiket_id || (!pesan && !image_base64)) {
    return res.status(400).json({ error: 'Data balasan tidak lengkap (butuh pesan atau gambar)' });
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN belum diset di Vercel' });
  }

  const bot = new Telegraf(BOT_TOKEN);

  try {
    let telegramMsg = null;
    const captionText = `💬 *Balasan HD (${nama_hd})*:\n${pesan || ''}`;

    // 1. Kirim ke Telegram Teknisi
    if (image_base64) {
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
      telegramMsg = await bot.telegram.sendMessage(chat_id, captionText, {
        parse_mode: 'Markdown',
        reply_to_message_id: message_id_utama
      });
    }

    // 2. Simpan record balasan ke Firestore (tabel permintaan)
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
      kategori_pekerjaan: kategori_pekerjaan || null,
      pesan: pesan || '',
      file_id: image_base64 ? 'PHOTO_ATTACHED' : null,
      id_telegram_hd: id_telegram_hd || nik_hd,
      nama_hd: nama_hd,
      nik_hd: nik_hd,
      status: null,
      timestamp_created: admin.firestore.FieldValue.serverTimestamp()
    };

    await newDocRef.set(replyData);

    return res.status(200).json({ success: true, id_permintaan: newDocRef.id });
  } catch (err) {
    console.error('Error sending reply:', err);
    return res.status(500).json({ error: err.message || 'Gagal mengirim pesan' });
  }
}
