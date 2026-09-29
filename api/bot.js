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

function detectSegmen(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('#moban')) return { code: 'B2C', tag: '#moban' };
  if (lower.includes('#helprekan')) return { code: 'B2B', tag: '#helprekan' };
  if (lower.includes('#tolong')) return { code: 'PROVI', tag: '#tolong' };
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Bot Webhook Endpoint Ready');
  }

  // 1. Ambil token (GANTI STRING HARDCODE JIKA DIBUTUHKAN Cepat)
  //const token = process.env.TELEGRAM_BOT_TOKEN;
  const token = process.env.TELEGRAM_BOT_TOKEN || '8772387175:AAEB_JYpOSDWJTuIya3yLsSqohCL8i4mTOw';

  // Jika token kosong, langsung cegah eksekusi Telegraf agar tidak crash 401
  if (!token || token.trim() === '') {
    console.error('CRITICAL: TELEGRAM_BOT_TOKEN kosong!');
    return res.status(500).json({ 
      status: 'error', 
      message: 'TELEGRAM_BOT_TOKEN tidak terdeteksi di Environment Variable Vercel.' 
    });
  }

  // 2. Inisialisasi Telegraf
  const bot = new Telegraf(token);

  // 3. Handler Logika Bot Telegram
  bot.on(['text', 'photo', 'video', 'document'], async (ctx) => {
    try {
      const message = ctx.message;
      if (!message) return;

      const text = message.text || message.caption || '';
      const segmenInfo = detectSegmen(text);

      // A. TIKET BARU HASHTAG
      if (segmenInfo) {
        let attachments = [];
        if (message.photo) attachments.push({ type: 'photo', file_id: message.photo[message.photo.length - 1].file_id });
        if (message.video) attachments.push({ type: 'video', file_id: message.video.file_id });
        if (message.document) attachments.push({ type: 'document', file_id: message.document.file_id });

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
          status: 'OPEN',
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          replies: []
        };

        const docRef = await db.collection('permintaan').add(ticketData);

        try { await ctx.react('👍'); } catch (e) {}

        await ctx.reply(`✅ Tiket Berhasil Dibuat!\n📌 ID Tiket: ${docRef.id}\n🏷️ Segmen: ${segmenInfo.code}`, {
          reply_to_message_id: message.message_id
        });
        return;
      }

      // B. BALASAN TIKET (REPLY)
      if (message.reply_to_message) {
        const parentMessageId = message.reply_to_message.message_id;

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

          await db.collection('permintaan').doc(ticketDoc.id).update({
            replies: admin.firestore.FieldValue.arrayUnion(replyData),
            updated_at: admin.firestore.FieldValue.serverTimestamp()
          });

          try { await ctx.react('👀'); } catch (e) {}
          return;
        }
      }

      // C. PESAN TIDAK VALID
      await ctx.reply('⚠️ Mohon sertakan hashtag segmen (#moban, #helprekan, #tolong) untuk membuat tiket baru, atau balas (reply) ke pesan tiket yang sudah ada.', {
        reply_to_message_id: message.message_id
      });

    } catch (err) {
      console.error('Error Processing Message:', err);
    }
  });

  // 4. Jalankan Webhook tanpa memanggil API verifikasi getMe
  try {
    await bot.handleUpdate(req.body, res);
    if (!res.headersSent) {
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('Webhook Handling Error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
  }
}
