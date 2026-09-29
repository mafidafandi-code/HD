import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
  getFirestore, collection, query, where, onSnapshot, getDocs, doc, updateDoc, addDoc, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// =========================================================
// 1. KONFIGURASI FIREBASE CLIENT (Ganti dengan kredensial Anda)
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

// STATE APLIKASI GLOBAL
let currentUser = null;
let activeTab = 'OPEN'; 
let currentChatTicketId = null;
let currentChatMainDoc = null;
let pastedImageFile = null;
let chartInstance = null;
let unsubscribeTickets = null;
let unsubscribeChat = null;

// ELEMENT DOM
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginForm = document.getElementById('login-form');
const ticketsList = document.getElementById('tickets-list');
const chatModal = document.getElementById('chat-modal');
const loadingModal = document.getElementById('loading-modal');
const chatMessages = document.getElementById('chat-messages');

// =========================================================
// 2. AUTENTIKASI LOGIN
// =========================================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nik = document.getElementById('login-nik').value.trim();
  const pass = document.getElementById('login-password').value.trim();

  try {
    const qUser = query(collection(db, 'users'), where('nik_hd', '==', nik), where('password', '==', pass));
    const snap = await getDocs(qUser);

    if (snap.empty) {
      alert('NIK atau Password yang Anda masukkan salah!');
      return;
    }

    currentUser = snap.docs[0].data();
    sessionStorage.setItem('hd_user', JSON.stringify(currentUser));
    initDashboard();

  } catch (err) {
    console.error("Login Error:", err);
    alert("Gagal terhubung ke database!");
  }
});

// AUTO LOGIN DARI SESSION
window.addEventListener('DOMContentLoaded', () => {
  const saved = sessionStorage.getItem('hd_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    initDashboard();
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('hd_user');
  location.reload();
});

// =========================================================
// 3. INIT DASHBOARD
// =========================================================
function initDashboard() {
  loginSection.classList.add('hidden');
  dashboardSection.classList.remove('hidden');

  document.getElementById('user-name-display').textContent = currentUser.nama_hd || 'Petugas HD';
  document.getElementById('user-nik-display').textContent = `NIK: ${currentUser.nik_hd}`;
  document.getElementById('user-segmen-badge').textContent = `Segmen: ${currentUser.segmen}`;

  listenTickets();
  loadAnalytics();
}

// =========================================================
// 4. LISTEN REALTIME TIKET & PELETAKAN TAB
// =========================================================
function listenTickets() {
  if (unsubscribeTickets) unsubscribeTickets();

  const qTiket = query(
    collection(db, 'permintaan'),
    where('msg_type', '==', 'UTAMA'),
    where('segmen', '==', currentUser.segmen)
  );

  unsubscribeTickets = onSnapshot(qTiket, (snapshot) => {
    let countOpen = 0, countProgress = 0, countClose = 0;
    const tickets = [];

    snapshot.forEach(docSnap => {
      const data = { id: docSnap.id, ...docSnap.data() };
      tickets.push(data);

      if (data.status === 'OPEN') countOpen++;
      else if (data.status === 'IN_PROGRESS') countProgress++;
      else if (data.status === 'CLOSED') countClose++;
    });

    document.getElementById('badge-count-open').textContent = countOpen;
    document.getElementById('badge-count-progress').textContent = countProgress;
    document.getElementById('badge-count-close').textContent = countClose;

    renderTicketsList(tickets.filter(t => t.status === activeTab));
  });
}

function renderTicketsList(tickets) {
  ticketsList.innerHTML = '';

  if (tickets.length === 0) {
    ticketsList.innerHTML = `<div class="p-8 text-center text-xs text-slate-400">Tidak ada tiket di tab ini.</div>`;
    return;
  }

  tickets.sort((a,b) => (b.timestamp_created?.seconds || 0) - (a.timestamp_created?.seconds || 0));

  tickets.forEach(ticket => {
    const item = document.createElement('div');
    item.className = "p-4 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-4";

    let actionButtons = '';

    // PESAN OPEN
    if (ticket.status === 'OPEN') {
      actionButtons = `
        <button onclick="window.handleReplyFromOpen('${ticket.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1.5">
          <i class="fa-solid fa-reply"></i> Balas & Proses
        </button>
      `;
    } 
    // DIKERJAKAN
    else if (ticket.status === 'IN_PROGRESS') {
      actionButtons = `
        <div class="flex items-center gap-2">
          <button onclick="window.openChatRoom('${ticket.id}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1">
            <i class="fa-solid fa-comments"></i> Balas
          </button>
          <button onclick="window.handleCloseTicket('${ticket.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow transition flex items-center gap-1">
            <i class="fa-solid fa-check"></i> Tandai Close
          </button>
        </div>
      `;
    }
    // CLOSE
    else if (ticket.status === 'CLOSED') {
      actionButtons = `
        <button onclick="window.openChatRoom('${ticket.id}')" class="px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold transition flex items-center gap-1">
          <i class="fa-solid fa-eye"></i> Lihat Riwayat Chat
        </button>
      `;
    }

    item.innerHTML = `
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="font-bold text-xs text-indigo-600">#${ticket.id_permintaan}</span>
          <span class="px-2 py-0.5 bg-slate-200 text-slate-700 text-[10px] font-bold rounded">${ticket.kategori_pekerjaan || '-'}</span>
          <span class="text-[10px] text-slate-400">${ticket.timestamp_created ? new Date(ticket.timestamp_created.seconds*1000).toLocaleString('id-ID') : '-'}</span>
        </div>
        <p class="text-xs text-slate-800 font-medium line-clamp-2">${ticket.pesan}</p>
        <p class="text-[10px] text-slate-500">Oleh Teknisi: <span class="font-semibold text-slate-700">${ticket.nama_teknisi || 'Tanpa Nama'}</span></p>
      </div>
      <div class="flex items-center justify-end">${actionButtons}</div>
    `;

    ticketsList.appendChild(item);
  });
}

// TAB EVENT HANDLERS
['open', 'progress', 'close'].forEach(type => {
  document.getElementById(`tab-${type}`).addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('border-indigo-600', 'text-indigo-600');
      b.classList.add('border-transparent', 'text-slate-500');
    });

    e.currentTarget.classList.remove('border-transparent', 'text-slate-500');
    e.currentTarget.classList.add('border-indigo-600', 'text-indigo-600');

    if (type === 'open') activeTab = 'OPEN';
    if (type === 'progress') activeTab = 'IN_PROGRESS';
    if (type === 'close') activeTab = 'CLOSED';

    listenTickets();
  });
});

// =========================================================
// 5. TOMBOL AKSI GLOBAL & RUANG CHAT
// =========================================================
window.handleReplyFromOpen = async (docId) => {
  try {
    const ticketRef = doc(db, 'permintaan', docId);
    await updateDoc(ticketRef, {
      status: 'IN_PROGRESS',
      id_telegram_hd: currentUser.id_telegram_hd || currentUser.nik_hd,
      timestamp_taken: serverTimestamp()
    });

    window.openChatRoom(docId);
  } catch (err) {
    console.error("Error mengambil tiket:", err);
  }
};

window.handleCloseTicket = async (docId) => {
  if (!confirm("Yakin ingin menutup tiket ini? Tiket akan otomatis Re-Open jika ada balasan baru dari teknisi di Telegram.")) return;

  try {
    const ticketRef = doc(db, 'permintaan', docId);
    await updateDoc(ticketRef, {
      status: 'CLOSED',
      timestamp_close: serverTimestamp()
    });
    alert("Tiket berhasil ditutup!");
  } catch (err) {
    console.error("Error closing ticket:", err);
  }
};

window.openChatRoom = async (mainDocId) => {
  currentChatTicketId = mainDocId;
  chatModal.classList.remove('hidden');
  chatMessages.innerHTML = '';

  const qMain = query(collection(db, 'permintaan'), where('id_permintaan', '==', mainDocId));
  const snapMain = await getDocs(qMain);
  if (!snapMain.empty) {
    currentChatMainDoc = snapMain.docs[0].data();
    document.getElementById('chat-ticket-id').textContent = `Tiket ID: ${currentChatMainDoc.id_permintaan}`;
    document.getElementById('chat-ticket-sub').textContent = `Teknisi: ${currentChatMainDoc.nama_teknisi} | Segmen: ${currentChatMainDoc.segmen}`;
  }

  if (unsubscribeChat) unsubscribeChat();

  const qChat = query(
    collection(db, 'permintaan'),
    where('tiket_id', '==', mainDocId)
  );

  unsubscribeChat = onSnapshot(qChat, (snapshot) => {
    const chats = [];
    snapshot.forEach(d => chats.push(d.data()));

    chats.sort((a,b) => (a.timestamp_created?.seconds || 0) - (b.timestamp_created?.seconds || 0));

    chatMessages.innerHTML = '';
    chats.forEach(msg => {
      const isFromWeb = msg.sender_type === 'WEB';
      const bubble = document.createElement('div');
      bubble.className = `flex flex-col ${isFromWeb ? 'items-end' : 'items-start'} space-y-1`;

      let imageHTML = '';
      if (msg.file_id) {
        if (msg.file_id.startsWith('http')) {
          imageHTML = `<img src="${msg.file_id}" class="max-w-xs rounded-lg mt-1 border border-slate-200">`;
        } else {
          imageHTML = `<div class="text-[10px] bg-slate-200 p-1 rounded mt-1 italic">📷 Lampiran Telegram (${msg.file_id})</div>`;
        }
      }

      bubble.innerHTML = `
        <div class="max-w-[80%] rounded-xl p-3 text-xs ${isFromWeb ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 shadow-sm border border-slate-200 rounded-bl-none'}">
          <p class="font-bold text-[10px] ${isFromWeb ? 'text-indigo-200' : 'text-slate-500'} mb-0.5">
            ${isFromWeb ? `By HD: ${currentUser.nama_hd}` : msg.nama_teknisi || 'Teknisi'}
          </p>
          <p class="whitespace-pre-wrap">${msg.pesan}</p>
          ${imageHTML}
        </div>
        <span class="text-[9px] text-slate-400 px-1">
          ${msg.timestamp_created ? new Date(msg.timestamp_created.seconds*1000).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'}) : '-'}
        </span>
      `;
      chatMessages.appendChild(bubble);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
};

document.getElementById('close-chat-modal-btn').addEventListener('click', () => {
  chatModal.classList.add('hidden');
  if (unsubscribeChat) unsubscribeChat();
});

// PASTE GAMBAR (CTRL + V)
document.getElementById('chat-input-text').addEventListener('paste', (e) => {
  const items = (e.clipboardData || e.originalEvent.clipboardData).items;
  for (let item of items) {
    if (item.type.indexOf("image") === 0) {
      pastedImageFile = item.getAsFile();
      const reader = new FileReader();
      reader.onload = function(evt) {
        document.getElementById('paste-preview-img').src = evt.target.result;
        document.getElementById('paste-preview-container').classList.remove('hidden');
      };
      reader.readAsDataURL(pastedImageFile);
      break;
    }
  }
});

document.getElementById('remove-paste-btn').addEventListener('click', () => {
  pastedImageFile = null;
  document.getElementById('paste-preview-container').classList.add('hidden');
});

// SUBMIT FORM CHAT
document.getElementById('chat-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const textInput = document.getElementById('chat-input-text').value.trim();

  if (!textInput && !pastedImageFile) return;

  loadingModal.classList.remove('hidden');

  try {
    let imageUrl = null;

    if (pastedImageFile) {
      const formData = new FormData();
      formData.append('image', pastedImageFile);

      const imgurRes = await fetch('https://api.imgur.com/3/image', {
        method: 'POST',
        headers: { Authorization: 'Client-ID 54477372fc1703e' },
        body: formData
      });
      const imgurData = await imgurRes.json();
      if (imgurData.success) {
        imageUrl = imgurData.data.link;
      }
    }

    const payload = {
      chat_id: currentChatMainDoc.chat_id,
      reply_to_message_id: currentChatMainDoc.message_id,
      text: textInput,
      image_url: imageUrl
    };

    const apiRes = await fetch('/api/send_telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resData = await apiRes.json();

    const newDocRef = doc(collection(db, 'permintaan'));
    await addDoc(collection(db, 'permintaan'), {
      id_permintaan: newDocRef.id,
      tiket_id: currentChatTicketId,
      msg_type: 'BALASAN',
      sender_type: 'WEB',
      chat_id: currentChatMainDoc.chat_id,
      message_id: resData.message_id || null,
      reply_to_message_id: currentChatMainDoc.message_id,
      segmen: currentChatMainDoc.segmen,
      kategori_pekerjaan: currentChatMainDoc.kategori_pekerjaan,
      pesan: textInput,
      file_id: imageUrl || null,
      id_telegram_hd: currentUser.id_telegram_hd || currentUser.nik_hd,
      status: null,
      timestamp_created: serverTimestamp()
    });

    document.getElementById('chat-input-text').value = '';
    pastedImageFile = null;
    document.getElementById('paste-preview-container').classList.add('hidden');

  } catch (err) {
    console.error("Gagal mengirim balasan:", err);
    alert("Gagal mengirim balasan!");
  } finally {
    loadingModal.classList.add('hidden');
  }
});

// =========================================================
// 6. DASHBOARD ANALITIK
// =========================================================
async function loadAnalytics() {
  const qReplies = query(collection(db, 'permintaan'), where('sender_type', '==', 'WEB'));
  const snapReplies = await getDocs(qReplies);

  let totalReplies = 0;
  const hdCountMap = {};

  snapReplies.forEach(d => {
    const data = d.data();
    totalReplies++;
    const hdKey = data.id_telegram_hd || 'HD';
    hdCountMap[hdKey] = (hdCountMap[hdKey] || 0) + 1;
  });

  document.getElementById('stat-total-replies').textContent = totalReplies;

  const ctx = document.getElementById('hdActivityChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(hdCountMap),
      datasets: [{
        label: 'Jumlah Balasan Diberikan',
        data: Object.values(hdCountMap),
        backgroundColor: '#4f46e5',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

document.getElementById('apply-filter-btn').addEventListener('click', loadAnalytics);
