import { Link } from "react-router-dom";

function LandingPage() {
  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.24),_transparent_36%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.18),_transparent_28%)]" />
      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">AI Interview Platform</p>
            <h1 className="mt-3 text-2xl font-semibold">Practice like the real thing</h1>
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-semibold transition hover:bg-white/10">
              Login
            </Link>
            <Link to="/signup" className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Sign Up
            </Link>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm font-medium text-cyan-200">
              Backend-connected interview workflow
            </p>
            <h2 className="mt-8 max-w-3xl text-5xl font-semibold leading-tight md:text-6xl">
              Run AI-powered interview sessions with feedback that is ready to act on.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              Prepare by role, dial in the difficulty, answer live questions, and review performance trends from real session data.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link to="/signup" className="rounded-2xl bg-white px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
                Start Interview
              </Link>
              <Link to="/login" className="rounded-2xl border border-white/15 px-6 py-4 text-sm font-semibold transition hover:bg-white/10">
                Open Dashboard
              </Link>
            </div>
          </div>

          <div className="grid gap-5">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 backdrop-blur">
              <p className="text-sm font-medium text-cyan-200">Interview flow</p>
              <div className="mt-6 space-y-4">
                {["Setup role and topic", "Answer live questions", "Review score and feedback"].map((step, index) => (
                  <div key={step} className="flex items-center gap-4 rounded-2xl bg-white/5 px-4 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-400 font-semibold text-slate-950">
                      {index + 1}
                    </div>
                    <p className="text-sm text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm text-slate-400">Pages</p>
                <p className="mt-3 text-4xl font-semibold">8</p>
                <p className="mt-2 text-sm text-slate-300">Landing, auth, dashboard, interview flow, and profile.</p>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm text-slate-400">Data source</p>
                <p className="mt-3 text-4xl font-semibold">API</p>
                <p className="mt-2 text-sm text-slate-300">Live backend integration with token-based auth.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
