import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import ErrorAlert from "../components/ErrorAlert";
import PageLoader from "../components/PageLoader";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import { useAuth } from "../hooks/useAuth";
import { getInterviewHistory } from "../services/interviewService";

function DashboardPage() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        setIsLoading(true);
        setError("");
        const response = await getInterviewHistory(user?.id);
        if (active) {
          setHistory(Array.isArray(response) ? response : response?.history || []);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    if (user?.id) {
      loadDashboard();
    } else {
      setIsLoading(false);
    }

    return () => {
      active = false;
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    const attempts = history.length;
    const averageScore = attempts
      ? (history.reduce((sum, item) => sum + Number(item?.score || 0), 0) / attempts).toFixed(1)
      : "0.0";
    const latestScore = attempts ? Number(history[0]?.score || 0).toFixed(1) : "0.0";

    return { attempts, averageScore, latestScore };
  }, [history]);

  if (isLoading) {
    return <PageLoader label="Loading dashboard" />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] bg-[linear-gradient(135deg,#082f49_0%,#0f172a_55%,#e0f2fe_180%)] px-6 py-8 text-white shadow-xl shadow-cyan-900/10">
        <p className="text-sm font-medium text-cyan-200">Welcome back</p>
        <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold">
              {user?.name || user?.username || "Candidate"}, your next interview run starts here.
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
              Review recent performance, launch a new session, and keep your prep moving with real interview feedback.
            </p>
          </div>
          <Link to="/interview/setup" className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100">
            Start New Interview
          </Link>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Total attempts" value={stats.attempts} hint="Completed sessions on record" />
        <StatCard label="Average score" value={stats.averageScore} hint="Based on completed interviews" />
        <StatCard label="Latest score" value={stats.latestScore} hint="Most recent interview result" />
      </div>

      <ErrorAlert message={error} />

      <SectionCard title="Recent interviews" subtitle="Live history from the backend interview service">
        {history.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {history.map((item) => (
              <article key={item.sessionId} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">{item.mode || "Interview"}</p>
                    <h3 className="mt-2 text-lg font-semibold text-slate-900">{item.summary || "Completed interview session"}</h3>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white">
                    {Number(item.score || 0).toFixed(1)}/10
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-500">
                  {item.feedbackText || "Feedback will appear here once the interview report is generated."}
                </p>
                <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                  <span>{item.date ? new Date(item.date).toLocaleDateString() : "No date"}</span>
                  <Link to={`/interview/result?id=${item.sessionId}`} className="font-semibold text-cyan-700">
                    View result
                  </Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No interviews yet"
            description="Once you complete a session, your recent interviews will appear here."
            action={
              <Link to="/interview/setup" className="inline-flex rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                Start your first interview
              </Link>
            }
          />
        )}
      </SectionCard>
    </div>
  );
}

export default DashboardPage;
