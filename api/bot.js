import { Telegraf } from 'telegraf';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('Bot Webhook Active!');
  }

  // Gunakan Environment Variable atau Langsung Token
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8772387175:AAEB_JYpOSDWJTuIya3yLsSqohCL8i4mTOw';

  // Pengecekan sederhana: cukup cek apakah BOT_TOKEN ada nilainya
  if (!BOT_TOKEN) {
    console.error('ERROR: Token Bot belum diisi!');
    return res.status(500).json({ error: 'Token Bot belum diisi' });
  }

  try {
    const bot = new Telegraf(BOT_TOKEN);

    bot.on('message', async (ctx) => {
      try {
        await ctx.reply('haloo', {
          reply_to_message_id: ctx.message.message_id
        });
      } catch (err) {
        console.error('Gagal kirim:', err);
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
