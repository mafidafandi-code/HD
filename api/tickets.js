import { db } from './_firebase.js';

export default async function handler(req, res) {
  const { action, segmen, tiket_id, start_date, end_date } = req.query;

  try {
    // 1. Ambil List Tiket Utama berdasarkan Segmen
    if (action === 'get_tickets') {
      if (!segmen) return res.status(400).json({ error: 'Segmen required' });

      const snapshot = await db.collection('permintaan')
        .where('msg_type', '==', 'UTAMA')
        .get();

      const userSegmen = String(segmen).trim().toUpperCase();
      const tickets = [];

      snapshot.forEach(doc => {
        const d = doc.data();
        if ((d.segmen || '').trim().toUpperCase() === userSegmen) {
          tickets.push({
            ...d,
            timestamp_created: d.timestamp_created?.toDate?.() || null,
            timestamp_taken: d.timestamp_taken?.toDate?.() || null,
            timestamp_close: d.timestamp_close?.toDate?.() || null,
          });
        }
      });

      // Sort tiket dari yang terbaru
      tickets.sort((a, b) => new Date(b.timestamp_created || 0) - new Date(a.timestamp_created || 0));

      return res.status(200).json({ success: true, tickets });
    }

    // 2. Ambil History Chat lengkap per Tiket ID
    if (action === 'get_chat') {
      if (!tiket_id) return res.status(400).json({ error: 'tiket_id required' });

      const snapshot = await db.collection('permintaan')
        .where('tiket_id', '==', tiket_id)
        .get();

      const messages = [];
      snapshot.forEach(doc => {
        const d = doc.data();
        messages.push({
          ...d,
          timestamp_created: d.timestamp_created?.toDate?.() || null
        });
      });

      messages.sort((a, b) => new Date(a.timestamp_created || 0) - new Date(b.timestamp_created || 0));

      return res.status(200).json({ success: true, messages });
    }

    // 3. Ambil Data Analisa
    if (action === 'get_analytics') {
      if (!segmen) return res.status(400).json({ error: 'Segmen required' });

      const snapshot = await db.collection('permintaan').get();
      const userSegmen = String(segmen).trim().toUpperCase();

      let totalTiket = 0;
      let closedCount = 0;
      let responseTimes = [];
      let hdActivity = {};

      const startFilter = start_date ? new Date(start_date) : null;
      const endFilter = end_date ? new Date(end_date + 'T23:59:59') : null;

      snapshot.forEach(doc => {
        const d = doc.data();
        if ((d.segmen || '').trim().toUpperCase() !== userSegmen) return;

        const createdDate = d.timestamp_created?.toDate?.() || null;

        // Apply Date Filter jika diisi
        if (createdDate && startFilter && createdDate < startFilter) return;
        if (createdDate && endFilter && createdDate > endFilter) return;

        if (d.msg_type === 'UTAMA') {
          totalTiket++;
          const statusUpper = (d.status || '').toUpperCase();
          if (statusUpper === 'CLOSED') closedCount++;

          if (d.timestamp_created && d.timestamp_taken) {
            const created = d.timestamp_created.toDate();
            const taken = d.timestamp_taken.toDate();
            const diffMinutes = Math.max(0, Math.round((taken - created) / 60000));
            responseTimes.push(diffMinutes);
          }
        } else if (d.msg_type === 'BALASAN' && d.sender_type === 'HD') {
          const hdName = d.nama_hd || 'Unknown HD';
          hdActivity[hdName] = (hdActivity[hdName] || 0) + 1;
        }
      });

      const avgResponse = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;

      return res.status(200).json({
        success: true,
        analytics: {
          totalTiket,
          closedCount,
          openCount: totalTiket - closedCount,
          avgResponseMinutes: avgResponse,
          hdActivity
        }
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
