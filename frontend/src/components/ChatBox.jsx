import React, { useEffect, useRef } from "react";
import Message from "./Message";

function ChatBox({
  messages,
  answer,
  onAnswerChange,
  onSubmit,
  isLoading,
  isSubmitting,
  progressText,
  progressValue,
  statusLabel,
  title = "AI Interview Session",
  eyebrow = "Live interview",
  submitLabel = "Submit Answer",
  placeholder = "Type your answer...",
  footerActions = [],
  footerHint = ""
}) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex h-[78vh] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(241,245,249,0.9))] px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{eyebrow}</p>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{progressText}</p>
          </div>

          <div className="min-w-[180px]">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <span>Progress</span>
              <span>{Math.round(progressValue)}%</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a,#334155,#14b8a6)] transition-[width] duration-500 ease-out"
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        </div>

        {statusLabel ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600">
            <span className={`h-2 w-2 rounded-full ${isLoading || isSubmitting ? "animate-pulse bg-amber-500" : "bg-emerald-500"}`} />
            {statusLabel}
          </div>
        ) : null}
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(226,232,240,0.45),transparent_35%)] px-6 py-6">
        {messages.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
            No interview history available yet.
          </div>
        ) : null}

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex transition-all duration-300 ease-out ${message.role === "candidate" ? "justify-end" : "justify-start"}`}
          >
            <Message role={message.role} content={message.content} />
          </div>
        ))}

        {isLoading || isSubmitting ? (
          <div className="flex justify-start">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-500 [animation-delay:-0.1s]" />
                  <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-slate-600" />
                </div>
                <p className="text-sm text-slate-500">AI is typing...</p>
              </div>
            </div>
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-200 p-4">
        {footerActions.length ? (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {footerActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.onClick}
                disabled={action.disabled}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  action.variant === "primary"
                    ? "bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-300"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-100"
                } disabled:cursor-not-allowed`}
              >
                {action.label}
              </button>
            ))}
            {footerHint ? <p className="text-xs text-slate-500">{footerHint}</p> : null}
          </div>
        ) : null}

        <div className="flex flex-col gap-3 md:flex-row">
          <textarea
            value={answer}
            onChange={(event) => onAnswerChange(event.target.value)}
            placeholder={placeholder}
            rows={4}
            className="min-h-28 flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50"
            disabled={isSubmitting || isLoading}
          />
          <button
            type="submit"
            disabled={isSubmitting || isLoading || !answer.trim()}
            className="rounded-2xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isSubmitting || isLoading ? "Working..." : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

export default ChatBox;
