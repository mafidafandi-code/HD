// Database sementara (In-Memory)
let permintaanDB = [
  { id: 101, pemohon: 'Ahmad Fauzi', namaPermintaan: 'Laptop Workstation', jumlah: 2, status: 'Diproses', keterangan: 'Untuk tim dev baru' },
  { id: 102, pemohon: 'Siti Rahma', namaPermintaan: 'Monitor 27 Inch', jumlah: 1, status: 'Disetujui', keterangan: 'Ganti monitor rusak' },
  { id: 103, pemohon: 'Budi Santoso', namaPermintaan: 'Kursi Ergonomis', jumlah: 5, status: 'Pending', keterangan: 'Kebutuhan ruang meeting' }
];

export default async function handler(req, res) {
  // Atur Header CORS jika diperlukan
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, body } = req;

  try {
    switch (method) {
      // 1. GET: Ambil Semua Data Permintaan
      case 'GET':
        return res.status(200).json({
          success: true,
          data: permintaanDB
        });

      // 2. POST: Tambah Permintaan Baru
      case 'POST': {
        const { pemohon, namaPermintaan, jumlah, status, keterangan } = body;

        if (!pemohon || !namaPermintaan || !jumlah) {
          return res.status(400).json({
            success: false,
            message: 'Pemohon, Nama Permintaan, dan Jumlah wajib diisi!'
          });
        }

        const newItem = {
          id: Date.now(), // Generate ID unik berdasarkan timestamp
          pemohon,
          namaPermintaan,
          jumlah: Number(jumlah),
          status: status || 'Pending',
          keterangan: keterangan || ''
        };

        permintaanDB.unshift(newItem); // Tambahkan ke daftar teratas

        return res.status(201).json({
          success: true,
          message: 'Data permintaan berhasil ditambahkan',
          data: newItem
        });
      }

      // 3. PUT: Update Permintaan
      case 'PUT': {
        const { id, pemohon, namaPermintaan, jumlah, status, keterangan } = body;

        const index = permintaanDB.findIndex((item) => item.id === Number(id));

        if (index === -1) {
          return res.status(404).json({
            success: false,
            message: 'Data permintaan tidak ditemukan'
          });
        }

        permintaanDB[index] = {
          ...permintaanDB[index],
          pemohon: pemohon || permintaanDB[index].pemohon,
          namaPermintaan: namaPermintaan || permintaanDB[index].namaPermintaan,
          jumlah: jumlah !== undefined ? Number(jumlah) : permintaanDB[index].jumlah,
          status: status || permintaanDB[index].status,
          keterangan: keterangan !== undefined ? keterangan : permintaanDB[index].keterangan
        };

        return res.status(200).json({
          success: true,
          message: 'Data permintaan berhasil diperbarui',
          data: permintaanDB[index]
        });
      }

      // 4. DELETE: Hapus Permintaan
      case 'DELETE': {
        const { id } = body;

        const index = permintaanDB.findIndex((item) => item.id === Number(id));

        if (index === -1) {
          return res.status(404).json({
            success: false,
            message: 'Data permintaan tidak ditemukan'
          });
        }

        permintaanDB = permintaanDB.filter((item) => item.id !== Number(id));

        return res.status(200).json({
          success: true,
          message: 'Data permintaan berhasil dihapus'
        });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({
          success: false,
          message: `Method ${method} tidak diizinkan`
        });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan pada server',
      error: error.message
    });
  }
}
