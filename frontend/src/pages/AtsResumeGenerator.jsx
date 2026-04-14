import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateResume } from "../services/api";
import ResumePreviewPage from "./ResumePreview";
import { getStoredAuthUser } from "../utils/auth";
import { getResumeTemplate, resumeTemplates } from "../utils/resumeTemplates";
import {
  COUNTRY_CODE_OPTIONS,
  buildResumePayload,
  createEmptyCodingPlatform,
  createEmptyCustomSection,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyProject,
  createEmptySkillCategory,
  createInitialResumeForm,
  formatDateRange,
  normalizeResumeData,
  validateResumeForm
} from "../utils/resumeForm";

const ATS_RESUME_STORAGE_KEY = "ai-ats-resume";

function downloadTextFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function SectionCard({ title, description, visible, onToggle, children, actionLabel, onAction }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {typeof visible === "boolean" ? (
              <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                <input type="checkbox" checked={visible} onChange={onToggle} className="h-4 w-4 rounded border-slate-300" />
                Visible
              </label>
            ) : null}
          </div>
          {description ? <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
        {actionLabel ? (
          <button
            type="button"
            onClick={onAction}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function AtsResumeGenerator() {
  const navigate = useNavigate();
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const storedResume = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(ATS_RESUME_STORAGE_KEY) || "null");
    } catch (_error) {
      return null;
    }
  }, []);
  const initialForm = useMemo(() => {
    try {
      return normalizeResumeData(storedResume?.structuredResume || createInitialResumeForm());
    } catch (normalizationError) {
      console.error("Failed to normalize ATS resume data", normalizationError);
      localStorage.removeItem(ATS_RESUME_STORAGE_KEY);
      return createInitialResumeForm();
    }
  }, [storedResume]);
  const [form, setForm] = useState(initialForm);
  const [generatedResume, setGeneratedResume] = useState(
    (() => {
      try {
        return storedResume?.structuredResume ? normalizeResumeData(storedResume.structuredResume) : null;
      } catch (normalizationError) {
        console.error("Failed to restore generated ATS resume", normalizationError);
        return null;
      }
    })()
  );
  const [pdfUrl, setPdfUrl] = useState(storedResume?.pdfUrl || "");
  const [latexText, setLatexText] = useState(storedResume?.latexText || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const hasMountedRef = useRef(false);

  const selectedTemplate = getResumeTemplate(form?.template);
  const livePreviewResume = useMemo(() => {
    try {
      return buildResumePayload(form);
    } catch (previewError) {
      console.error("Failed to build ATS preview payload", previewError);
      return buildResumePayload(createInitialResumeForm());
    }
  }, [form]);

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }

    if (!generatedResume) {
      return;
    }

    setGeneratedResume(null);
    setStatus("");
  }, [form]);

  const updatePersonalInfo = (field, value) => {
    setForm((current) => ({
      ...current,
      personalInfo: {
        ...current.personalInfo,
        [field]: value
      }
    }));
  };

  const updateTopLevel = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateSectionVisibility = (sectionKey) => {
    setForm((current) => ({
      ...current,
      sectionVisibility: {
        ...current.sectionVisibility,
        [sectionKey]: !current.sectionVisibility[sectionKey]
      }
    }));
  };

  const updateArrayObjectField = (field, index, key, value) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
    }));
  };

  const updateStringArrayField = (field, index, value) => {
    setForm((current) => ({
      ...current,
      [field]: current[field].map((item, itemIndex) => (itemIndex === index ? value : item))
    }));
  };

  const addArrayItem = (field, factory) => {
    setForm((current) => ({
      ...current,
      [field]: [...current[field], factory()]
    }));
  };

  const removeArrayItem = (field, index, fallbackFactory) => {
    setForm((current) => {
      const nextItems = current[field].filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        [field]: nextItems.length ? nextItems : [fallbackFactory()]
      };
    });
  };

  const updateSkillItem = (categoryIndex, skillIndex, value) => {
    setForm((current) => ({
      ...current,
      skills: current.skills.map((group, index) =>
        index === categoryIndex
          ? {
              ...group,
              items: group.items.map((item, itemIndex) => (itemIndex === skillIndex ? value : item))
            }
          : group
      )
    }));
  };

  const addSkillToCategory = (categoryIndex) => {
    setForm((current) => ({
      ...current,
      skills: current.skills.map((group, index) =>
        index === categoryIndex
          ? {
              ...group,
              items: [...group.items, ""]
            }
          : group
      )
    }));
  };

  const removeSkillFromCategory = (categoryIndex, skillIndex) => {
    setForm((current) => ({
      ...current,
      skills: current.skills.map((group, index) =>
        index === categoryIndex
          ? {
              ...group,
              items: group.items.filter((_, itemIndex) => itemIndex !== skillIndex).length
                ? group.items.filter((_, itemIndex) => itemIndex !== skillIndex)
                : [""]
            }
          : group
      )
    }));
  };

  const updateCustomSectionItem = (sectionIndex, itemIndex, value) => {
    setForm((current) => ({
      ...current,
      customSections: current.customSections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              items: section.items.map((item, currentItemIndex) => (currentItemIndex === itemIndex ? value : item))
            }
          : section
      )
    }));
  };

  const addItemToCustomSection = (sectionIndex) => {
    setForm((current) => ({
      ...current,
      customSections: current.customSections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              items: [...section.items, ""]
            }
          : section
      )
    }));
  };

  const removeItemFromCustomSection = (sectionIndex, itemIndex) => {
    setForm((current) => ({
      ...current,
      customSections: current.customSections.map((section, index) =>
        index === sectionIndex
          ? {
              ...section,
              items: section.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex).length
                ? section.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex)
                : [""]
            }
          : section
      )
    }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setStatus("");

    const validation = validateResumeForm(form);

    if (validation.errors.length) {
      setLoading(false);
      setError(validation.errors[0]);
      return;
    }

    try {
      const response = await generateResume({
        ...validation.payload,
        userId: authUser?.id || ""
      });

      const normalizedResume = normalizeResumeData(response.resume);
      setGeneratedResume(normalizedResume);
      setPdfUrl(response.pdfUrl || "");
      setLatexText(response.latexText || "");
      setStatus("Resume generated successfully.");
      localStorage.setItem(
        ATS_RESUME_STORAGE_KEY,
        JSON.stringify({
          source: "ats-generator",
          fileName: `${response.resume?.personalInfo?.fullName || "resume"}.txt`,
          resumeText: response.resumeText,
          pdfUrl: response.pdfUrl || "",
          latexText: response.latexText || "",
          structuredResume: response.resume
        })
      );
    } catch (generationError) {
      setError(generationError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!pdfUrl) {
      setError("Generate your resume before downloading it.");
      return;
    }

    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const handleDownloadLatex = () => {
    if (!latexText) {
      setError("Generate your resume before downloading the LaTeX file.");
      return;
    }

    downloadTextFile(latexText, `${form.personalInfo.fullName || "resume"}.tex`, "application/x-tex");
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-cyan-300">ATS Friendly Resume Generator</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">Build a richer ATS resume with structured sections and full-page preview.</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Add categorized skills, coding profiles, timeline-based experience, achievements, and dynamic sections while keeping the output clean and recruiter-friendly.
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

        <div className="mt-8 space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Resume details</h2>
                <p className="mt-1 text-sm text-slate-500">Structured inputs are stored in a backward-compatible format so older resumes still load cleanly.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {selectedTemplate.name}
              </span>
            </div>

            <div className="mt-6 space-y-6">
              <SectionCard title="Personal Information" description="Core identity and recruiter contact details.">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Full Name</span>
                    <input value={form.personalInfo.fullName} onChange={(event) => updatePersonalInfo("fullName", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                    <input type="email" value={form.personalInfo.email} onChange={(event) => updatePersonalInfo("email", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Country Code</span>
                    <select value={form.personalInfo.countryCode} onChange={(event) => updatePersonalInfo("countryCode", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400">
                      {COUNTRY_CODE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Mobile Number</span>
                    <input value={form.personalInfo.phoneNumber} onChange={(event) => updatePersonalInfo("phoneNumber", event.target.value.replace(/[^\d]/g, ""))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Address</span>
                    <input value={form.personalInfo.address} onChange={(event) => updatePersonalInfo("address", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                  </label>
                  <label className="block md:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Portfolio URL</span>
                    <input type="url" value={form.personalInfo.portfolio} onChange={(event) => updatePersonalInfo("portfolio", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                  </label>
                </div>

                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Coding Platforms</h4>
                    <button type="button" onClick={() => updatePersonalInfo("codingPlatforms", [...form.personalInfo.codingPlatforms, createEmptyCodingPlatform()])} className="text-sm font-semibold text-slate-700">
                      Add Platform
                    </button>
                  </div>
                  <div className="mt-3 space-y-3">
                    {form.personalInfo.codingPlatforms.map((platform, index) => (
                      <div key={`platform-${index}`} className="grid gap-3 md:grid-cols-[0.35fr_0.55fr_auto]">
                        <input placeholder="Platform name" value={platform.name} onChange={(event) => updatePersonalInfo("codingPlatforms", form.personalInfo.codingPlatforms.map((item, itemIndex) => (itemIndex === index ? { ...item, name: event.target.value } : item)))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                        <input type="url" placeholder="https://..." value={platform.link} onChange={(event) => updatePersonalInfo("codingPlatforms", form.personalInfo.codingPlatforms.map((item, itemIndex) => (itemIndex === index ? { ...item, link: event.target.value } : item)))} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                        <button type="button" onClick={() => updatePersonalInfo("codingPlatforms", form.personalInfo.codingPlatforms.filter((_, itemIndex) => itemIndex !== index).length ? form.personalInfo.codingPlatforms.filter((_, itemIndex) => itemIndex !== index) : [createEmptyCodingPlatform()])} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Template and Role" description="Keep the output targeted and ATS-safe.">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Job Role Applying For</span>
                  <input value={form.jobRole} onChange={(event) => updateTopLevel("jobRole", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
                </label>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {Object.values(resumeTemplates).map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => updateTopLevel("template", template.id)}
                      className={`rounded-3xl border px-4 py-4 text-left transition ${
                        form.template === template.id
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300"
                      }`}
                    >
                      <p className="text-sm font-semibold">{template.name}</p>
                      <p className={`mt-2 text-sm ${form.template === template.id ? "text-slate-200" : "text-slate-600"}`}>{template.description}</p>
                    </button>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Education"
                description="Include academic timelines to improve chronology."
                visible={form.sectionVisibility.education}
                onToggle={() => updateSectionVisibility("education")}
                actionLabel="Add Education"
                onAction={() => addArrayItem("education", createEmptyEducation)}
              >
                {form.education.map((item, index) => (
                  <div key={`education-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input placeholder="Degree" value={item.degree} onChange={(event) => updateArrayObjectField("education", index, "degree", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <input placeholder="College / University" value={item.college} onChange={(event) => updateArrayObjectField("education", index, "college", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <input placeholder="CGPA / Grade" value={item.cgpa} onChange={(event) => updateArrayObjectField("education", index, "cgpa", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input type="month" value={item.startDate} onChange={(event) => updateArrayObjectField("education", index, "startDate", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                        <input type="month" value={item.endDate} onChange={(event) => updateArrayObjectField("education", index, "endDate", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{formatDateRange(item.startDate, item.endDate)}</p>
                      <button type="button" onClick={() => removeArrayItem("education", index, createEmptyEducation)} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600">Remove</button>
                    </div>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Skills"
                description="Group skills by category for a cleaner ATS scan."
                visible={form.sectionVisibility.skills}
                onToggle={() => updateSectionVisibility("skills")}
                actionLabel="Add Skill Category"
                onAction={() => addArrayItem("skills", createEmptySkillCategory)}
              >
                <div className="grid gap-4 lg:grid-cols-2">
                  {form.skills.map((group, categoryIndex) => (
                    <div key={`skill-group-${categoryIndex}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <input placeholder="Category" value={group.category} onChange={(event) => updateArrayObjectField("skills", categoryIndex, "category", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                        <button type="button" onClick={() => removeArrayItem("skills", categoryIndex, createEmptySkillCategory)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                      </div>
                      <div className="mt-4 space-y-3">
                        {group.items.map((skill, skillIndex) => (
                          <div key={`skill-${categoryIndex}-${skillIndex}`} className="flex gap-3">
                            <input value={skill} onChange={(event) => updateSkillItem(categoryIndex, skillIndex, event.target.value)} placeholder="Skill name" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                            <button type="button" onClick={() => removeSkillFromCategory(categoryIndex, skillIndex)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addSkillToCategory(categoryIndex)} className="mt-4 text-sm font-semibold text-slate-700">
                        Add Skill
                      </button>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title="Projects"
                description="Keep outcomes and tech stack concise."
                visible={form.sectionVisibility.projects}
                onToggle={() => updateSectionVisibility("projects")}
                actionLabel="Add Project"
                onAction={() => addArrayItem("projects", createEmptyProject)}
              >
                {form.projects.map((item, index) => (
                  <div key={`project-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <input placeholder="Project Title" value={item.title} onChange={(event) => updateArrayObjectField("projects", index, "title", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                    <textarea rows={3} placeholder="Project Description" value={item.description} onChange={(event) => updateArrayObjectField("projects", index, "description", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                    <div className="flex gap-3">
                      <input placeholder="Tech Stack (comma separated)" value={item.techStack} onChange={(event) => updateArrayObjectField("projects", index, "techStack", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <button type="button" onClick={() => removeArrayItem("projects", index, createEmptyProject)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                    </div>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Experience"
                description="Use dates to generate a clean timeline and automatic duration."
                visible={form.sectionVisibility.experience}
                onToggle={() => updateSectionVisibility("experience")}
                actionLabel="Add Experience"
                onAction={() => addArrayItem("experience", createEmptyExperience)}
              >
                {form.experience.map((item, index) => (
                  <div key={`experience-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="grid gap-3 md:grid-cols-2">
                      <input placeholder="Role" value={item.role} onChange={(event) => updateArrayObjectField("experience", index, "role", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <input placeholder="Company" value={item.company} onChange={(event) => updateArrayObjectField("experience", index, "company", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <input type="month" value={item.startDate} onChange={(event) => updateArrayObjectField("experience", index, "startDate", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <input type="month" value={item.endDate} onChange={(event) => updateArrayObjectField("experience", index, "endDate", event.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                    </div>
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-600">
                      Duration: {formatDateRange(item.startDate, item.endDate) || "Set start and end dates"}
                    </div>
                    <textarea rows={3} placeholder="Description" value={item.description} onChange={(event) => updateArrayObjectField("experience", index, "description", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                    <button type="button" onClick={() => removeArrayItem("experience", index, createEmptyExperience)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Certifications"
                description="Optional but useful for ATS keyword matching."
                visible={form.sectionVisibility.certifications}
                onToggle={() => updateSectionVisibility("certifications")}
                actionLabel="Add Certification"
                onAction={() => addArrayItem("certifications", () => "")}
              >
                {form.certifications.map((item, index) => (
                  <div key={`certification-${index}`} className="flex gap-3">
                    <input value={item} onChange={(event) => updateStringArrayField("certifications", index, event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                    <button type="button" onClick={() => removeArrayItem("certifications", index, () => "")} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Other Achievements"
                description="Show awards, impact, publications, or notable recognition."
                visible={form.sectionVisibility.achievements}
                onToggle={() => updateSectionVisibility("achievements")}
                actionLabel="Add Achievement"
                onAction={() => addArrayItem("achievements", () => "")}
              >
                {form.achievements.map((item, index) => (
                  <div key={`achievement-${index}`} className="flex gap-3">
                    <input value={item} onChange={(event) => updateStringArrayField("achievements", index, event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                    <button type="button" onClick={() => removeArrayItem("achievements", index, () => "")} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Custom Sections"
                description="Add dynamic ATS-safe sections like Open Source, Publications, Leadership, or Volunteering."
                visible={form.sectionVisibility.customSections}
                onToggle={() => updateSectionVisibility("customSections")}
                actionLabel="+ Add Custom Section"
                onAction={() => addArrayItem("customSections", createEmptyCustomSection)}
              >
                {form.customSections.map((section, sectionIndex) => (
                  <div key={`custom-section-${sectionIndex}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center gap-3">
                      <input placeholder="Section title" value={section.title} onChange={(event) => updateArrayObjectField("customSections", sectionIndex, "title", event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                      <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                        <input type="checkbox" checked={section.isVisible !== false} onChange={() => updateArrayObjectField("customSections", sectionIndex, "isVisible", section.isVisible === false)} className="h-4 w-4 rounded border-slate-300" />
                        Visible
                      </label>
                      <button type="button" onClick={() => removeArrayItem("customSections", sectionIndex, createEmptyCustomSection)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                    </div>
                    <div className="mt-4 space-y-3">
                      {section.items.map((item, itemIndex) => (
                        <div key={`custom-item-${sectionIndex}-${itemIndex}`} className="flex gap-3">
                          <input value={item} onChange={(event) => updateCustomSectionItem(sectionIndex, itemIndex, event.target.value)} placeholder="Section item" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                          <button type="button" onClick={() => removeItemFromCustomSection(sectionIndex, itemIndex)} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => addItemToCustomSection(sectionIndex)} className="mt-4 text-sm font-semibold text-slate-700">
                      Add Item
                    </button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard
                title="Hobbies / Interests"
                description="Optional section for fresher profiles."
                visible={form.sectionVisibility.hobbies}
                onToggle={() => updateSectionVisibility("hobbies")}
                actionLabel="Add Hobby"
                onAction={() => addArrayItem("hobbies", () => "")}
              >
                {form.hobbies.map((item, index) => (
                  <div key={`hobby-${index}`} className="flex gap-3">
                    <input value={item} onChange={(event) => updateStringArrayField("hobbies", index, event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none" />
                    <button type="button" onClick={() => removeArrayItem("hobbies", index, () => "")} className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-600">Remove</button>
                  </div>
                ))}
              </SectionCard>

              {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
              {status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}

              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={handleGenerate} disabled={loading} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  {loading ? "Generating..." : "Generate Resume"}
                </button>
                <button type="button" onClick={handleDownloadPdf} disabled={!pdfUrl} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                  Download PDF
                </button>
                <button type="button" onClick={handleDownloadLatex} disabled={!latexText} className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                  Download LaTeX
                </button>
              </div>
            </div>
          </section>

          <ResumePreviewPage resume={generatedResume || livePreviewResume} templateId={form.template} />
        </div>
      </div>
    </div>
  );
}

export default AtsResumeGenerator;
