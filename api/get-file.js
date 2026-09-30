import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { file_id } = req.query;
  if (!file_id) return res.status(400).json({ error: 'file_id required' });

  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

  try {
    // Split file_id berdasarkan koma jika ada lebih dari 1 file
    const fileIds = String(file_id).split(',').map(id => id.trim()).filter(Boolean);

    const urls = await Promise.all(
      fileIds.map(async (id) => {
        try {
          const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${id}`);
          const tgData = await tgRes.json();
          if (tgData.ok && tgData.result.file_path) {
            return `https://api.telegram.org/file/bot${BOT_TOKEN}/${tgData.result.file_path}`;
          }
          return null;
        } catch (e) {
          return null;
        }
      })
    );

    const validUrls = urls.filter(Boolean);

    return res.status(200).json({ 
      success: true, 
      urls: validUrls,
      url: validUrls[0] || null // fallback untuk backward compatibility
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
