import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import ErrorAlert from "../components/ErrorAlert";
import PageLoader from "../components/PageLoader";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import { useAuth } from "../hooks/useAuth";
import { getInterviewHistory, getUserProfile } from "../services/interviewService";

function ProfilePage() {
  const { user, setUser } = useAuth();
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      try {
        setIsLoading(true);
        setError("");
        const [profileResponse, historyResponse] = await Promise.all([getUserProfile(), getInterviewHistory(user?.id)]);

        if (!active) {
          return;
        }

        const nextUser = profileResponse?.user || profileResponse;
        if (nextUser) {
          setUser(nextUser);
        }
        setHistory(Array.isArray(historyResponse) ? historyResponse : historyResponse?.history || []);
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
      loadProfile();
    } else {
      setIsLoading(false);
    }

    return () => {
      active = false;
    };
  }, [setUser, user?.id]);

  const stats = useMemo(() => {
    const attempts = history.length;
    const avgScore = attempts ? (history.reduce((sum, item) => sum + Number(item?.score || 0), 0) / attempts).toFixed(1) : "0.0";
    const bestScore = attempts ? Math.max(...history.map((item) => Number(item?.score || 0))).toFixed(1) : "0.0";

    return { attempts, avgScore, bestScore };
  }, [history]);

  if (isLoading) {
    return <PageLoader label="Loading profile" />;
  }

  return (
    <div className="space-y-6">
      <ErrorAlert message={error} />
      <SectionCard title="User profile" subtitle="Live account data from the backend">
        <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
          <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-slate-950 text-5xl font-semibold text-white">
            {(user?.name || user?.username || user?.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ProfileField label="Name" value={user?.name || user?.username || "Not available"} />
            <ProfileField label="Username" value={user?.username || "Not available"} />
            <ProfileField label="Email" value={user?.email || "Not available"} />
            <ProfileField label="Calendar connected" value={user?.googleCalendarConnected ? "Connected" : "Not connected"} />
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Attempts" value={stats.attempts} hint="Completed interviews" />
        <StatCard label="Average score" value={stats.avgScore} hint="Across completed sessions" />
        <StatCard label="Best score" value={stats.bestScore} hint="Highest recorded performance" />
      </div>

      <SectionCard title="Interview history" subtitle="Your completed sessions and latest outcomes">
        {history.length ? (
          <div className="space-y-4">
            {history.map((item) => (
              <div key={item.sessionId} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">{item.mode || "Interview"}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{item.summary || "Completed session"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-slate-950">{Number(item.score || 0).toFixed(1)}/10</p>
                    <p className="text-sm text-slate-500">{item.date ? new Date(item.date).toLocaleDateString() : "No date"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No interview history yet" description="Finish a session to start seeing attempts, score trends, and profile statistics." />
        )}
      </SectionCard>
    </div>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

export default ProfilePage;
