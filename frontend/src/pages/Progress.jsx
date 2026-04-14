import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getInterviewProgress } from "../services/api";

function MetricChart({ title, values, colorClassName }) {
  if (!values.length) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
        No data yet for {title.toLowerCase()}.
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/70">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <span className="text-sm font-semibold text-slate-500">{values[values.length - 1]}/10</span>
      </div>

      <div className="mt-5 flex items-end gap-3">
        {values.map((value, index) => (
          <div key={`${title}-${index}`} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-40 w-full items-end rounded-2xl bg-slate-100 px-2 py-2">
              <div
                className={`w-full rounded-xl ${colorClassName}`}
                style={{ height: `${Math.max((value / 10) * 100, 8)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-500">#{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Progress() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProgress = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getInterviewProgress();
        setProgress(response);
      } catch (progressError) {
        setError(progressError.message);
      } finally {
        setLoading(false);
      }
    };

    loadProgress();
  }, []);

  const improvementSummary = useMemo(() => {
    const improvement = progress?.improvement ?? 0;
    const sessionCount = progress?.scores?.length || 0;

    if (!sessionCount) {
      return "Complete a few interviews to see your progress over time.";
    }

    const label = improvement >= 0 ? `+${improvement}` : `${improvement}`;
    return `You improved ${label} points in your last ${Math.min(sessionCount, 3)} interviews.`;
  }, [progress]);

  const weakestArea = progress?.weakAreas?.[0] || "";

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">Progress Dashboard</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">Track your interview growth over time.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{improvementSummary}</p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Back to Workspace
            </button>
          </div>
        </div>

        {loading ? (
          <div className="mt-8 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-lg shadow-slate-200/70">
            Loading progress...
          </div>
        ) : null}

        {error ? (
          <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {!loading && !error ? (
          <>
            <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Total Sessions</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{progress?.scores?.length || 0}</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Latest Score</p>
                <p className="mt-3 text-4xl font-bold text-slate-900">{progress?.scores?.slice(-1)[0] ?? 0}/10</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Improvement</p>
                <p className="mt-3 text-4xl font-bold text-emerald-700">
                  {(progress?.improvement ?? 0) > 0 ? "+" : ""}
                  {progress?.improvement ?? 0}
                </p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Weak Area</p>
                <p className="mt-3 text-xl font-semibold text-slate-900">{weakestArea || "None yet"}</p>
              </div>
            </section>

            <section className="mt-8 grid gap-6 xl:grid-cols-2">
              <MetricChart title="Score Trend" values={progress?.scores || []} colorClassName="bg-slate-900" />
              <MetricChart title="Communication" values={progress?.communication || []} colorClassName="bg-cyan-600" />
              <MetricChart title="Technical" values={progress?.technical || []} colorClassName="bg-emerald-600" />
              <MetricChart title="Completeness" values={progress?.completeness || []} colorClassName="bg-amber-500" />
            </section>

            <section className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                <h2 className="text-xl font-semibold text-slate-900">Session history</h2>
                <div className="mt-5 space-y-3">
                  {(progress?.sessions || []).length ? (
                    progress.sessions.map((session, index) => (
                      <div key={`${session.date}-${index}`} className="rounded-2xl bg-slate-50 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-900">
                            Interview #{index + 1}
                          </p>
                          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            {session.score}/10
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-slate-500">{new Date(session.date).toLocaleDateString()}</p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                      No completed interviews yet.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
                <h2 className="text-xl font-semibold text-slate-900">Focus next</h2>
                <div className="mt-5 space-y-3">
                  {(progress?.weakAreas || []).length ? (
                    progress.weakAreas.map((item) => (
                      <div key={item} className="rounded-2xl bg-rose-50 px-4 py-4 text-sm text-rose-900">
                        {item}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                      Weak areas will appear here after a few completed interviews.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default Progress;
