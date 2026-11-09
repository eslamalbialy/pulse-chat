import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { 
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, updateProfile, signOut 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { 
  getFirestore, collection, doc, setDoc, getDoc, addDoc, 
  onSnapshot, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// إعدادات مشروعك على Firebase
const firebaseConfig = {
  "apiKey": "AIzaSyAL0W_mu41w-mB4s8LqiqHhzXdUJAn_AVI",
  "authDomain": "mychatweb-c1198.firebaseapp.com",
  "projectId": "mychatweb-c1198",
  "storageBucket": "mychatweb-c1198.firebasestorage.app",
  "messagingSenderId": "314964489677",
  "appId": "1:314964489677:web:8105340ecd16a6f4434084",
  "measurementId": "G-49QEP50HZJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// دالة مساعدة لتوليد صورة تلقائية باسم المستخدم
function getAvatar(name, customUrl) {
  if (customUrl && customUrl.trim() !== "") return customUrl;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=00a884&color=fff&bold=true`;
}

// ==========================================
// القسم الأول: صفحة تسجيل الدخول (index.html)
// ==========================================
const authForm = document.getElementById("auth-form");
if (authForm) {
  let isLogin = true;
  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const nameField = document.getElementById("name-field");
  const submitBtn = document.getElementById("auth-submit");
  const errorBox = document.getElementById("auth-error");

  tabLogin.onclick = () => {
    isLogin = true;
    nameField.classList.add("hidden");
    tabLogin.className = "flex-1 py-3.5 text-emerald-400 border-b-2 border-emerald-500 transition";
    tabRegister.className = "flex-1 py-3.5 text-gray-400 border-b-2 border-transparent transition";
    submitBtn.innerHTML = `<span>دخول إلى الدردشة</span><i class="fa-solid fa-arrow-left text-xs"></i>`;
  };

  tabRegister.onclick = () => {
    isLogin = false;
    nameField.classList.remove("hidden");
    tabRegister.className = "flex-1 py-3.5 text-emerald-400 border-b-2 border-emerald-500 transition";
    tabLogin.className = "flex-1 py-3.5 text-gray-400 border-b-2 border-transparent transition";
    submitBtn.innerHTML = `<span>إنشاء حساب جديد</span><i class="fa-solid fa-user-plus text-xs"></i>`;
  };

  onAuthStateChanged(auth, (user) => {
    if (user) window.location.href = "chat.html";
  });

  authForm.onsubmit = async (e) => {
    e.preventDefault();
    errorBox.classList.add("hidden");
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const name = document.getElementById("auth-name").value.trim();

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!name) throw new Error("يرجى كتابة اسمك أولاً");
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          name: name,
          email: email,
          bio: "أهلاً! أنا أستخدم PulseChat",
          avatar: getAvatar(name, ""),
          updatedAt: serverTimestamp()
        });
      }
      window.location.href = "chat.html";
    } catch (err) {
      errorBox.textContent = "خطأ في البيانات: تأكد من البريد الإلكتروني وكلمة المرور (6 أحرف على الأقل)";
      errorBox.classList.remove("hidden");
    }
  };
}

// ==========================================
// القسم الثاني: صفحة الدردشة (chat.html)
// ==========================================
const messagesBox = document.getElementById("messages-box");
if (messagesBox) {
  let currentUser = null;
  let currentUserData = {};
  let allUsers = [];
  let activeRoom = { id: "global_community", title: "المجتمع العام 🌍", sub: "غرفة مفتوحة لجميع أعضاء الموقع", avatar: getAvatar("Global", "") };
  let unsubscribeMessages = null;

  const sidebarPanel = document.getElementById("sidebar-panel");
  const chatPanel = document.getElementById("chat-panel");

  // التنقل بين الموبايل والكمبيوتر
  function openChatOnMobile() {
    if (window.innerWidth < 768) {
      sidebarPanel.classList.add("hidden");
      chatPanel.classList.remove("hidden");
      chatPanel.classList.add("flex");
    }
  }

  document.getElementById("btn-back-mobile").onclick = () => {
    chatPanel.classList.add("hidden");
    chatPanel.classList.remove("flex");
    sidebarPanel.classList.remove("hidden");
  };

  // التحقق من المستخدم المسجل
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    currentUser = user;

    // التأكد من وجود ملف للمستخدم في قاعدة البيانات
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    const defaultName = user.displayName || user.email.split("@")[0];

    if (!snap.exists()) {
      currentUserData = {
        uid: user.uid,
        name: defaultName,
        email: user.email,
        bio: "متصل على PulseChat",
        avatar: getAvatar(defaultName, "")
      };
      await setDoc(userRef, currentUserData);
    } else {
      currentUserData = snap.data();
    }

    updateMyHeaderUI();
    listenToUsers();
    listenToRooms();
    switchRoom(activeRoom.id, activeRoom.title, activeRoom.sub, activeRoom.avatar);
  });

  function updateMyHeaderUI() {
    document.getElementById("my-name").textContent = currentUserData.name;
    document.getElementById("my-bio").textContent = currentUserData.bio || "متصل الآن";
    document.getElementById("my-avatar").src = getAvatar(currentUserData.name, currentUserData.avatar);
  }

  // التبويبات (الدردشات / الأعضاء)
  const tabChats = document.getElementById("tab-chats");
  const tabUsers = document.getElementById("tab-users");
  const viewChats = document.getElementById("view-chats");
  const viewUsers = document.getElementById("view-users");

  tabChats.onclick = () => {
    viewChats.classList.remove("hidden");
    viewUsers.classList.add("hidden");
    tabChats.className = "flex-1 py-3 text-emerald-400 border-b-2 border-emerald-500 flex items-center justify-center gap-1.5 transition";
    tabUsers.className = "flex-1 py-3 text-gray-400 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
  };

  tabUsers.onclick = () => {
    viewUsers.classList.remove("hidden");
    viewChats.classList.add("hidden");
    tabUsers.className = "flex-1 py-3 text-emerald-400 border-b-2 border-emerald-500 flex items-center justify-center gap-1.5 transition";
    tabChats.className = "flex-1 py-3 text-gray-400 border-b-2 border-transparent flex items-center justify-center gap-1.5 transition";
  };

  // جلب كل المستخدمين المسجلين في الموقع لحظياً
  function listenToUsers() {
    onSnapshot(collection(db, "users"), (snapshot) => {
      allUsers = [];
      viewUsers.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const u = docSnap.data();
        if (u.uid !== currentUser.uid) allUsers.push(u);
      });

      document.getElementById("users-count").textContent = allUsers.length;

      if (allUsers.length === 0) {
        viewUsers.innerHTML = `<div class="p-6 text-center text-xs text-gray-500">لا يوجد أعضاء آخرين بعد. شارك الرابط مع أصدقائك!</div>`;
        return;
      }

      allUsers.forEach((u) => {
        const item = document.createElement("div");
        item.className = "flex items-center gap-3 p-3.5 hover:bg-[#202c33] cursor-pointer transition";
        item.innerHTML = `
          <img src="${getAvatar(u.name, u.avatar)}" class="w-11 h-11 rounded-full object-cover">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm text-white truncate">${u.name}</div>
            <div class="text-xs text-gray-400 truncate">${u.bio || "عضو في الموقع"}</div>
          </div>
          <span class="text-[11px] bg-emerald-600/20 text-emerald-400 px-2.5 py-1 rounded-full">مراسلة</span>
        `;
        item.onclick = () => startDirectChat(u);
        viewUsers.appendChild(item);
      });
    });
  }

  // فتح شات خاص بينك وبين أي عضو
  async function startDirectChat(otherUser) {
    const sortedIds = [currentUser.uid, otherUser.uid].sort();
    const roomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;

    await setDoc(doc(db, "rooms", roomId), {
      id: roomId,
      type: "dm",
      participants: sortedIds,
      names: {
        [currentUser.uid]: currentUserData.name,
        [otherUser.uid]: otherUser.name
      },
      avatars: {
        [currentUser.uid]: getAvatar(currentUserData.name, currentUserData.avatar),
        [otherUser.uid]: getAvatar(otherUser.name, otherUser.avatar)
      },
      updatedAt: serverTimestamp()
    }, { merge: true });

    switchRoom(roomId, otherUser.name, otherUser.bio || "محادثة خاصة", getAvatar(otherUser.name, otherUser.avatar));
    openChatOnMobile();
  }

  // الاستماع للجروبات والمحادثات الخاصة المشترك فيها المستخدم
  function listenToRooms() {
    const roomsContainer = document.getElementById("my-rooms-list");
    onSnapshot(collection(db, "rooms"), (snapshot) => {
      roomsContainer.innerHTML = "";
      snapshot.forEach((docSnap) => {
        const room = docSnap.data();
        if (!room.participants || !room.participants.includes(currentUser.uid)) return;

        let title = room.name;
        let sub = "جروب دردشة جماعي";
        let avatar = getAvatar(room.name || "Group", "");

        if (room.type === "dm") {
          const otherId = room.participants.find(id => id !== currentUser.uid);
          title = (room.names && room.names[otherId]) ? room.names[otherId] : "مستخدم";
          avatar = (room.avatars && room.avatars[otherId]) ? room.avatars[otherId] : getAvatar(title, "");
          sub = "محادثة خاصة 🔒";
        } else {
          sub = `جروب • ${room.participants.length} أعضاء`;
        }

        const div = document.createElement("div");
        div.className = "flex items-center gap-3.5 p-3.5 hover:bg-[#202c33] cursor-pointer transition";
        div.innerHTML = `
          <img src="${avatar}" class="w-11 h-11 rounded-full object-cover flex-shrink-0">
          <div class="flex-1 min-w-0">
            <div class="font-bold text-sm text-white truncate">${title}</div>
            <div class="text-xs text-gray-400 truncate">${sub}</div>
          </div>
        `;
        div.onclick = () => {
          switchRoom(room.id, title, sub, avatar);
          openChatOnMobile();
        };
        roomsContainer.appendChild(div);
      });
    });
  }

  // زر المجتمع العام
  document.getElementById("item-global").onclick = () => {
    switchRoom("global_community", "المجتمع العام 🌍", "غرفة الدردشة المفتوحة لكل أعضاء الموقع", getAvatar("Global", ""));
    openChatOnMobile();
  };

  // تبديل الغرفة وتحميل الرسائل اللحظية
  function switchRoom(roomId, title, sub, avatar) {
    activeRoom = { id: roomId, title, sub, avatar };
    document.getElementById("chat-header-title").textContent = title;
    document.getElementById("chat-header-sub").textContent = sub;
    document.getElementById("chat-header-avatar").src = avatar;

    if (unsubscribeMessages) unsubscribeMessages();
    messagesBox.innerHTML = `<div class="text-center text-xs text-gray-500 my-4">جاري تحميل الرسائل...</div>`;

    const q = query(collection(db, "rooms", roomId, "messages"), orderBy("createdAt", "asc"));
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
      messagesBox.innerHTML = "";
      if (snapshot.empty) {
        messagesBox.innerHTML = `
          <div class="m-auto text-center p-6 bg-[#182229]/90 rounded-2xl border border-[#222e35] max-w-xs">
            <p class="text-xs text-emerald-400 font-bold mb-1">لا توجد رسائل هنا بعد 👋</p>
            <p class="text-[11px] text-gray-400">كن أول من يبدأ المحادثة الآن!</p>
          </div>`;
        return;
      }

      snapshot.forEach((docSnap) => {
        const msg = docSnap.data();
        const isMe = msg.senderId === currentUser.uid;
        const bubble = document.createElement("div");
        bubble.className = `flex flex-col max-w-[80%] md:max-w-[65%] ${isMe ? "mr-auto items-end" : "ml-auto items-start"}`;

        bubble.innerHTML = `
          <div class="px-3.5 py-2 rounded-2xl text-sm shadow-sm ${
            isMe 
              ? "bg-[#005c4b] text-white rounded-tl-none" 
              : "bg-[#202c33] text-gray-100 rounded-tr-none border border-[#2a3942]"
          }">
            ${!isMe ? `<div class="text-[11px] font-bold text-emerald-400 mb-0.5">${msg.senderName}</div>` : ""}
            <div class="leading-relaxed break-words">${msg.text}</div>
          </div>
        `;
        messagesBox.appendChild(bubble);
      });
      messagesBox.scrollTop = messagesBox.scrollHeight;
    });
  }

  // إرسال رسالة جديدة
  document.getElementById("message-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = document.getElementById("message-input");
    const text = input.value.trim();
    if (!text || !currentUser) return;

    input.value = "";
    await addDoc(collection(db, "rooms", activeRoom.id, "messages"), {
      text: text,
      senderId: currentUser.uid,
      senderName: currentUserData.name,
      createdAt: serverTimestamp()
    });
  };

  // إدارة البروفايل الشخصي
  const modalProfile = document.getElementById("modal-profile");
  const openProfile = () => {
    document.getElementById("prof-name").value = currentUserData.name || "";
    document.getElementById("prof-bio").value = currentUserData.bio || "";
    document.getElementById("prof-avatar").value = currentUserData.avatar || "";
    modalProfile.classList.remove("hidden");
    modalProfile.classList.add("flex");
  };

  document.getElementById("btn-open-profile").onclick = openProfile;
  document.getElementById("btn-open-profile-icon").onclick = openProfile;
  document.getElementById("close-profile-modal").onclick = () => {
    modalProfile.classList.add("hidden");
    modalProfile.classList.remove("flex");
  };

  document.getElementById("save-profile-btn").onclick = async () => {
    const newName = document.getElementById("prof-name").value.trim();
    const newBio = document.getElementById("prof-bio").value.trim();
    const newAvatar = document.getElementById("prof-avatar").value.trim();
    if (!newName) return;

    currentUserData.name = newName;
    currentUserData.bio = newBio;
    currentUserData.avatar = getAvatar(newName, newAvatar);

    await setDoc(doc(db, "users", currentUser.uid), currentUserData, { merge: true });
    updateMyHeaderUI();
    modalProfile.classList.add("hidden");
    modalProfile.classList.remove("flex");
  };

  // إنشاء جروب جديد وإضافة أعضاء
  const modalGroup = document.getElementById("modal-group");
  document.getElementById("btn-new-group").onclick = () => {
    const list = document.getElementById("group-members-select");
    list.innerHTML = "";
    if (allUsers.length === 0) {
      list.innerHTML = `<div class="p-3 text-center text-gray-500">لا يوجد أعضاء مسجلين حالياً لإضافتهم</div>`;
    } else {
      allUsers.forEach((u) => {
        const row = document.createElement("label");
        row.className = "flex items-center gap-3 p-2.5 hover:bg-[#202c33] cursor-pointer";
        row.innerHTML = `
          <input type="checkbox" value="${u.uid}" class="w-4 h-4 accent-emerald-500 rounded">
          <img src="${getAvatar(u.name, u.avatar)}" class="w-8 h-8 rounded-full object-cover">
          <span class="text-white font-semibold">${u.name}</span>
        `;
        list.appendChild(row);
      });
    }
    modalGroup.classList.remove("hidden");
    modalGroup.classList.add("flex");
  };

  document.getElementById("close-group-modal").onclick = () => {
    modalGroup.classList.add("hidden");
    modalGroup.classList.remove("flex");
  };

  document.getElementById("create-group-confirm").onclick = async () => {
    const groupName = document.getElementById("group-name-input").value.trim();
    if (!groupName) return alert("يرجى كتابة اسم الجروب");

    const checked = Array.from(document.querySelectorAll("#group-members-select input:checked")).map(cb => cb.value);
    const participants = [currentUser.uid, ...checked];
    const roomId = "grp_" + Date.now();

    await setDoc(doc(db, "rooms", roomId), {
      id: roomId,
      name: groupName,
      type: "group",
      participants: participants,
      createdAt: serverTimestamp()
    });

    document.getElementById("group-name-input").value = "";
    modalGroup.classList.add("hidden");
    modalGroup.classList.remove("flex");
    switchRoom(roomId, groupName, `جروب • ${participants.length} أعضاء`, getAvatar(groupName, ""));
    openChatOnMobile();
  };

  // البحث السريع
  document.getElementById("search-input").oninput = (e) => {
    const term = e.target.value.toLowerCase();
    Array.from(viewUsers.children).forEach(el => {
      el.style.display = el.textContent.toLowerCase().includes(term) ? "flex" : "none";
    });
  };

  // تسجيل الخروج
  document.getElementById("btn-logout").onclick = async () => {
    await signOut(auth);
    window.location.href = "index.html";
  };
}