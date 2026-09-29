import { Telegraf } from 'telegraf';

export default async function handler(req, res) {
  // Hanya terima HTTP POST dari Telegram Webhook
  if (req.method !== 'POST') {
    return res.status(200).send('Bot Webhook Active!');
  }

  // Ambil token murni dari Environment Variable Vercel
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  // Cek apakah variabel sudah terpasang di Vercel
  if (!BOT_TOKEN) {
    console.error('ERROR: TELEGRAM_BOT_TOKEN tidak ditemukan di Vercel Environment Variables!');
    return res.status(500).json({ 
      error: 'TELEGRAM_BOT_TOKEN belum dikonfigurasi di Environment Variables Vercel.' 
    });
  }

  try {
    const bot = new Telegraf(BOT_TOKEN);

    // Respon balasan tes sederhana
    bot.on('message', async (ctx) => {
      try {
        await ctx.reply('haloo', {
          reply_to_message_id: ctx.message.message_id
        });
      } catch (err) {
        console.error('Gagal membalas pesan:', err);
      }
    });

    // Proses payload dari Telegram
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
