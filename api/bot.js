import admin from 'firebase-admin';
import { Telegraf } from 'telegraf';

// 1. Inisialisasi Firebase Admin
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

// Deteksi segmen hashtag
function detectSegmen(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('#moban')) return { code: 'B2C', tag: '#moban' };
  if (lower.includes('#helprekan')) return { code: 'B2B', tag: '#helprekan' };
  if (lower.includes('#tolong')) return { code: 'PROVI', tag: '#tolong' };
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Bot Webhook Endpoint Active');
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  if (!BOT_TOKEN) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN belum terpasang di Vercel.');
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  }

  try {
    const bot = new Telegraf(BOT_TOKEN);

    bot.on(['text', 'photo', 'video', 'document'], async (ctx) => {
      try {
        const message = ctx.message;
        if (!message) return;

        const text = message.text || message.caption || '';
        const segmenInfo = detectSegmen(text);

        // Ekstraksi lampiran media jika ada
        let attachments = [];
        if (message.photo) {
          attachments.push({ type: 'photo', file_id: message.photo[message.photo.length - 1].file_id });
        }
        if (message.video) {
          attachments.push({ type: 'video', file_id: message.video.file_id });
        }
        if (message.document) {
          attachments.push({ type: 'document', file_id: message.document.file_id });
        }

        // ==========================================
        // A. BARIS DATA BARU: TIKET UTAMA (Memiliki Hashtag)
        // ==========================================
        if (segmenInfo) {
          const mainTicketData = {
            type: 'TIKET_UTAMA',
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
            pesan: text,
            lampiran: attachments,
            status: 'OPEN',
            created_at: admin.firestore.FieldValue.serverTimestamp()
          };

          // Simpan sebagai baris dokumen baru di koleksi 'permintaan'
          const docRef = await db.collection('permintaan').add(mainTicketData);

          try { await ctx.react('👍'); } catch (e) {}

          await ctx.reply(`✅ Tiket Berhasil Dibuat!\n📌 ID Tiket: ${docRef.id}\n🏷️ Segmen: ${segmenInfo.code}`, {
            reply_to_message_id: message.message_id
          });
          return;
        }

        // ==========================================
        // B. BARIS DATA BARU: BALASAN (Reply Message)
        // ==========================================
        if (message.reply_to_message) {
          const parentMessageId = message.reply_to_message.message_id;

          // Cari tiket utama berdasarkan chat_id dan message_id yang di-reply
          const snapshot = await db.collection('permintaan')
            .where('chat_id', '==', message.chat.id)
            .where('message_id', '==', parentMessageId)
            .where('type', '==', 'TIKET_UTAMA')
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const mainDoc = snapshot.docs[0];
            const mainTicketId = mainDoc.id; // Mengambil ID dari tiket utama

            const replyTicketData = {
              type: 'BALASAN',
              permintaan_id: mainTicketId, // ID tiket utama tempat balasan ini merujuk
              message_id: message.message_id,
              chat_id: message.chat.id,
              parent_message_id: parentMessageId,
              from_user: {
                id: message.from.id,
                username: message.from.username || '',
                first_name: message.from.first_name || '',
                last_name: message.from.last_name || ''
              },
              segmen: mainDoc.data().segmen, // Mengikuti segmen dari tiket utamanya
              pesan: text,
              lampiran: attachments,
              created_at: admin.firestore.FieldValue.serverTimestamp()
            };

            // Simpan BALASAN ini sebagai baris/dokumen BARU tersendiri
            await db.collection('permintaan').add(replyTicketData);

            // Opsional: Update timestamp updated_at pada dokumen tiket utama
            await db.collection('permintaan').doc(mainTicketId).update({
              updated_at: admin.firestore.FieldValue.serverTimestamp()
            });

            try { await ctx.react('👀'); } catch (e) {}
            return;
          }
        }

        // ==========================================
        // C. PESAN DITOLAK
        // ==========================================
        await ctx.reply('⚠️ Mohon sertakan hashtag segmen (#moban, #helprekan, #tolong) untuk membuat tiket baru, atau balas (reply) ke pesan tiket yang sudah ada.', {
          reply_to_message_id: message.message_id
        });

      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    await bot.handleUpdate(req.body, res);

    if (!res.headersSent) {
      return res.status(200).json({ ok: true });
    }
  } catch (error) {
    console.error('Webhook Handling Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
  }
}
