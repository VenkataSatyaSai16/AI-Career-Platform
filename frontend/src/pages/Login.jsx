import React, { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { login, signup } from "../services/api";
import { isAuthenticated, storeAuthToken } from "../utils/auth";

const GOOGLE_AUTH_URL = "http://localhost:5000/auth/google";

const INITIAL_LOGIN_FORM = {
  identifier: "",
  password: ""
};

const INITIAL_REGISTER_FORM = {
  username: "",
  email: "",
  password: ""
};

function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [loginForm, setLoginForm] = useState(INITIAL_LOGIN_FORM);
  const [registerForm, setRegisterForm] = useState(INITIAL_REGISTER_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const activeForm = useMemo(() => (mode === "login" ? loginForm : registerForm), [loginForm, mode, registerForm]);

  if (isAuthenticated()) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFieldChange = (field) => (event) => {
    const value = event.target.value;

    if (mode === "login") {
      setLoginForm((current) => ({ ...current, [field]: value }));
      return;
    }

    setRegisterForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "login") {
        const response = await login(loginForm);
        storeAuthToken(response.token);
        navigate("/dashboard", { replace: true });
        return;
      }

      const response = await signup(registerForm);
      setSuccess(response.message || "Registration successful. You can log in now.");
      setMode("login");
      setLoginForm({
        identifier: registerForm.username || registerForm.email,
        password: ""
      });
      setRegisterForm(INITIAL_REGISTER_FORM);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <div className="grid w-full max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-[0_30px_80px_rgba(15,23,42,0.35)] lg:grid-cols-[0.95fr_1.05fr]">
        <section className="bg-[linear-gradient(180deg,#0f172a_0%,#111827_100%)] px-8 py-10 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">AI Learning Suite</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">Use Google or a local account to enter the workspace.</h1>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">
            Sign in with Google or use your username and password.
          </p>
        </section>

        <section className="px-8 py-10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Authentication</p>
              <h2 className="mt-2 text-3xl font-bold text-slate-900">{mode === "login" ? "Login" : "Create account"}</h2>
            </div>
            <button
              type="button"
              onClick={() => navigate("/", { replace: true })}
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-900"
            >
              Back to Home
            </button>
          </div>

          <div className="mt-6 inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
              }}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                mode === "login" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
                setSuccess("");
              }}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                mode === "register" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {mode === "login" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Username or email</span>
                  <input
                    type="text"
                    value={activeForm.identifier}
                    onChange={handleFieldChange("identifier")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                  <input
                    type="password"
                    value={activeForm.password}
                    onChange={handleFieldChange("password")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Username</span>
                  <input
                    type="text"
                    value={activeForm.username}
                    onChange={handleFieldChange("username")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                  <input
                    type="email"
                    value={activeForm.email}
                    onChange={handleFieldChange("email")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                  <input
                    type="password"
                    value={activeForm.password}
                    onChange={handleFieldChange("password")}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-slate-400"
                  />
                </label>
              </>
            )}

            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
            ) : null}

            {success ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Please wait..." : mode === "login" ? "Login" : "Register"}
            </button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Or</span>
              </div>
            </div>

            <a
              href={GOOGLE_AUTH_URL}
              className="mt-4 flex w-full items-center justify-center rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            >
              Continue with Google
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Login;
