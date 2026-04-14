import React from "react";

const styles = {
  interviewer: {
    card: "border border-slate-200 bg-slate-50 text-slate-900 shadow-sm shadow-slate-200/60",
    label: "text-slate-500"
  },
  candidate: {
    card: "border border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-900/10",
    label: "text-slate-300"
  },
  feedback: {
    card: "border border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm shadow-emerald-100",
    label: "text-emerald-700"
  },
  system: {
    card: "border border-amber-200 bg-amber-50 text-amber-900 shadow-sm shadow-amber-100",
    label: "text-amber-700"
  }
};

function Message({ role, content }) {
  const variant = styles[role] || styles.system;
  const labels = {
    interviewer: "AI Interviewer",
    candidate: "Your Answer",
    feedback: "Feedback",
    system: "System"
  };

  return (
    <div className={`max-w-2xl rounded-[1.4rem] px-4 py-3 text-sm leading-6 ${variant.card}`}>
      <p className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${variant.label}`}>{labels[role] || labels.system}</p>
      <p className="whitespace-pre-wrap">{content}</p>
    </div>
  );
}

export default Message;
