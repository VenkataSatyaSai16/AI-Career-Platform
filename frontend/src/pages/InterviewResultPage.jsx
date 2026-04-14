import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import ErrorAlert from "../components/ErrorAlert";
import PageLoader from "../components/PageLoader";
import SectionCard from "../components/SectionCard";
import { getInterviewResult } from "../services/interviewService";

function InterviewResultPage() {
  const [searchParams] = useSearchParams();
  const interviewId = searchParams.get("id");
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadResult() {
      if (!interviewId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setError("");
        const response = await getInterviewResult(interviewId);
        if (active) {
          setResult(response);
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

    loadResult();

    return () => {
      active = false;
    };
  }, [interviewId]);

  if (isLoading) {
    return <PageLoader label="Loading interview result" />;
  }

  if (!interviewId) {
    return <EmptyState title="Missing interview id" description="Open a completed result from the dashboard or finish an interview session first." />;
  }

  const report = result?.report;

  return (
    <div className="space-y-6">
      <ErrorAlert message={error} />
      {report ? (
        <>
          <section className="rounded-[2rem] bg-[linear-gradient(135deg,#0f172a_0%,#155e75_100%)] px-6 py-8 text-white shadow-xl shadow-cyan-900/10">
            <p className="text-sm font-medium text-cyan-200">Interview summary</p>
            <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-4xl font-semibold">Score {Number(report.overallScore || 0).toFixed(1)}/10</h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-slate-300">{report.finalFeedback}</p>
              </div>
              <div className="rounded-3xl bg-white/10 px-5 py-4 backdrop-blur">
                <p className="text-sm text-cyan-100">Top priority</p>
                <p className="mt-2 text-lg font-semibold">{report.topPriority}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Strengths">
              <ul className="space-y-3">
                {(report.strengths || []).map((item) => (
                  <li key={item} className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{item}</li>
                ))}
              </ul>
            </SectionCard>
            <SectionCard title="Weaknesses">
              <div className="space-y-3">
                {(report.weaknesses || []).map((item) => (
                  <div key={`${item.title}-${item.description}`} className="rounded-2xl bg-amber-50 px-4 py-4">
                    <p className="text-sm font-semibold text-amber-900">{item.title}</p>
                    <p className="mt-1 text-sm text-amber-800">{item.description}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Feedback" subtitle="Score explanation and insight">
              <div className="space-y-4 text-sm leading-7 text-slate-600">
                <p>{report.scoreExplanation}</p>
                <p>{report.finalInsight}</p>
              </div>
            </SectionCard>
            <SectionCard title="Roadmap" subtitle="Backend-generated improvement suggestions">
              <ul className="space-y-3">
                {(report.roadmap || []).map((item) => (
                  <li key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{item}</li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </>
      ) : (
        <EmptyState title="Result unavailable" description="We could not find a completed interview report for this session yet." />
      )}
    </div>
  );
}

export default InterviewResultPage;
