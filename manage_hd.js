import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, doc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// =========================================================
// 1. KONFIGURASI FIREBASE CLIENT (Sesuaikan dengan milik Anda)
// =========================================================
const firebaseConfig = {
  apiKey: "AIzaSyYourApiKeyHere",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// DOM ELEMENT
const userForm = document.getElementById('user-form');
const tableBody = document.getElementById('user-table-body');
const totalUsersBadge = document.getElementById('total-users');
const btnSubmit = document.getElementById('btn-submit');

// =========================================================
// 2. TIMPAN / INPUT USER BARU
// =========================================================
userForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const nik = document.getElementById('nik-hd').value.trim();
  const nama = document.getElementById('nama-hd').value.trim();
  const password = document.getElementById('password-hd').value.trim();
  const segmen = document.getElementById('segmen-hd').value;
  const idTelegram = document.getElementById('telegram-hd').value.trim();

  btnSubmit.disabled = true;
  btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;

  try {
    await addDoc(collection(db, 'users'), {
      nik_hd: nik,
      nama_hd: nama,
      password: password,
      segmen: segmen,
      id_telegram_hd: idTelegram || null,
      created_at: serverTimestamp()
    });

    alert("User HD Berhasil Ditambahkan!");
    userForm.reset();

  } catch (err) {
    console.error("Gagal menambah user:", err);
    alert("Terjadi kesalahan saat menyimpan data!");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan User HD`;
  }
});

// =========================================================
// 3. LISTEN REALTIME DATA USER
// =========================================================
function listenUsers() {
  const qUsers = query(collection(db, 'users'));

  onSnapshot(qUsers, (snapshot) => {
    tableBody.innerHTML = '';
    totalUsersBadge.textContent = `Total: ${snapshot.size}`;

    if (snapshot.empty) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="p-4 text-center text-slate-400">Belum ada user terdaftar.</td>
        </tr>
      `;
      return;
    }

    snapshot.forEach((docSnap) => {
      const user = docSnap.data();
      const row = document.createElement('tr');
      row.className = "hover:bg-slate-50 transition";

      row.innerHTML = `
        <td class="p-3 font-semibold text-slate-800">${user.nik_hd || '-'}</td>
        <td class="p-3 font-medium text-slate-800">${user.nama_hd || '-'}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded text-[10px] uppercase border border-indigo-200">
            ${user.segmen || '-'}
          </span>
        </td>
        <td class="p-3 font-mono text-[11px] text-slate-500">${user.id_telegram_hd || '-'}</td>
        <td class="p-3 text-center">
          <button onclick="window.deleteUser('${docSnap.id}')" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-md text-[11px] font-semibold transition border border-rose-200">
            <i class="fa-solid fa-trash"></i> Hapus
          </button>
        </td>
      `;

      tableBody.appendChild(row);
    });
  });
}

// =========================================================
// 4. HAPUS USER
// =========================================================
window.deleteUser = async (docId) => {
  if (!confirm("Apakah Anda yakin ingin menghapus user ini?")) return;

  try {
    await deleteDoc(doc(db, 'users', docId));
    alert("User berhasil dihapus!");
  } catch (err) {
    console.error("Gagal menghapus user:", err);
    alert("Gagal menghapus user!");
  }
};

// JALANKAN SAAT HALAMAN DIBUKA
listenUsers();
