import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import SectionCard from "../components/SectionCard";
import { clearInterviewSession, getInterviewSession, saveInterviewSession } from "../services/authStorage";
import { submitInterviewAnswer } from "../services/interviewService";

function InterviewSessionPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState(() => getInterviewSession());
  const [answer, setAnswer] = useState("");
  const [timeLeft, setTimeLeft] = useState(() => Number(getInterviewSession()?.duration || 15) * 60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.duration) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [session?.duration]);

  const timerLabel = useMemo(() => {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, "0");
    const seconds = String(timeLeft % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [timeLeft]);

  if (!session?.sessionId || !session?.question) {
    return <Navigate to="/interview/setup" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      const response = await submitInterviewAnswer({
        sessionId: session.sessionId,
        answer
      });

      if (response?.status === "completed" || !response?.nextQuestion) {
        clearInterviewSession();
        navigate(`/interview/result?id=${session.sessionId}`, { replace: true });
        return;
      }

      const nextSessionState = {
        ...session,
        question: response.nextQuestion,
        currentQuestion: Number(response.currentQuestion || session.currentQuestion || 1) + 1
      };

      saveInterviewSession(nextSessionState);
      setSession(nextSessionState);
      setAnswer("");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="grid gap-4 md:grid-cols-[1fr_260px]">
        <SectionCard title="Live interview session" subtitle={`${session.role} · ${session.difficulty} · ${session.topic}`}>
          <div className="space-y-4">
            <div className="rounded-3xl bg-slate-950 p-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Question {session.currentQuestion || 1} of {session.maxQuestions || 5}
              </p>
              <p className="mt-4 text-xl font-medium leading-8">{session.question}</p>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <ErrorAlert message={error} />
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Your answer</span>
                <textarea
                  rows="10"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  className="w-full rounded-3xl border border-slate-200 px-4 py-4 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                  placeholder="Write your answer here..."
                  required
                />
              </label>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Submitting answer..." : "Submit answer"}
              </button>
            </form>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Timer">
            <div className="rounded-3xl bg-cyan-50 p-6 text-center">
              <p className="text-sm font-medium text-slate-500">Time remaining</p>
              <p className="mt-3 text-4xl font-semibold text-slate-950">{timerLabel}</p>
            </div>
          </SectionCard>
          <SectionCard title="Session details">
            <dl className="space-y-3 text-sm text-slate-600">
              <div className="flex justify-between gap-3">
                <dt>Role</dt>
                <dd className="font-semibold text-slate-900">{session.role}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Difficulty</dt>
                <dd className="font-semibold text-slate-900">{session.difficulty}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Topic</dt>
                <dd className="font-semibold text-slate-900">{session.topic}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Duration</dt>
                <dd className="font-semibold text-slate-900">{session.duration} min</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

export default InterviewSessionPage;
