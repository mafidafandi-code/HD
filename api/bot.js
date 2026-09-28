const { Telegraf } = require('telegraf');
const admin = require('firebase-admin');

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

// Helper function untuk mengekstrak lampiran (Foto / Video / Dokumen)
function extractFiles(message) {
  const files = [];

  if (message.photo) {
    // Ambil resolusi tertinggi (elemen terakhir dari array photo)
    const highestResPhoto = message.photo[message.photo.length - 1];
    files.push({
      file_id: highestResPhoto.file_id,
      type: 'photo',
    });
  } else if (message.video) {
    files.push({
      file_id: message.video.file_id,
      type: 'video',
    });
  } else if (message.document) {
    files.push({
      file_id: message.document.file_id,
      type: 'document',
    });
  }

  return files;
}

// Handler Pesan
bot.on(['text', 'photo', 'video', 'document'], async (ctx) => {
  try {
    const message = ctx.message;
    const text = message.text || message.caption || '';
    const chatId = message.chat.id.toString();
    const messageId = message.message_id.toString();
    const threadId = message.message_thread_id ? message.message_thread_id.toString() : null;

    // 1. Deteksi Hashtag & Tentukan Segmen/Unit
    let segmen = null;
    if (text.includes('#moban')) {
      segmen = 'B2C';
    } else if (text.includes('#helprekan')) {
      segmen = 'B2B';
    } else if (text.includes('#tolong')) {
      segmen = 'PROVI';
    }

    // A. JIKA DITEMUKAN HASHTAG VALID (BUAT TIKET BARU)
    if (segmen) {
      const user = message.from;
      const idTelegramTeknisi = user.id.toString();
      const namaTeknisi = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const usernameTeknisi = user.username || '';

      const files = extractFiles(message);
      const tiketId = 'TK-' + Date.now().toString().slice(-6);

      const dataPermintaan = {
        tiket_id: tiketId,
        wo_utama: '',
        chat_id: chatId,
        tread_id: threadId,
        message_id: messageId,
        file_id: files.length > 0 ? files[0].file_id : '', // kompatibilitas kolom lama
        files: files, // Array untuk menampung banyak file/media
        pesan: text,
        id_telegram_teknisi: idTelegramTeknisi,
        nama_teknisi: namaTeknisi,
        username_teknisi: usernameTeknisi,
        id_telegram_hd: '',
        nama_hd: '',
        nik_hd: '',
        kategori_pekerjaan: '',
        segmen: segmen, // B2C, B2B, atau PROVI
        keterangan: '',
        status: 'open',
        timestamp_created: admin.firestore.FieldValue.serverTimestamp(),
        timestamp_taken: null,
        timestamp_close: null,
        logs_chat: [
          {
            sender_type: 'teknisi',
            sender_name: namaTeknisi,
            message: text,
            files: files,
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await db.collection('permintaan').add(dataPermintaan);

      // Beri Reaksi Emoji 👀 pada pesan teknisi
      await ctx.react([{ type: 'emoji', emoji: '👀' }]);
      return;
    }

    // B. JIKA PESAN ADALAH REPLIES / BALASAN DARI TEKNISI
    if (message.reply_to_message) {
      const repliedMessageId = message.reply_to_message.message_id.toString();

      const snapshot = await db
        .collection('permintaan')
        .where('chat_id', '==', chatId)
        .where('message_id', '==', repliedMessageId)
        .get();

      if (!snapshot.empty) {
        const docRef = snapshot.docs[0].ref;
        const tiketData = snapshot.docs[0].data();
        const files = extractFiles(message);

        const newLog = {
          sender_type: 'teknisi',
          sender_name: `${message.from.first_name || ''} ${message.from.last_name || ''}`.trim(),
          message: text,
          files: files,
          timestamp: new Date().toISOString(),
        };

        const updateData = {
          logs_chat: admin.firestore.FieldValue.arrayUnion(newLog),
        };

        // Jika tiket Closed lalu direply teknisi, ubah status kembali ke Open (Re-open)
        if (tiketData.status === 'closed') {
          updateData.status = 'open';
        }

        await docRef.update(updateData);

        // Beri reaksi emoji 👍
        await ctx.react([{ type: 'emoji', emoji: '👍' }]);
      }
    }
  } catch (error) {
    console.error('Error Telegram Webhook:', error);
  }
});

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('Webhook Error:', err);
      res.status(500).send('Error');
    }
  } else {
    res.status(200).send('Bot Telegram Active!');
  }
};
