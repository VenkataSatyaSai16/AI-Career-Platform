import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { generateInterviewPlan, getHistory, logout, uploadResume } from "../services/api";
import { clearAuth, getStoredAuthUser } from "../utils/auth";
const RESUME_STORAGE_KEY = "ai-interview-resume";
const FRIENDLY_ERROR_MESSAGE = "Something went wrong. Please try again.";

function InterviewWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const savedResume = useMemo(() => JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || "null"), []);
  const [resumeText, setResumeText] = useState(savedResume?.resumeText || "");
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadedResume, setUploadedResume] = useState(savedResume);
  const [history, setHistory] = useState([]);
  const [mode, setMode] = useState("resume");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [savingResume, setSavingResume] = useState(false);
  const [creatingPlanForSession, setCreatingPlanForSession] = useState("");
  const [showFeedbackGenerator, setShowFeedbackGenerator] = useState(Boolean(location.state?.openPlanGenerator));
  const [error, setError] = useState("");
  const [resumeMessage, setResumeMessage] = useState("");

  useEffect(() => {
    const loadHistory = async () => {
      if (!authUser?.id) {
        setLoadingHistory(false);
        return;
      }

      try {
        const items = await getHistory(authUser.id);
        setHistory(items);
      } catch (historyError) {
        setError(historyError.message || FRIENDLY_ERROR_MESSAGE);
      } finally {
        setLoadingHistory(false);
      }
    };

    loadHistory();
  }, [authUser]);

  const handleResumeUpload = async (event) => {
    event.preventDefault();
    setSavingResume(true);
    setError("");
    setResumeMessage("");

    try {
      const result = await uploadResume({ resumeText, file: selectedFile });
      localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(result));
      setUploadedResume(result);
      setResumeText(result.resumeText);
      setResumeMessage(selectedFile ? "Resume PDF processed successfully." : "Resume text saved successfully.");
    } catch (uploadError) {
      setError(uploadError.message || FRIENDLY_ERROR_MESSAGE);
    } finally {
      setSavingResume(false);
    }
  };

  const handleStartInterview = () => {
    const activeResume = uploadedResume?.resumeText || resumeText.trim();

    if (!activeResume) {
      setError("Upload or paste a resume before starting the interview.");
      return;
    }

    navigate("/interview", {
      state: {
        resumeText: activeResume,
        mode,
        difficulty
      }
    });
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_error) {
      // Keep client-side logout resilient.
    }

    clearAuth();
    navigate("/", { replace: true });
  };

  const handleGeneratePlanFromFeedback = async (item) => {
    setCreatingPlanForSession(item.sessionId);
    setError("");

    try {
      const response = await generateInterviewPlan({
        sessionId: item.sessionId,
        company: "",
        role: item.mode || "Interview feedback",
        feedbackText: item.feedbackText || item.summary || "",
        weakAreas: item.weakAreas || []
      });
      navigate(`/calendar?planId=${encodeURIComponent(response.planId)}`);
    } catch (planError) {
      setError(planError.message || FRIENDLY_ERROR_MESSAGE);
    } finally {
      setCreatingPlanForSession("");
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">AI Interview</p>
              <h1 className="mt-3 text-3xl font-bold">Interview workspace</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
                Upload a resume, practice with AI, revisit your reports, and keep the whole interview loop in one place.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Back to Workspace
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Resume Context</p>
              <p className="mt-2 text-sm text-slate-200">Paste text or upload a PDF so the interview stays grounded in your projects.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Adaptive Modes</p>
              <p className="mt-2 text-sm text-slate-200">Switch between resume, HR, and DSA with beginner to advanced depth.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Report History</p>
              <p className="mt-2 text-sm text-slate-200">Review past interview reports and keep building on earlier feedback.</p>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Resume setup</h2>
                <p className="mt-1 text-sm text-slate-500">Paste resume text or upload a PDF, then launch the interview.</p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={mode}
                  onChange={(event) => setMode(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none"
                >
                  <option value="resume">Resume</option>
                  <option value="HR">HR</option>
                  <option value="DSA">DSA</option>
                </select>

                <select
                  value={difficulty}
                  onChange={(event) => setDifficulty(event.target.value)}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm outline-none"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <form onSubmit={handleResumeUpload} className="mt-6 space-y-4">
              {!uploadedResume?.resumeText && !resumeText.trim() ? (
                <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No resume uploaded yet. Paste resume text or upload a PDF to get started.
                </div>
              ) : null}

              <textarea
                value={resumeText}
                onChange={(event) => setResumeText(event.target.value)}
                rows={10}
                placeholder="Paste the candidate's resume text here..."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
                <label className="block text-sm font-medium text-slate-700">Optional PDF upload</label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                  className="mt-3 block w-full text-sm text-slate-500"
                />
              </div>

              {resumeMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {resumeMessage}
                </div>
              ) : null}

              {error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={savingResume || (!resumeText.trim() && !selectedFile)}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingResume ? "Saving..." : "Save Resume"}
                </button>

                <button
                  type="button"
                  onClick={handleStartInterview}
                  disabled={!(uploadedResume?.resumeText || resumeText.trim())}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Start Interview
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/resume-builder")}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Build Resume
                </button>

                <button
                  type="button"
                  onClick={() => setShowFeedbackGenerator((current) => !current)}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Generate Plan from Feedback
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Previous sessions</h2>
                <p className="mt-1 text-sm text-slate-500">Open any completed session to review the final report.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowFeedbackGenerator((current) => !current)}
                className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Generate Plan from Feedback
              </button>
            </div>

            {showFeedbackGenerator ? (
              <div className="mt-5 rounded-3xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-700">Create Later</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  Feedback is always saved first. You can create a study plan from any completed interview whenever you are ready.
                </p>
              </div>
            ) : null}

            <div className="mt-6 space-y-3">
              {loadingHistory ? <p className="text-sm text-slate-500">Loading interview history...</p> : null}

              {!loadingHistory && history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">
                  No history available yet.
                </div>
              ) : null}

              {history.map((item) => (
                <div
                  key={item.sessionId}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" onClick={() => navigate(`/report/${item.sessionId}`)} className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-semibold text-slate-900">{item.mode} interview</p>
                        {item.suggestionAvailable ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-800">
                            Suggested Plan Available
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{new Date(item.date).toLocaleString()}</p>
                    </button>
                    <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                      Score {item.score}/10
                    </span>
                  </div>

                  {showFeedbackGenerator ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <p className="flex-1 text-sm text-slate-600">{item.summary || "Saved interview feedback is ready for optional plan generation."}</p>
                      <button
                        type="button"
                        onClick={() => handleGeneratePlanFromFeedback(item)}
                        disabled={creatingPlanForSession === item.sessionId}
                        className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {creatingPlanForSession === item.sessionId ? "Creating..." : "Create Study Plan"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default InterviewWorkspace;
