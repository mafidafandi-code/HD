import { Telegraf } from 'telegraf';

export default async function handler(req, res) {
  // Hanya terima method POST dari Telegram Webhook
  if (req.method !== 'POST') {
    return res.status(200).send('Bot Webhook Active!');
  }

  // 1. Ganti string di bawah ini LANGSUNG dengan Token BotFather Anda
  // (Menggunakan token langsung di file backend serverless 100% aman dan tidak ter-inspect oleh client)
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8772387175:AAEB_JYpOSDWJTuIya3yLsSqohCL8i4mTOw';

  if (!BOT_TOKEN || BOT_TOKEN.includes('8772387175:AAEB_JYpOSDWJTuIya3yLsSqohCL8i4mTOw')) {
    console.error('ERROR: Token Bot belum diisi!');
    return res.status(500).json({ error: 'Token Bot belum diisi di kode atau Environment Variable Vercel' });
  }

  try {
    const bot = new Telegraf(BOT_TOKEN);

    // 2. Apapun pesannya, langsung balas "haloo"
    bot.on('message', async (ctx) => {
      try {
        await ctx.reply('haloo', {
          reply_to_message_id: ctx.message.message_id
        });
      } catch (err) {
        console.error('Gagal mengirim balasan haloo:', err);
      }
    });

    // 3. Jalankan pengolahan pesan dari Telegram
    await bot.handleUpdate(req.body, res);

    if (!res.headersSent) {
      return res.status(200).json({ ok: true });
    }
  } catch (error) {
    console.error('Webhook Handler Error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: error.message });
    }
  }
}
