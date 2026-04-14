import { useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/interview/setup": "Interview Setup",
  "/interview/session": "Interview Session",
  "/interview/result": "Interview Result",
  "/profile": "Profile"
};

function Navbar() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const title = pageTitles[pathname] || "AI Interview Platform";

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="flex flex-col gap-4 px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">AI Interview Platform</p>
          <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
        </div>
        <div className="flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:self-auto">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 font-semibold text-white">
            {(user?.name || user?.username || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{user?.name || user?.username || "Candidate"}</p>
            <p className="text-xs text-slate-500">{user?.email || "Signed in"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
