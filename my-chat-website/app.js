// app.js — Complete Vanilla JavaScript Firebase Auth + Firestore Chat Logic
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.4.0/firebase-firestore.js";

// ============================================================================
// YOUR FIREBASE CONFIGURATION
// ============================================================================
const firebaseConfig = {
  "apiKey": "AIzaSyAL0W_mu41w-mB4s8LqiqHhzXdUJAn_AVI",
  "authDomain": "mychatweb-c1198.firebaseapp.com",
  "projectId": "mychatweb-c1198",
  "storageBucket": "mychatweb-c1198.firebasestorage.app",
  "messagingSenderId": "314964489677",
  "appId": "1:314964489677:web:8105340ecd16a6f4434084",
  "measurementId": "G-49QEP50HZJ"
};

// Initialize Firebase App, Authentication, and Cloud Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Helper: Generate a consistent avatar color from a user ID
function pickAvatarColor(uid) {
  const palette = ["#2563eb", "#0d9488", "#4f46e5", "#0284c7", "#059669", "#d97706", "#dc2626"];
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = uid.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

// Helper: Create or update the user's public profile document in Firestore
async function syncUserProfile(user, customName) {
  const displayName = (customName || user.displayName || user.email?.split("@")[0] || "Member").trim().slice(0, 60);
  const avatarColor = pickAvatarColor(user.uid);
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);

  if (!snap.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      displayName,
      avatarColor,
      status: "online",
      visibility: "public",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } else {
    await updateDoc(userRef, {
      status: "online",
      updatedAt: serverTimestamp()
    });
  }
}

const isLoginPage = Boolean(document.getElementById("auth-form"));
const isChatPage = Boolean(document.getElementById("message-form"));

// ============================================================================
// PAGE 1 LOGIC: index.html (Login & Registration)
// ============================================================================
if (isLoginPage) {
  let mode = "login";

  const tabLogin = document.getElementById("tab-login");
  const tabRegister = document.getElementById("tab-register");
  const nameWrapper = document.getElementById("name-field-wrapper");
  const authTitle = document.getElementById("auth-title");
  const authSubtitle = document.getElementById("auth-subtitle");
  const submitBtn = document.getElementById("submit-btn");
  const authForm = document.getElementById("auth-form");
  const authAlert = document.getElementById("auth-alert");
  const googleBtn = document.getElementById("google-btn");

  function showAlert(message, isError = true) {
    authAlert.textContent = message;
    authAlert.className = isError
      ? "mb-4 p-3 rounded-lg border border-red-200 bg-red-50 text-xs font-medium text-red-700"
      : "mb-4 p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-700";
    authAlert.classList.remove("hidden");
  }

  function setAuthMode(newMode) {
    mode = newMode;
    authAlert.classList.add("hidden");
    if (mode === "login") {
      tabLogin.className = "py-2 px-4 text-xs font-semibold rounded-md bg-white text-slate-900 shadow-sm transition-colors";
      tabRegister.className = "py-2 px-4 text-xs font-semibold rounded-md text-slate-600 hover:text-slate-900 transition-colors";
      nameWrapper.classList.add("hidden");
      authTitle.textContent = "Sign in to your account";
      authSubtitle.textContent = "Enter your email and password below to join the live chat room.";
      submitBtn.textContent = "Sign In to Chat";
    } else {
      tabRegister.className = "py-2 px-4 text-xs font-semibold rounded-md bg-white text-slate-900 shadow-sm transition-colors";
      tabLogin.className = "py-2 px-4 text-xs font-semibold rounded-md text-slate-600 hover:text-slate-900 transition-colors";
      nameWrapper.classList.remove("hidden");
      authTitle.textContent = "Create your free account";
      authSubtitle.textContent = "Register with your email and password to start chatting immediately.";
      submitBtn.textContent = "Create Account & Join";
    }
  }

  tabLogin.addEventListener("click", () => setAuthMode("login"));
  tabRegister.addEventListener("click", () => setAuthMode("register"));

  onAuthStateChanged(auth, (user) => {
    if (user) {
      window.location.href = "chat.html";
    }
  });

  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const displayName = document.getElementById("displayName").value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Please wait...";

    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }
        await syncUserProfile(credential.user, displayName);
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await syncUserProfile(credential.user);
      }
      window.location.href = "chat.html";
    } catch (error) {
      showAlert(error.message || "Authentication failed. Please check your credentials.");
      submitBtn.disabled = false;
      submitBtn.textContent = mode === "login" ? "Sign In to Chat" : "Create Account & Join";
    }
  });

  googleBtn.addEventListener("click", async () => {
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(credential.user);
      window.location.href = "chat.html";
    } catch (error) {
      showAlert(error.message || "Google Sign-In failed.");
    }
  });
}

// ============================================================================
// PAGE 2 LOGIC: chat.html (Real-Time Chat Room)
// ============================================================================
if (isChatPage) {
  let currentUser = null;
  let currentRoom = "general";
  let unsubscribeMessages = null;

  const userBadge = document.getElementById("user-badge");
  const logoutBtn = document.getElementById("logout-btn");
  const roomLabel = document.getElementById("current-room-label");
  const messagesContainer = document.getElementById("messages-container");
  const messageForm = document.getElementById("message-form");
  const messageInput = document.getElementById("message-input");
  const chatAlert = document.getElementById("chat-alert");
  const roomButtons = document.querySelectorAll(".room-btn");

  function showChatError(msg) {
    chatAlert.textContent = msg;
    chatAlert.classList.remove("hidden");
  }

  function formatTime(timestamp) {
    if (!timestamp || !timestamp.toDate) return "Just now";
    return timestamp.toDate().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function subscribeToRoom(roomId) {
    if (unsubscribeMessages) {
      unsubscribeMessages();
    }

    currentRoom = roomId;
    roomLabel.textContent = "#" + roomId;
    messageInput.placeholder = "Write a message in #" + roomId + "...";

    const messagesQuery = query(
      collection(db, "messages"),
      where("roomId", "==", roomId)
    );

    unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const docs = [];
        snapshot.forEach((docSnap) => {
          docs.push({ id: docSnap.id, ...docSnap.data() });
        });

        docs.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
          return timeA - timeB;
        });

        renderMessages(docs);
      },
      (error) => {
        showChatError("Real-time listener error: " + error.message);
      }
    );
  }

  function renderMessages(messages) {
    messagesContainer.innerHTML = "";

    if (messages.length === 0) {
      const emptyDiv = document.createElement("div");
      emptyDiv.className = "text-center py-12 text-sm text-slate-500";
      emptyDiv.textContent = "No messages in #" + currentRoom + " yet. Send the first message below!";
      messagesContainer.appendChild(emptyDiv);
      return;
    }

    messages.forEach((msg) => {
      const isMe = currentUser && msg.senderId === currentUser.uid;

      const wrapper = document.createElement("div");
      wrapper.className = isMe ? "flex flex-col items-end" : "flex flex-col items-start";

      const metaRow = document.createElement("div");
      metaRow.className = "flex items-center gap-2 mb-1 text-xs text-slate-500";

      const authorSpan = document.createElement("span");
      authorSpan.className = "font-semibold text-slate-700";
      authorSpan.textContent = isMe ? "You (" + msg.senderName + ")" : msg.senderName;

      const sep = document.createElement("span");
      sep.textContent = "·";

      const timeSpan = document.createElement("span");
      timeSpan.className = "tabular-nums";
      timeSpan.textContent = formatTime(msg.createdAt);

      metaRow.appendChild(authorSpan);
      metaRow.appendChild(sep);
      metaRow.appendChild(timeSpan);

      if (isMe) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "text-red-600 hover:underline ml-2 cursor-pointer";
        deleteBtn.textContent = "Delete";
        deleteBtn.addEventListener("click", async () => {
          try {
            await deleteDoc(doc(db, "messages", msg.id));
          } catch (err) {
            showChatError("Could not delete message: " + err.message);
          }
        });
        metaRow.appendChild(deleteBtn);
      }

      const bubble = document.createElement("div");
      bubble.className = isMe
        ? "max-w-lg px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm leading-relaxed break-words"
        : "max-w-lg px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-sm leading-relaxed break-words";
      bubble.textContent = msg.text;

      wrapper.appendChild(metaRow);
      wrapper.appendChild(bubble);
      messagesContainer.appendChild(wrapper);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  roomButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetRoom = btn.getAttribute("data-room");
      roomButtons.forEach((b) => {
        b.className = "room-btn w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors";
      });
      btn.className = "room-btn w-full text-left px-3 py-2 rounded-lg text-sm font-semibold bg-blue-50 text-blue-700 transition-colors";
      subscribeToRoom(targetRoom);
    });
  });

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "index.html";
      return;
    }
    currentUser = user;
    const displayName = (user.displayName || user.email?.split("@")[0] || "Member").slice(0, 60);
    userBadge.textContent = displayName + (user.email ? " · " + user.email : "");

    try {
      await syncUserProfile(user);
    } catch (err) {
      console.warn("Profile sync notice:", err);
    }

    subscribeToRoom(currentRoom);
  });

  messageForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const text = messageInput.value.trim();
    if (!text) return;

    messageInput.value = "";
    const senderName = (currentUser.displayName || currentUser.email?.split("@")[0] || "Member").slice(0, 60);

    try {
      await addDoc(collection(db, "messages"), {
        roomId: currentRoom,
        text: text.slice(0, 1000),
        senderId: currentUser.uid,
        senderName,
        senderAvatarColor: pickAvatarColor(currentUser.uid),
        edited: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      showChatError("Failed to send message: " + error.message);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (unsubscribeMessages) unsubscribeMessages();
    await signOut(auth);
    window.location.href = "index.html";
  });
}