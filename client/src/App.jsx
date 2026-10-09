import { useEffect, useState } from "react";
import Auth from "./Auth.jsx";
import Tasks from "./Tasks.jsx";
import { api } from "./api.js";

const KEY = "session";

function read() {
  try {
    const raw = localStorage.getItem(KEY) || sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function clearStore() {
  localStorage.removeItem(KEY);
  sessionStorage.removeItem(KEY);
}
// "Keep me signed in" saves to localStorage; otherwise the session ends when the tab closes.
function save(data, remember) {
  clearStore();
  (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(data));
}

export default function App() {
  const [session, setSession] = useState(read);
  const [checking, setChecking] = useState(() => Boolean(read()));

  const logout = () => {
    clearStore();
    setSession(null);
  };

  useEffect(() => {
    window.addEventListener("auth:expired", logout);
    return () => window.removeEventListener("auth:expired", logout);
  }, []);

  // On first load, confirm the saved token still works.
  useEffect(() => {
    const saved = read();
    if (!saved) { setChecking(false); return; }
    const remembered = Boolean(localStorage.getItem(KEY));
    api("/auth/me", { token: saved.token })
      .then(({ user }) => {
        const next = { ...saved, user };
        save(next, remembered);
        setSession(next);
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  const login = (data, remember) => {
    save(data, remember);
    setSession(data);
  };

  if (checking) return <div className="boot">Checking your session…</div>;
  return session ? <Tasks session={session} onLogout={logout} /> : <Auth onLogin={login} />;
}
