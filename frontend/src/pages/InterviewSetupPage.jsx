import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ErrorAlert from "../components/ErrorAlert";
import SectionCard from "../components/SectionCard";
import { useAuth } from "../hooks/useAuth";
import { saveInterviewSession } from "../services/authStorage";
import { startInterview } from "../services/interviewService";

const initialForm = {
  role: "resume",
  difficulty: "intermediate",
  topic: "",
  duration: "15"
};

function InterviewSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      const response = await startInterview({
        userId: user?.id,
        mode: form.role,
        difficulty: form.difficulty,
        topic: form.topic,
        duration: Number(form.duration),
        resumeText: [
          `Role: ${form.role}`,
          `Topic: ${form.topic}`,
          `Planned duration: ${form.duration} minutes`,
          `Candidate: ${user?.name || user?.username || user?.email || "Unknown"}`
        ].join("\n")
      });

      saveInterviewSession({
        sessionId: response.sessionId,
        question: response.firstQuestion,
        currentQuestion: 1,
        maxQuestions: response.maxQuestions,
        role: form.role,
        difficulty: form.difficulty,
        topic: form.topic,
        duration: form.duration
      });

      navigate("/interview/session");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <p className="text-sm font-medium text-cyan-700">Configure your session</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">Start a new interview</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Choose the interview mode, focus area, and duration. The backend will create your session and return the first question.
        </p>
      </div>

      <SectionCard title="Interview setup form" subtitle="All values are sent through the backend integration layer">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <ErrorAlert message={error} />
          <div className="grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Role</span>
              <select name="role" value={form.role} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                <option value="resume">Resume</option>
                <option value="HR">HR</option>
                <option value="DSA">DSA</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Difficulty</span>
              <select name="difficulty" value={form.difficulty} onChange={handleChange} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
          </div>
          <div className="grid gap-5 md:grid-cols-[1fr_180px]">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Topic</span>
              <input
                type="text"
                name="topic"
                value={form.topic}
                onChange={handleChange}
                placeholder="Example: React system design"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                required
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">Duration</span>
              <input
                type="number"
                min="5"
                max="120"
                name="duration"
                value={form.duration}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-100"
                required
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Creating session..." : "Launch interview"}
          </button>
        </form>
      </SectionCard>
    </div>
  );
}

export default InterviewSetupPage;
