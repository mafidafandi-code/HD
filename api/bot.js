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

// Helper untuk mendeteksi segmen dan hashtag
function detectSegmen(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('#moban')) return { code: 'B2C', tag: '#moban' };
  if (lower.includes('#helprekan')) return { code: 'B2B', tag: '#helprekan' };
  if (lower.includes('#tolong')) return { code: 'PROVI', tag: '#tolong' };
  return null;
}

// Helper untuk mengekstrak file_id dan menggabungkannya dengan koma
function extractFileIds(message) {
  const fileIds = [];
  if (message.photo && message.photo.length > 0) {
    fileIds.push(message.photo[message.photo.length - 1].file_id);
  }
  if (message.video) {
    fileIds.push(message.video.file_id);
  }
  if (message.document) {
    fileIds.push(message.document.file_id);
  }
  return fileIds.length > 0 ? fileIds.join(',') : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Bot Webhook Active');
  }

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN belum dikonfigurasi.');
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
        const fileIdString = extractFileIds(message);

        // ==========================================
        // A. BARIS DATA BARU: TIKET UTAMA (Pesan ber-Hashtag)
        // ==========================================
        if (segmenInfo) {
          // Buat docRef dulu untuk mendapatkan ID Unik (id_permintaan)
          const newDocRef = db.collection('permintaan').doc();
          const generatedId = newDocRef.id;

          const mainTicketData = {
            id_permintaan: generatedId,
            tiket_id: generatedId, // Untuk Tiket Utama, tiket_id diisi ID ini sendiri
            msg_type: 'UTAMA',
            sender_type: 'TELEGRAM',
            chat_id: message.chat.id,
            thread_id: message.message_thread_id || null,
            message_id: message.message_id,
            reply_to_message_id: null,
            segmen: segmenInfo.code,
            kategori_pekerjaan: segmenInfo.tag,
            pesan: text,
            file_id: fileIdString,
            id_telegram_teknisi: message.from.id,
            nama_teknisi: [message.from.first_name, message.from.last_name].filter(Boolean).join(' '),
            username_teknisi: message.from.username || null,
            id_telegram_hd: null,
            status: 'OPEN',
            keterangan: null,
            timestamp_created: admin.firestore.FieldValue.serverTimestamp(),
            timestamp_taken: null,
            timestamp_close: null
          };

          await newDocRef.set(mainTicketData);

          try { await ctx.react('👍'); } catch (e) {}

          await ctx.reply(`✅ Tiket Berhasil Dibuat!\n📌 ID Tiket: ${generatedId}\n🏷️ Segmen: ${segmenInfo.code}`, {
            reply_to_message_id: message.message_id
          });
          return;
        }

        // ==========================================
        // B. BARIS DATA BARU: BALASAN (Reply Message)
        // ==========================================
        if (message.reply_to_message) {
          const parentMessageId = message.reply_to_message.message_id;

          // 1. Cari Tiket Utama di mana chat_id dan message_id cocok dengan pesan yang di-reply
          const snapshot = await db.collection('permintaan')
            .where('chat_id', '==', message.chat.id)
            .where('message_id', '==', parentMessageId)
            .where('msg_type', '==', 'UTAMA')
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const mainDoc = snapshot.docs[0];
            const mainData = mainDoc.data();
            const parentTiketId = mainData.tiket_id;

            const newReplyRef = db.collection('permintaan').doc();
            const replyGeneratedId = newReplyRef.id;

            const replyTicketData = {
              id_permintaan: replyGeneratedId,
              tiket_id: parentTiketId, // Merujuk ke tiket_id Tiket Utama
              msg_type: 'BALASAN',
              sender_type: 'TELEGRAM',
              chat_id: message.chat.id,
              thread_id: message.message_thread_id || null,
              message_id: message.message_id,
              reply_to_message_id: parentMessageId,
              segmen: mainData.segmen,
              kategori_pekerjaan: mainData.kategori_pekerjaan,
              pesan: text,
              file_id: fileIdString,
              id_telegram_teknisi: message.from.id,
              nama_teknisi: [message.from.first_name, message.from.last_name].filter(Boolean).join(' '),
              username_teknisi: message.from.username || null,
              id_telegram_hd: null,
              status: null, // Pesan balasan tidak perlu status
              keterangan: null,
              timestamp_created: admin.firestore.FieldValue.serverTimestamp(),
              timestamp_taken: null,
              timestamp_close: null
            };

            // Simpan baris balasan baru
            await newReplyRef.set(replyTicketData);

            // 2. RE-OPEN TIKET UTAMA: Kembalikan status Tiket Utama ke 'OPEN' & reset timestamp_close
            await db.collection('permintaan').doc(mainDoc.id).update({
              status: 'OPEN',
              timestamp_close: null
            });

            try { await ctx.react('👀'); } catch (e) {}
            return;
          }
        }

        // ==========================================
        // C. PESAN DITOLAK (Tanpa Hashtag & Bukan Reply Tiket Valid)
        // ==========================================
        await ctx.reply('⚠️ Mohon sertakan hashtag segmen (#moban, #helprekan, #tolong) untuk membuat tiket baru, atau balas (reply) ke pesan tiket yang sudah ada.', {
          reply_to_message_id: message.message_id
        });

      } catch (err) {
        console.error('Error Processing Message:', err);
      }
    });

    await bot.handleUpdate(req.body, res);

    if (!res.headersSent) {
      return res.status(200).json({ ok: true });
    }
  } catch (error) {
    console.error('Webhook Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
  }
}
