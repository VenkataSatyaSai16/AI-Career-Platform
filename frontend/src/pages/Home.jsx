import React from "react";
import { useNavigate } from "react-router-dom";
import { isAuthenticated } from "../utils/auth";

function Home() {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">AI Learning Suite</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
                One workspace for smart study planning and AI interview practice.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Generate a full study roadmap from a plain-language brief, track progress, replan missed work, and switch into
                resume-aware mock interviews whenever you want to practice.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate(loggedIn ? "/dashboard" : "/login")}
                  className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                >
                  {loggedIn ? "Open Workspace" : "Login / Sign Up"}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(loggedIn ? "/study-planner" : "/login")}
                  className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Preview Study Planner
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Study Planner</p>
                <h2 className="mt-3 text-xl font-semibold">Turn a short brief into a day-wise roadmap</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  AI extracts your learning goal, builds the plan, and keeps it adaptable with progress-based updates.
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">AI Interview</p>
                <h2 className="mt-3 text-xl font-semibold">Practice with adaptive mock interviews</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Upload a resume, answer live questions, and get focused feedback, trends, and coaching reports.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default Home;
