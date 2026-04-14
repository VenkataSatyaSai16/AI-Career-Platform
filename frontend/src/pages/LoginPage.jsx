import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import AuthShell from "../components/AuthShell";
import ErrorAlert from "../components/ErrorAlert";
import { useAuth } from "../hooks/useAuth";
import { useAsync } from "../hooks/useAsync";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { run, isLoading, error } = useAsync(login);
  const [form, setForm] = useState({ identifier: "", password: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();
    await run(form);
    navigate(location.state?.from?.pathname || "/dashboard", { replace: true });
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your interview preparation flow."
      footer={
        <span>
          New here? <Link to="/signup" className="font-semibold text-cyan-700">Create an account</Link>
        </span>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <ErrorAlert message={error} />
        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700" htmlFor="identifier">Email or username</label>
          <input
            id="identifier"
            type="text"
            value={form.identifier}
            onChange={(event) => setForm((current) => ({ ...current, identifier: event.target.value }))}
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
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
            placeholder="Enter your password"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading ? "Signing in..." : "Login"}
        </button>
      </form>
    </AuthShell>
  );
}

export default LoginPage;
