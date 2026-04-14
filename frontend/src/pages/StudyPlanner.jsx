import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  generateStudyPlannerPlan,
  getStudyPlannerPlan,
  getStudyPlannerProgress,
  replanStudyPlannerPlan,
  rescheduleStudyPlannerPlan,
  sendStudyPlanEmail,
  updateStudyPlannerProgress
} from "../services/api";

const AUTH_STORAGE_KEY = "ai-interview-auth";

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(date) {
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function getDateForDay(startDate, day) {
  const date = new Date(startDate);
  date.setDate(date.getDate() + (Number(day) - 1));
  return date;
}

function toIcsDateTime(date, hh, mm, ss) {
  const yyyy = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const h = String(hh).padStart(2, "0");
  const m = String(mm).padStart(2, "0");
  const s = String(ss).padStart(2, "0");
  return `${yyyy}${month}${dd}T${h}${m}${s}`;
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function statusClass(status) {
  if (status === "completed") {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }

  if (status === "missed") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }

  return "bg-amber-50 text-amber-800 border-amber-200";
}

function StudyPlanner() {
  const navigate = useNavigate();
  const authUser = useMemo(() => JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || "null"), []);
  const userId = authUser?.id || "admin";
  const timerRef = useRef(null);
  const [brief, setBrief] = useState("");
  const [hours, setHours] = useState("2");
  const [startDate, setStartDate] = useState(todayString());
  const [shareEmail, setShareEmail] = useState("");
  const [plan, setPlan] = useState(null);
  const [parsedInput, setParsedInput] = useState(null);
  const [progress, setProgress] = useState({});
  const [resultMessage, setResultMessage] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [activeAction, setActiveAction] = useState("");
  const [progressValue, setProgressValue] = useState(0);

  const totalDays = plan?.days?.length || 0;
  const completedDays = Object.values(progress).filter((item) => item === "completed").length;
  const missedDays = Object.values(progress).filter((item) => item === "missed").length;

  useEffect(() => {
    const loadSavedPlan = async () => {
      try {
        const response = await getStudyPlannerPlan(userId);
        setPlan(response.plan);
        setBrief(response.metadata?.lastInput || "");
        setParsedInput(
          response.metadata?.course
            ? {
                course: response.metadata.course,
                duration: String(response.plan?.days?.length || ""),
                level: response.metadata.knowledgeLevel || "beginner",
                objective: response.metadata.objective || "general learning"
              }
            : null
        );

        if (response.plan?.days?.length) {
          const progressResponse = await getStudyPlannerProgress(userId, response.plan.days.length);
          setProgress(progressResponse.days || {});
        }
      } catch (error) {
        if (!String(error.message || "").toLowerCase().includes("no saved plan")) {
          setResultMessage(error.message);
        }
      } finally {
        setInitialLoading(false);
      }
    };

    loadSavedPlan();

    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
      }
    };
  }, [userId]);

  const startProgress = (label) => {
    setActiveAction(label);
    setProgressValue(0);

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }

    timerRef.current = window.setInterval(() => {
      setProgressValue((current) => Math.min(current + Math.floor(Math.random() * 12) + 4, 92));
    }, 450);
  };

  const completeProgress = () => {
    setProgressValue(100);

    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    window.setTimeout(() => {
      setActiveAction("");
      setProgressValue(0);
    }, 350);
  };

  const refreshProgress = async (days) => {
    const response = await getStudyPlannerProgress(userId, days);
    setProgress(response.days || {});
  };

  const handleGenerate = async () => {
    if (!brief.trim()) {
      setResultMessage("Add a natural language brief to generate your study plan.");
      return;
    }

    setResultMessage("");
    setShareStatus("");
    startProgress("Generating your plan...");

    try {
      const response = await generateStudyPlannerPlan({
        user_input: brief,
        hours,
        user_id: userId
      });

      setPlan(response.plan);
      setParsedInput(response.parsedInput || null);
      await refreshProgress(response.plan.days.length);
      setResultMessage("Plan generated successfully. You can now mark days as completed or missed.");
    } catch (error) {
      setResultMessage(error.message);
    } finally {
      completeProgress();
    }
  };

  const handleStatusUpdate = async (day, status) => {
    try {
      await updateStudyPlannerProgress({ user_id: userId, day, status });
      setProgress((current) => ({ ...current, [String(day)]: status }));
      setResultMessage(`Day ${day} marked as ${status}.`);
    } catch (error) {
      setResultMessage(error.message);
    }
  };

  const handleReplan = async () => {
    startProgress("Updating your remaining plan...");

    try {
      const response = await replanStudyPlannerPlan({ user_id: userId });
      setPlan(response.plan);
      await refreshProgress(response.plan.days.length);
      setResultMessage("Plan updated successfully using the AI re-planning flow.");
    } catch (error) {
      setResultMessage(error.message);
    } finally {
      completeProgress();
    }
  };

  const handleReschedule = async () => {
    startProgress("Rescheduling missed days...");

    try {
      const response = await rescheduleStudyPlannerPlan({ user_id: userId });
      setPlan(response.plan);
      await refreshProgress(response.plan.days.length);
      const movedDays = (response.rescheduleSummary?.missedDays || []).join(", ");
      setResultMessage(`Rescheduled missed days${movedDays ? `: ${movedDays}` : ""}.`);
    } catch (error) {
      setResultMessage(error.message);
    } finally {
      completeProgress();
    }
  };

  const buildPdfDoc = () => {
    if (!plan?.days?.length) {
      setResultMessage("Generate a plan first.");
      return null;
    }

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const title = `${parsedInput?.course || "Study Plan"} Study Plan`;
    const summary = plan.summary || "";
    const summaryLines = doc.splitTextToSize(summary, 760);

    doc.setFontSize(18);
    doc.text(title, 40, 36);
    doc.setFontSize(10);
    doc.text(summaryLines, 40, 56);

    const rows = plan.days.map((item, index) => {
      const day = Number(item.day || index + 1);
      return [
        String(day),
        formatDate(getDateForDay(startDate, day)),
        String(item.title || ""),
        String(item.focus || ""),
        String(item.estimated_hours || ""),
        String(progress[String(day)] || "pending"),
        String(item.resource_title || ""),
        String(item.resource_url || "")
      ];
    });

    autoTable(doc, {
      startY: Math.max(80, 56 + summaryLines.length * 11),
      head: [["Day", "Date", "Topic", "Focus", "Hours", "Status", "Reference", "URL"]],
      body: rows,
      styles: { fontSize: 8, cellPadding: 4, overflow: "linebreak" },
      columnStyles: { 7: { cellWidth: 220 } },
      headStyles: { fillColor: [15, 23, 42] }
    });

    return doc;
  };

  const handleDownloadPdf = () => {
    const doc = buildPdfDoc();

    if (doc) {
      doc.save("study_plan.pdf");
    }
  };

  const buildCalendarContent = () => {
    if (!plan?.days?.length) {
      return "";
    }

    const stamp = new Date();
    const dtstamp = `${stamp.getUTCFullYear()}${String(stamp.getUTCMonth() + 1).padStart(2, "0")}${String(stamp.getUTCDate()).padStart(2, "0")}T${String(stamp.getUTCHours()).padStart(2, "0")}${String(stamp.getUTCMinutes()).padStart(2, "0")}${String(stamp.getUTCSeconds()).padStart(2, "0")}Z`;
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//AI Study Planner//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];

    plan.days.forEach((item, index) => {
      const day = Number(item.day || index + 1);
      const eventDate = getDateForDay(startDate, day);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${Date.now()}-${day}@ai-study-planner`);
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${toIcsDateTime(eventDate, 9, 0, 0)}`);
      lines.push(`DTEND:${toIcsDateTime(eventDate, 10, 0, 0)}`);
      lines.push(`SUMMARY:${escapeIcsText(`Day ${day}: ${item.title || "Study Session"}`)}`);
      lines.push(
        `DESCRIPTION:${escapeIcsText(`Focus: ${item.focus || ""}\nHours: ${item.estimated_hours || ""}\nResource: ${item.resource_url || ""}`)}`
      );
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  };

  const handleShare = async () => {
    if (!shareEmail.trim()) {
      setShareStatus("Enter an email address to share the plan.");
      return;
    }

    const doc = buildPdfDoc();

    if (!doc) {
      return;
    }

    try {
      setShareStatus("Sharing PDF and calendar...");
      const pdfBuffer = doc.output("arraybuffer");
      const calendar = buildCalendarContent();

      await sendStudyPlanEmail({
        email: shareEmail,
        course: parsedInput?.course || "Study Plan",
        pdf_base64: arrayBufferToBase64(pdfBuffer),
        calendar_ics_base64: btoa(unescape(encodeURIComponent(calendar)))
      });

      setShareStatus("PDF and calendar shared successfully.");
    } catch (error) {
      setShareStatus(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">AI Study Planner</p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Plan around the learner, not just the subject.</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
                Describe what you want to learn in plain language. The planner extracts the brief, builds a day-wise roadmap,
                lets you track progress, and can reschedule or rewrite the remaining plan when needed.
              </p>
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

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Planning brief</h2>
                <p className="mt-1 text-sm text-slate-500">Use one sentence or a short paragraph. The AI will extract the key details for you.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Learner context</span>
            </div>

            <div className="mt-6 space-y-4">
              <textarea
                value={brief}
                onChange={(event) => setBrief(event.target.value)}
                rows={8}
                placeholder="Example: I want to learn DSA in 30 days, I know basics, and I am preparing for placements."
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
              />

              {parsedInput ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <strong className="text-slate-900">AI extracted:</strong> Course: {parsedInput.course} | Duration: {parsedInput.duration} days |
                  Level: {parsedInput.level} | Objective: {parsedInput.objective}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Hours / day</span>
                  <input value={hours} onChange={(event) => setHours(event.target.value)} type="number" min="1" step="0.5" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start date</span>
                  <input value={startDate} onChange={(event) => setStartDate(event.target.value)} type="date" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Share by email</span>
                  <input value={shareEmail} onChange={(event) => setShareEmail(event.target.value)} type="email" placeholder="student@example.com" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                </label>
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleGenerate} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Generate Strategy Plan</button>
                <button type="button" onClick={handleDownloadPdf} disabled={!plan?.days?.length} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Download PDF</button>
                <button type="button" onClick={handleShare} disabled={!plan?.days?.length} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Send PDF + Calendar</button>
              </div>

              {shareStatus ? <p className="text-sm text-slate-600">{shareStatus}</p> : null}
              {resultMessage ? <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{resultMessage}</div> : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Generated plan</h2>
                <p className="mt-1 text-sm text-slate-500">Summary, progress controls, and re-planning actions appear here.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleReplan} disabled={!plan?.days?.length} className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">Update Plan</button>
                <button type="button" onClick={handleReschedule} disabled={!plan?.days?.length} className="rounded-2xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Reschedule Missed Days</button>
              </div>
            </div>

            {activeAction ? (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a,#14b8a6)] transition-all duration-300" style={{ width: `${progressValue}%` }} />
                </div>
                <p className="mt-3 text-sm text-slate-600">{activeAction} {progressValue}%</p>
              </div>
            ) : null}

            {initialLoading ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500">Loading saved study plan...</div>
            ) : null}

            {!initialLoading && !plan?.days?.length ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">
                Generate a plan to see the full day-wise roadmap, progress controls, and export actions.
              </div>
            ) : null}

            {plan?.days?.length ? (
              <>
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Total Days</p><p className="mt-2 text-2xl font-semibold text-slate-900">{totalDays}</p></div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Completed</p><p className="mt-2 text-2xl font-semibold text-emerald-700">{completedDays}</p></div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-4"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Missed</p><p className="mt-2 text-2xl font-semibold text-rose-700">{missedDays}</p></div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">{plan.summary}</div>

                <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="min-w-[980px] divide-y divide-slate-200">
                    <thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Day</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Topic</th>
                        <th className="px-4 py-3">Focus</th>
                        <th className="px-4 py-3">Hours</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Progress</th>
                        <th className="px-4 py-3">Reference</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white text-sm text-slate-700">
                      {plan.days.map((item, index) => {
                        const day = Number(item.day || index + 1);
                        const status = progress[String(day)] || "pending";
                        return (
                          <tr key={`${day}-${item.title}`}>
                            <td className="px-4 py-4 font-semibold text-slate-900">{day}</td>
                            <td className="px-4 py-4">{formatDate(getDateForDay(startDate, day))}</td>
                            <td className="px-4 py-4">
                              <p className="font-semibold text-slate-900">{item.title}</p>
                              {item.original_day && Number(item.original_day) !== day ? (
                                <p className="mt-1 text-xs font-semibold text-amber-700">Moved from day {item.original_day}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-4">{item.focus}</td>
                            <td className="px-4 py-4">{item.estimated_hours}</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(status)}`}>{status}</span>
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => handleStatusUpdate(day, "completed")} className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100">Completed</button>
                                <button type="button" onClick={() => handleStatusUpdate(day, "missed")} className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100">Missed</button>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              {item.resource_url ? (
                                <a href={item.resource_url} target="_blank" rel="noreferrer" className="font-semibold text-blue-700 hover:underline">
                                  {item.resource_title || item.resource_url}
                                </a>
                              ) : "N/A"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

export default StudyPlanner;
