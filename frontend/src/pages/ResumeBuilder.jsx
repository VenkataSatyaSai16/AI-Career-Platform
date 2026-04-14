import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import { generateResume, resumeChat } from "../services/api";

const RESUME_STORAGE_KEY = "ai-interview-resume";

const builderFields = ["name", "education", "skills", "projects", "experience"];

function ResumeBuilder() {
  const navigate = useNavigate();
  const savedResume = useMemo(() => JSON.parse(localStorage.getItem(RESUME_STORAGE_KEY) || "null"), []);
  const [messages, setMessages] = useState([]);
  const [answer, setAnswer] = useState("");
  const [builderData, setBuilderData] = useState({
    name: "",
    education: "",
    skills: "",
    projects: "",
    experience: ""
  });
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [generatedResume, setGeneratedResume] = useState(savedResume?.source === "builder" ? savedResume.resumeText : "");

  useEffect(() => {
    const loadFirstQuestion = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await resumeChat({
          step: 0,
          data: builderData
        });

        setMessages([
          {
            role: "interviewer",
            content: response.question
          }
        ]);
        setStep(response.step);
      } catch (chatError) {
        setError(chatError.message);
      } finally {
        setLoading(false);
      }
    };

    loadFirstQuestion();
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!answer.trim()) {
      return;
    }

    const currentField = builderFields[step];
    const nextData = {
      ...builderData,
      [currentField]: answer.trim()
    };
    const nextMessages = [
      ...messages,
      { role: "candidate", content: answer.trim() }
    ];

    setBuilderData(nextData);
    setMessages(nextMessages);
    setAnswer("");
    setSubmitting(true);
    setError("");

    try {
      const response = await resumeChat({
        step: step + 1,
        data: nextData
      });

      if (response.isComplete) {
        setMessages([
          ...nextMessages,
          {
            role: "feedback",
            content: "Thanks. I have everything I need. Generating your ATS-friendly resume now."
          }
        ]);

        const generated = await generateResume({ data: nextData });
        localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(generated));
        setGeneratedResume(generated.resumeText);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            role: "feedback",
            content: "Your resume is ready. Review the preview below, then start the interview when you're ready."
          }
        ]);
        return;
      }

      setStep(response.step);
      setMessages([
        ...nextMessages,
        {
          role: "interviewer",
          content: response.question
        }
      ]);
    } catch (chatError) {
      setError(chatError.message);
    } finally {
      setSubmitting(false);
    }
  };

  const completedSteps = builderFields.filter((field) => builderData[field]).length;
  const progressValue = (completedSteps / builderFields.length) * 100;

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Resume builder</p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">Build your ATS-friendly resume</h1>
          </div>

          <button
            type="button"
            onClick={() => navigate("/interview-workspace")}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Back to Interview Workspace
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <ChatBox
            messages={messages}
            answer={answer}
            onAnswerChange={setAnswer}
            onSubmit={handleSubmit}
            isLoading={loading}
            isSubmitting={submitting}
            progressText={`Step ${Math.min(completedSteps + 1, builderFields.length)} of ${builderFields.length}`}
            progressValue={progressValue}
            statusLabel={generatedResume ? "Resume generated" : "Answer each prompt to build your resume"}
            title="Resume Builder Assistant"
            eyebrow="Conversation"
            submitLabel="Send Response"
            placeholder="Type your response..."
          />

          <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-500">Preview</p>
                <h2 className="text-xl font-semibold text-slate-900">Generated resume</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                ATS-friendly
              </span>
            </div>

            {!generatedResume ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                Complete the chat and your resume preview will appear here.
              </div>
            ) : (
              <>
                <pre className="mt-6 max-h-[560px] overflow-auto rounded-3xl bg-slate-950 px-5 py-5 text-sm leading-6 text-slate-100 whitespace-pre-wrap">
                  {generatedResume}
                </pre>

                <div className="mt-5 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      navigate("/interview", {
                        state: {
                          resumeText: generatedResume,
                          mode: "resume",
                          difficulty: "intermediate"
                        }
                      })
                    }
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Start Interview with this Resume
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate("/interview-workspace")}
                    className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Return to Interview Workspace
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default ResumeBuilder;
