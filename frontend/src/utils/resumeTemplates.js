export const resumeTemplates = {
  minimal: {
    id: "minimal",
    name: "Minimal ATS",
    description: "Single column, clean spacing, ATS-first structure.",
    sectionOrder: ["summary", "skills", "experience", "projects", "education", "certifications", "achievements", "customSections", "hobbies"],
    containerClassName: "bg-white text-slate-900",
    headerClassName: "border-b border-slate-200 pb-5",
    sectionTitleClassName: "text-xs font-bold uppercase tracking-[0.22em] text-slate-500",
    sectionClassName: "border-t border-slate-200 pt-5"
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "Clear section hierarchy with strong readability.",
    sectionOrder: ["summary", "experience", "projects", "skills", "education", "certifications", "achievements", "customSections", "hobbies"],
    containerClassName: "bg-white text-slate-900",
    headerClassName: "border-b-2 border-slate-900 pb-5",
    sectionTitleClassName: "text-sm font-semibold uppercase tracking-[0.18em] text-slate-900",
    sectionClassName: "pt-5"
  },
  modern: {
    id: "modern",
    name: "Modern",
    description: "Subtle styling with an ATS-safe text layout.",
    sectionOrder: ["summary", "skills", "projects", "experience", "education", "certifications", "achievements", "customSections", "hobbies"],
    containerClassName: "bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] text-slate-900",
    headerClassName: "rounded-3xl bg-slate-950 px-6 py-5 text-white",
    sectionTitleClassName: "text-xs font-bold uppercase tracking-[0.24em] text-cyan-700",
    sectionClassName: "rounded-3xl border border-slate-200 bg-white px-5 py-5"
  },
  compact: {
    id: "compact",
    name: "Compact",
    description: "Tighter spacing for fresher profiles and shorter resumes.",
    sectionOrder: ["summary", "education", "skills", "projects", "experience", "certifications", "achievements", "customSections", "hobbies"],
    containerClassName: "bg-white text-slate-900",
    headerClassName: "border-b border-slate-300 pb-4",
    sectionTitleClassName: "text-xs font-semibold uppercase tracking-[0.18em] text-slate-600",
    sectionClassName: "pt-4"
  }
};

export function getResumeTemplate(templateId) {
  return resumeTemplates[templateId] || resumeTemplates.minimal;
}
