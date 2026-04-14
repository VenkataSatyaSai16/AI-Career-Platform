import { Link } from "react-router-dom";

function AuthShell({ title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#020617_0%,#0f172a_55%,#164e63_100%)] px-6 py-10 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl gap-8 lg:grid-cols-[1fr_480px]">
        <div className="hidden rounded-[2rem] border border-white/10 bg-white/5 p-10 backdrop-blur lg:flex lg:flex-col lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-300">AI Interview Platform</p>
            <h1 className="mt-6 text-5xl font-semibold leading-tight">Sharper practice. Better signal. Faster feedback.</h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
              Move from preparation to performance with guided interview sessions and feedback grounded in your real answers.
            </p>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/40 p-6">
            <p className="text-sm text-slate-400">Built for multi-page production apps</p>
            <p className="mt-3 text-lg font-medium text-white">React, Vite, Router, Tailwind, Axios, and Context API working together cleanly.</p>
          </div>
        </div>

        <div className="flex items-center">
          <div className="w-full rounded-[2rem] border border-white/10 bg-white p-8 text-slate-950 shadow-2xl shadow-slate-950/30">
            <Link to="/" className="text-sm font-semibold text-cyan-700">
              Back to landing
            </Link>
            <h2 className="mt-6 text-3xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 text-sm text-slate-500">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AuthShell;
