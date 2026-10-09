import { useMemo, useState } from "react";
import { api } from "./api.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RULES = [
  { label: "8 or more characters", test: (p) => p.length >= 8 },
  { label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "A lowercase letter", test: (p) => /[a-z]/.test(p) },
  { label: "A number", test: (p) => /\d/.test(p) },
];
const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];
const EMPTY = { name: "", email: "", password: "", confirm: "" };

function validate(mode, f) {
  const e = {};
  if (mode === "register" && f.name.trim().length < 2) e.name = "Enter your full name.";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "Enter a valid email address.";
  if (mode === "register") {
    if (!RULES.every((r) => r.test(f.password))) e.password = "Your password doesn't meet all the requirements yet.";
    if (f.confirm !== f.password) e.confirm = "Passwords don't match.";
  } else if (!f.password) {
    e.password = "Enter your password.";
  }
  return e;
}

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState(EMPTY);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [caps, setCaps] = useState(false);
  const [remember, setRemember] = useState(true);

  const isLogin = mode === "login";
  const errors = useMemo(() => ({ ...validate(mode, form), ...serverErrors }), [mode, form, serverErrors]);
  const shown = (field) => (submitted || touched[field]) && errors[field];
  const strength = RULES.filter((r) => r.test(form.password)).length;

  function change(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setServerErrors((s) => {
      if (!s[name]) return s;
      const next = { ...s };
      delete next[name];
      return next;
    });
    setFormError("");
  }
  const blur = (e) => setTouched((t) => ({ ...t, [e.target.name]: true }));
  const watchCaps = (e) => e.getModifierState && setCaps(e.getModifierState("CapsLock"));

  function switchMode(next) {
    setMode(next);
    setForm(EMPTY);
    setTouched({});
    setSubmitted(false);
    setServerErrors({});
    setFormError("");
    setShowPw(false);
  }

  async function submit(e) {
    e.preventDefault();
    setSubmitted(true);
    setFormError("");
    const firstBad = Object.keys(errors)[0];
    if (firstBad) {
      document.querySelector(`[name="${firstBad}"]`)?.focus();
      return;
    }
    setBusy(true);
    try {
      const body = isLogin
        ? { email: form.email.trim(), password: form.password, remember }
        : { name: form.name.trim(), email: form.email.trim(), password: form.password, remember };
      const data = await api(isLogin ? "/auth/login" : "/auth/register", { method: "POST", body });
      onLogin(data, remember);
    } catch (err) {
      if (err.fields && Object.keys(err.fields).length) setServerErrors(err.fields);
      else setFormError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = (name) => ({
    name,
    value: form[name],
    onChange: change,
    onBlur: blur,
    "aria-invalid": shown(name) ? "true" : "false",
    "aria-describedby": shown(name) ? `${name}-error` : undefined,
  });
  const fieldError = (name) =>
    shown(name) ? <p className="field-error" id={`${name}-error`}>{errors[name]}</p> : null;

  return (
    <div className="auth">
      <aside className="auth-side">
        <p className="brand">Smart Task Manager</p>
        <h1>Keep every task moving from to do to done.</h1>
        <ul>
          <li>Drag tasks between columns as work progresses</li>
          <li>Set priorities and due dates so nothing slips</li>
          <li>Admins get a view across the whole team</li>
        </ul>
      </aside>

      <main className="auth-main">
        <form onSubmit={submit} noValidate>
          <div className="seg" role="tablist" aria-label="Sign in or create account">
            <button type="button" role="tab" aria-selected={isLogin} onClick={() => switchMode("login")}>Sign in</button>
            <button type="button" role="tab" aria-selected={!isLogin} onClick={() => switchMode("register")}>Create account</button>
          </div>

          <h2>{isLogin ? "Welcome back" : "Create your account"}</h2>

          {!isLogin && (
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input id="name" autoComplete="name" placeholder="Asha Rao" {...field("name")} />
              {fieldError("name")}
            </div>
          )}

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" placeholder="name@company.com" {...field("email")} />
            {fieldError("email")}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="pw">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder={isLogin ? "Your password" : "Create a password"}
                onKeyUp={watchCaps}
                onKeyDown={watchCaps}
                {...field("password")}
                onBlur={(e) => { blur(e); setCaps(false); }}
              />
              <button type="button" className="show" aria-pressed={showPw} onClick={() => setShowPw(!showPw)}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
            {caps && <p className="caps">Caps Lock is on.</p>}
            {fieldError("password")}

            {!isLogin && (
              <>
                <div className={`meter lvl-${strength}`} aria-hidden="true">
                  {[0, 1, 2, 3].map((i) => <span key={i} className={i < strength ? "on" : ""} />)}
                </div>
                <p className="hint" aria-live="polite">
                  {form.password ? `Password strength: ${STRENGTH[strength]}` : "Choose a password you don't use anywhere else."}
                </p>
                <ul className="rules">
                  {RULES.map((r) => (
                    <li key={r.label} className={r.test(form.password) ? "ok" : ""}>{r.label}</li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {!isLogin && (
            <div className="field">
              <label htmlFor="confirm">Confirm password</label>
              <input id="confirm" type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="Type it again" {...field("confirm")} />
              {fieldError("confirm")}
            </div>
          )}

          <label className="check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Keep me signed in on this device
          </label>

          {formError && <p className="error banner" role="alert">{formError}</p>}

          <button className="btn primary full" type="submit" disabled={busy}>
            {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
          </button>
        </form>
      </main>
    </div>
  );
}
