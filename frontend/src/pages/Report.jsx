import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { generateInterviewPlan, getReport } from "../services/api";

function Report() {
  const navigate = useNavigate();
  const location = useLocation();
  const { sessionId } = useParams();
  const [reportData, setReportData] = useState(location.state?.reportData || (location.state?.report ? { report: location.state.report } : null));
  const [loading, setLoading] = useState(!location.state?.reportData && !location.state?.report);
  const [error, setError] = useState("");
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [showSuggestionCard, setShowSuggestionCard] = useState(Boolean(location.state?.reportData?.suggestionAvailable));

  useEffect(() => {
    if (location.state?.reportData || location.state?.report) {
      return;
    }

    const loadReport = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getReport(sessionId);
        setReportData(response);
      } catch (reportError) {
        setError(reportError.message);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [location.state, sessionId]);

  useEffect(() => {
    if (reportData?.suggestionAvailable) {
      setShowSuggestionCard(true);
    }
  }, [reportData]);

  const report = reportData?.report;
  const weaknesses = Array.isArray(report?.weaknesses) ? report.weaknesses : [];
  const progressMetrics = report?.progressMetrics || {};
  const trendCards = [
    { label: "Score trend", values: progressMetrics.scoreTrend || [] },
    { label: "Communication", values: progressMetrics.communicationTrend || [] },
    { label: "Technical", values: progressMetrics.technicalTrend || [] }
  ];

  const handleCreatePlan = async () => {
    setCreatingPlan(true);
    setError("");

    try {
      const response = await generateInterviewPlan({
        sessionId,
        company: "",
        role: reportData?.mode || "Interview feedback",
        feedbackText: report?.finalFeedback || reportData?.finalSummary || "",
        weakAreas: report?.progressComparison?.weakAreas || weaknesses.map((item) => (typeof item === "string" ? item : item.title))
      });
      navigate(`/calendar?planId=${encodeURIComponent(response.planId)}`);
    } catch (planError) {
      setError(planError.message);
    } finally {
      setCreatingPlan(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Final report</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Interview outcome</h1>
          </div>

          <button
            type="button"
            onClick={() => navigate("/interview-workspace")}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Back to Interview Workspace
          </button>
        </div>

        {loading ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-sm text-slate-500 shadow-lg shadow-slate-200/70">
            Loading report...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        {report ? (
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {showSuggestionCard ? (
              <section className="rounded-3xl border border-sky-200 bg-sky-50 p-6 shadow-lg shadow-sky-100/70 md:col-span-2">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Improve Your Next Interview 🚀</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">Create a personalized study plan only if you want it.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
                  Based on your feedback, we can create a personalized study plan to help you improve.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleCreatePlan}
                    disabled={creatingPlan}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingPlan ? "Creating..." : "Create Study Plan"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSuggestionCard(false)}
                    className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
                  >
                    Skip for Now
                  </button>
                </div>
              </section>
            ) : null}

            <section className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
              <p className="text-sm text-slate-300">Overall score</p>
              <h2 className="mt-3 text-5xl font-bold">{report.overallScore}/10</h2>
              <p className="mt-4 text-sm leading-6 text-slate-200">{report.finalFeedback}</p>
              {report.scoreExplanation ? <p className="mt-4 text-sm leading-6 text-slate-300">{report.scoreExplanation}</p> : null}
              {report.finalInsight ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Final insight</p>
                  <p className="mt-2 text-sm leading-6 text-slate-100">{report.finalInsight}</p>
                </div>
              ) : null}
              {report.topPriority ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">Top priority</p>
                  <p className="mt-2 text-sm leading-6 text-amber-50">{report.topPriority}</p>
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
              <h2 className="text-xl font-semibold text-slate-900">Trends</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {Object.entries(report.trends || {}).map(([key, value]) => (
                  <div key={key} className="rounded-2xl bg-slate-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{key}</p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>

              {report.progress ? (
                <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Progress</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-xs text-slate-500">Previous</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {report.progress.previousScore == null ? "N/A" : `${report.progress.previousScore}/10`}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Current</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{report.progress.currentScore}/10</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Improvement</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">
                        {report.progress.improvement > 0 ? "+" : ""}
                        {report.progress.improvement}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              {trendCards.some((item) => item.values.length >= 2) ? (
                <div className="mt-5 grid gap-3">
                  {trendCards.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                          <p className="text-xs text-slate-500">
                            {(item.values[0] ?? 0)}/10 to {(item.values[1] ?? 0)}/10
                          </p>
                        </div>
                      <div className="mt-3 space-y-2">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-slate-400" style={{ width: `${((item.values[0] ?? 0) / 10) * 100}%` }} />
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${((item.values[1] ?? 0) / 10) * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
              <h2 className="text-xl font-semibold text-slate-900">Strengths</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {(report.strengths || []).map((item) => (
                  <li key={item} className="rounded-2xl bg-emerald-50 px-4 py-3 text-emerald-900">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
              <h2 className="text-xl font-semibold text-slate-900">Weaknesses</h2>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                {weaknesses.map((item, index) => (
                  <li
                    key={typeof item === "string" ? item : `${item.title}-${index}`}
                    className="rounded-2xl bg-rose-50 px-4 py-3 text-rose-900"
                  >
                    {typeof item === "string" ? (
                      item
                    ) : (
                      <>
                        <p className="font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm text-rose-800">{item.description}</p>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70 md:col-span-2">
              <h2 className="text-xl font-semibold text-slate-900">Roadmap</h2>
              <ul className="mt-4 grid gap-3 md:grid-cols-2">
                {(report.roadmap || []).map((item) => (
                  <li key={item} className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            {reportData?.studyPlan?.plan?.length ? (
              <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70 md:col-span-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">Existing study plan</h2>
                    <p className="mt-1 text-sm text-slate-500">{reportData?.studyPlan?.goal || "Practice plan for improvement."}</p>
                  </div>
                  {reportData?.studyPlan?.duration ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {reportData.studyPlan.duration}
                    </span>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {reportData.studyPlan.plan.map((item) => (
                    <div key={`${item.day}-${item.topic}`} className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Day {item.day || 1}</p>
                      <h3 className="mt-2 text-base font-semibold text-slate-900">{item.topic || "Practice session"}</h3>
                      <ul className="mt-3 space-y-2">
                        {(item.tasks || []).map((task) => (
                          <li key={task} className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700">
                            {task}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default Report;
