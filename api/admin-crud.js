import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Konfigurasi Firebase Anda
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Load Data Realtime ke Tabel
function loadCrudData() {
  const q = query(collection(db, 'permintaan'), orderBy('timestamp_created', 'desc'));
  
  onSnapshot(q, (snapshot) => {
    const tbody = document.getElementById('crudTableBody');
    if (snapshot.empty) {
      tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">Tidak ada data tiket.</td></tr>`;
      return;
    }

    let rowsHtml = '';
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      
      const badgeColor = 
        data.status === 'CLOSED' ? 'bg-emerald-100 text-emerald-700' :
        data.status === 'PROGRESS' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700';

      rowsHtml += `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="p-4 font-mono text-xs font-semibold text-slate-600">${id.substring(0, 8)}...</td>
          <td class="p-4"><span class="font-bold text-xs bg-slate-100 px-2 py-1 rounded-md">${data.segmen || '-'}</span></td>
          <td class="p-4">${data.nama_teknisi || '-'}</td>
          <td class="p-4 max-w-xs truncate" title="${data.pesan || ''}">${data.pesan || '-'}</td>
          <td class="p-4">
            <span class="text-xs px-2.5 py-1 rounded-full font-semibold ${badgeColor}">
              ${data.status || 'OPEN'}
            </span>
          </td>
          <td class="p-4 text-slate-500">${data.keterangan || '-'}</td>
          <td class="p-4 text-center">
            <div class="flex justify-center gap-2">
              <button onclick="openEditModal('${id}')" class="px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 shadow-sm transition">✏️ Edit</button>
              <button onclick="deleteTicket('${id}')" class="px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg hover:bg-rose-700 shadow-sm transition">🗑️ Hapus</button>
            </div>
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = rowsHtml;
  });
}

// Buka Modal Edit
window.openEditModal = async function(docId) {
  try {
    const docSnap = await getDoc(doc(db, 'permintaan', docId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      document.getElementById('editDocId').value = docId;
      document.getElementById('editStatus').value = data.status || 'OPEN';
      document.getElementById('editSegmen').value = data.segmen || 'B2C';
      document.getElementById('editPesan').value = data.pesan || '';
      document.getElementById('editKeterangan').value = data.keterangan || '';
      
      const modal = document.getElementById('editModal');
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    }
  } catch (err) {
    alert('Gagal mengambil data: ' + err.message);
  }
};

// Tutup Modal
window.closeEditModal = function() {
  const modal = document.getElementById('editModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
};

// Simpan Perubahan (Update)
window.saveEditTicket = async function() {
  const docId = document.getElementById('editDocId').value;
  const newStatus = document.getElementById('editStatus').value;
  const newSegmen = document.getElementById('editSegmen').value;
  const newPesan = document.getElementById('editPesan').value;
  const newKeterangan = document.getElementById('editKeterangan').value;

  try {
    await updateDoc(doc(db, 'permintaan', docId), {
      status: newStatus,
      segmen: newSegmen,
      pesan: newPesan,
      keterangan: newKeterangan
    });
    
    alert('Data berhasil diperbarui!');
    window.closeEditModal();
  } catch (err) {
    alert('Gagal memperbarui data: ' + err.message);
  }
};

// Hapus Tiket (Delete)
window.deleteTicket = async function(docId) {
  if (confirm('Apakah Anda yakin ingin menghapus data ini secara permanen?')) {
    try {
      await deleteDoc(doc(db, 'permintaan', docId));
      alert('Data berhasil dihapus!');
    } catch (err) {
      alert('Gagal menghapus data: ' + err.message);
    }
  }
};

// Jalankan pengambilan data awal
loadCrudData();
