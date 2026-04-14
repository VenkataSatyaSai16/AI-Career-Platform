import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import AuthShell from "../components/AuthShell";
import ErrorAlert from "../components/ErrorAlert";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";

function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const { run, isLoading, error } = useAsync(signup);
  const [form, setForm] = useState({ username: "", email: "", password: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();
    await run(form);
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up your workspace and start practicing with live backend-connected interview sessions."
      footer={
        <span>
          Already have an account? <Link to="/login" className="font-semibold text-cyan-700">Login</Link>
        </span>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <ErrorAlert message={error} />
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            value={form.username}
            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            placeholder="yourname"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            minLength={8}
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            placeholder="Minimum 8 characters"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Creating account..." : "Sign Up"}
        </button>
      </form>
    </AuthShell>
  );
}

export default SignupPage;
