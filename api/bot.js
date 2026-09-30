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

// Helper untuk mendeteksi segmen dan hashtag dari pesan
function detectSegmen(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('#moban')) return { code: 'B2C', tag: '#moban' };
  if (lower.includes('#helprekan')) return { code: 'B2B', tag: '#helprekan' };
  if (lower.includes('#tolong')) return { code: 'PROVI', tag: '#tolong' };
  return null;
}

// Helper untuk mengambil file_id dari foto/video/dokumen
function extractFileIds(message) {
  const fileIds = [];
  if (message.photo && message.photo.length > 0) {
    // Ambil resolusi foto tertinggi
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
        const currentFileId = extractFileIds(message);
        const mediaGroupId = message.media_group_id || null;

        // ====================================================
        // 1. PENANGANAN MEDIA GROUP / ALBUM FOTO BANYAK
        // ====================================================
        if (mediaGroupId && currentFileId) {
          // Cek apakah foto/file dari album ini sudah terdaftar sebelumnya
          const groupSnapshot = await db.collection('permintaan')
            .where('chat_id', '==', message.chat.id)
            .where('media_group_id', '==', mediaGroupId)
            .limit(1)
            .get();

          if (!groupSnapshot.empty) {
            // Jika ini foto ke-2, ke-3, dst dalam album yang sama
            const existingDoc = groupSnapshot.docs[0];
            const existingData = existingDoc.data();

            const oldFileIds = existingData.file_id ? existingData.file_id.split(',') : [];
            if (!oldFileIds.includes(currentFileId)) {
              oldFileIds.push(currentFileId);
              const updatedFileIds = oldFileIds.join(',');

              // Update baris yang sama dengan menambahkan file_id dipisahkan koma
              await db.collection('permintaan').doc(existingDoc.id).update({
                file_id: updatedFileIds
              });
            }
            return; // Selesai, tidak membuat dokumen baru di Firestore
          }
        }

        // ====================================================
        // 2. PEMBUATAN TIKET UTAMA (Pesan Baru dengan Hashtag)
        // ====================================================
        if (segmenInfo) {
          const newDocRef = db.collection('permintaan').doc();
          const generatedId = newDocRef.id;

          const mainTicketData = {
            id_permintaan: generatedId,
            tiket_id: generatedId, // tiket_id diisi ID dokumen ini sendiri
            msg_type: 'UTAMA',
            sender_type: 'TELEGRAM',
            chat_id: message.chat.id,
            thread_id: message.message_thread_id || null,
            message_id: message.message_id,
            reply_to_message_id: null,
            media_group_id: mediaGroupId,
            segmen: segmenInfo.code,
            kategori_pekerjaan: segmenInfo.tag,
            pesan: text,
            file_id: currentFileId,
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

        // ====================================================
        // 3. PESAN BALASAN / REPLY (Ke Pesan Utama ATAU Balasan Lain)
        // ====================================================
        if (message.reply_to_message) {
          const parentMessageId = message.reply_to_message.message_id;

          // Cari pesan induk tanpa membatasi msg_type ('UTAMA' maupun 'BALASAN' bisa direply)
          const snapshot = await db.collection('permintaan')
            .where('chat_id', '==', message.chat.id)
            .where('message_id', '==', parentMessageId)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const parentDoc = snapshot.docs[0];
            const parentData = parentDoc.data();
            const parentTiketId = parentData.tiket_id; // Selalu mengacu pada tiket_id yang sama

            const newReplyRef = db.collection('permintaan').doc();
            const replyGeneratedId = newReplyRef.id;

            const replyTicketData = {
              id_permintaan: replyGeneratedId,
              tiket_id: parentTiketId, // Menyambung ke tiket_id utama
              msg_type: 'BALASAN',
              sender_type: 'TELEGRAM',
              chat_id: message.chat.id,
              thread_id: message.message_thread_id || null,
              message_id: message.message_id,
              reply_to_message_id: parentMessageId,
              media_group_id: mediaGroupId,
              segmen: parentData.segmen,
              kategori_pekerjaan: parentData.kategori_pekerjaan,
              pesan: text,
              file_id: currentFileId,
              id_telegram_teknisi: message.from.id,
              nama_teknisi: [message.from.first_name, message.from.last_name].filter(Boolean).join(' '),
              username_teknisi: message.from.username || null,
              id_telegram_hd: null,
              status: null,
              keterangan: null,
              timestamp_created: admin.firestore.FieldValue.serverTimestamp(),
              timestamp_taken: null,
              timestamp_close: null
            };

            await newReplyRef.set(replyTicketData);

            // Re-Open Tiket Utama jika teknisi mengirim balasan baru
            const mainSnapshot = await db.collection('permintaan')
              .where('tiket_id', '==', parentTiketId)
              .where('msg_type', '==', 'UTAMA')
              .limit(1)
              .get();

            if (!mainSnapshot.empty) {
              await db.collection('permintaan').doc(mainSnapshot.docs[0].id).update({
                status: 'OPEN',
                timestamp_close: null
              });
            }

            try { await ctx.react('👀'); } catch (e) {}
            return;
          }
        }

        // ====================================================
        // 4. PESAN DITOLAK (Jika tanpa hashtag dan bukan reply tiket valid)
        // ====================================================
        await ctx.reply('⚠️ Mohon sertakan hashtag segmen (#moban, #helprekan, #tolong) untuk membuat tiket baru, atau balas (reply) ke pesan tiket/balasan yang sudah ada.', {
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
