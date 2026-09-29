import admin from 'firebase-admin';

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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { tiket_id, status } = req.body;
  if (!tiket_id || !status) return res.status(400).json({ error: 'tiket_id dan status wajib diisi' });

  try {
    const snapshot = await db.collection('permintaan')
      .where('tiket_id', '==', tiket_id)
      .where('msg_type', '==', 'UTAMA')
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({ error: 'Tiket tidak ditemukan' });
    }

    const docRef = snapshot.docs[0].ref;
    const updateData = { status: status };

    if (status === 'CLOSED') {
      updateData.timestamp_close = admin.firestore.FieldValue.serverTimestamp();
    } else if (status === 'OPEN') {
      updateData.timestamp_close = null;
    }

    await docRef.update(updateData);

    return res.status(200).json({ success: true, message: `Status tiket diubah ke ${status}` });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
