import admin from 'firebase-admin';
import { Telegraf } from 'telegraf';

// Inisialisasi Firebase Admin
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
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Fungsi pendeteksi segmen dari hashtag
function detectSegmen(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('#moban')) return { code: 'B2C', tag: '#moban' };
  if (lower.includes('#helprekan')) return { code: 'B2B', tag: '#helprekan' };
  if (lower.includes('#tolong')) return { code: 'PROVI', tag: '#tolong' };
  return null;
}

// Handler Utama Pesan Telegram
bot.on(['text', 'photo', 'video', 'document'], async (ctx) => {
  try {
    const message = ctx.message;
    const text = message.text || message.caption || '';
    const segmenInfo = detectSegmen(text);

    // A. PESAN MERUPAKAN TIKET BARU (Mengandung Hashtag)
    if (segmenInfo) {
      // Ambil file ID lampiran jika ada (foto/video/dokumen)
      let attachments = [];
      if (message.photo) {
        // Ambil resolusi foto tertinggi
        const highestPhoto = message.photo[message.photo.length - 1];
        attachments.push({ type: 'photo', file_id: highestPhoto.file_id });
      }
      if (message.video) {
        attachments.push({ type: 'video', file_id: message.video.file_id });
      }
      if (message.document) {
        attachments.push({ type: 'document', file_id: message.document.file_id });
      }

      const ticketData = {
        message_id: message.message_id,
        chat_id: message.chat.id,
        from_user: {
          id: message.from.id,
          username: message.from.username || '',
          first_name: message.from.first_name || '',
          last_name: message.from.last_name || ''
        },
        segmen: segmenInfo.code,
        hashtag: segmenInfo.tag,
        pesan_awal: text,
        lampiran: attachments,
        status: 'OPEN', // OPEN, IN_PROGRESS, RESOLVED
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
        replies: []
      };

      // Simpan tiket baru ke koleksi 'permintaan'
      const docRef = await db.collection('permintaan').add(ticketData);

      // Reaksi Emoji & Balasan Bot
      try {
        await ctx.react('👍'); // Mengirim reaksi emoji jempol
      } catch (e) {
        // Abaikan jika grup tidak mendukung emoji reaction
      }

      await ctx.reply(`✅ Tiket Berhasil Dibuat!\n📌 ID Tiket: ${docRef.id}\n🏷️ Segmen: ${segmenInfo.code}`, {
        reply_to_message_id: message.message_id
      });
      return;
    }

    // B. PESAN MERUPAKAN BALASAN / REPLY (TIDAK Mengandung Hashtag)
    if (message.reply_to_message) {
      const parentMessageId = message.reply_to_message.message_id;

      // Cari tiket utama di Firestore berdasarkan parent message_id
      const snapshot = await db.collection('permintaan')
        .where('chat_id', '==', message.chat.id)
        .where('message_id', '==', parentMessageId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const ticketDoc = snapshot.docs[0];
        
        let replyAttachment = null;
        if (message.photo) replyAttachment = { type: 'photo', file_id: message.photo[message.photo.length - 1].file_id };
        if (message.video) replyAttachment = { type: 'video', file_id: message.video.file_id };
        if (message.document) replyAttachment = { type: 'document', file_id: message.document.file_id };

        const replyData = {
          reply_message_id: message.message_id,
          from_user: {
            id: message.from.id,
            username: message.from.username || '',
            first_name: message.from.first_name || ''
          },
          text: text,
          attachment: replyAttachment,
          timestamp: new Date().toISOString()
        };

        // Tambahkan balasan ke array replies & update timestamp
        await db.collection('permintaan').doc(ticketDoc.id).update({
          replies: admin.firestore.FieldValue.arrayUnion(replyData),
          updated_at: admin.firestore.FieldValue.serverTimestamp()
        });

        try {
          await ctx.react('👀');
        } catch (e) {}

        return;
      }
    }

    // C. PESAN TIDAK VALID (Tanpa Hashtag DAN Bukan Reply)
    await ctx.reply('⚠️ Mohon sertakan hashtag segmen (#moban, #helprekan, #tolong) untuk membuat tiket baru, atau balas (reply) ke pesan tiket yang sudah ada.', {
      reply_to_message_id: message.message_id
    });

  } catch (error) {
    console.error('Bot Error:', error);
  }
});

// Handler Vercel Serverless Function
export default async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('Webhook Error:', err);
      res.status(500).send('Internal Error');
    }
  } else {
    res.status(200).send('Telegram Bot Webhook Endpoint Ready');
  }
}
