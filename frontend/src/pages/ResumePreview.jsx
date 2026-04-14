import React, { useState } from "react";
import ResumePreviewCard from "../components/resume/ResumePreview";

function ResumePreviewPage({ resume, templateId }) {
  const [zoom, setZoom] = useState(1);

  return (
    <section className="rounded-[2rem] border border-slate-200 bg-slate-100/80 p-6 shadow-lg shadow-slate-200/70">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Full-page preview</h2>
          <p className="mt-1 text-sm text-slate-500">Rendered on an A4-sized page for a cleaner ATS review experience.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((current) => Math.max(0.7, Number((current - 0.1).toFixed(1))))}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            -
          </button>
          <span className="min-w-16 text-center text-sm font-medium text-slate-600">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((current) => Math.min(1.3, Number((current + 0.1).toFixed(1))))}
            className="rounded-2xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            +
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-auto">
        <div className="flex justify-center">
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            <div className="mx-auto w-[794px] min-h-[1123px] bg-white">
              <ResumePreviewCard resume={resume} templateId={templateId} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ResumePreviewPage;
