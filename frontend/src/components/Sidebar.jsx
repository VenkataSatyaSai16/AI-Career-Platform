import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const links = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/interview/setup", label: "Start Interview" },
  { to: "/profile", label: "Profile" }
];

function Sidebar() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/10 bg-slate-950 px-5 py-6 text-slate-200">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-300">AI Interview</p>
        <h1 className="mt-3 text-2xl font-semibold text-white">Practice with clarity</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          One place for interview prep, live sessions, and performance feedback.
        </p>
      </div>

      <nav className="mt-10 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition ${
                isActive ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto rounded-3xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm text-slate-300">Need a fresh practice session?</p>
        <button
          type="button"
          onClick={() => navigate("/interview/setup")}
          className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
        >
          Start Interview
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
        >
          Logout
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
