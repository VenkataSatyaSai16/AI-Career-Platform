import React from "react";
import ResumeHeader from "./ResumeHeader";
import ResumeSection from "./ResumeSection";
import { getResumeTemplate } from "../../utils/resumeTemplates";
import { formatDateRange, normalizeResumeData } from "../../utils/resumeForm";

function renderBullets(items = []) {
  if (!Array.isArray(items) || !items.length) {
    return null;
  }

  return (
    <ul className="space-y-2 pl-5 text-sm leading-6">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="list-disc">
          {item}
        </li>
      ))}
    </ul>
  );
}

function renderEntries(entries = [], renderMeta) {
  if (!Array.isArray(entries) || !entries.length) {
    return null;
  }

  return (
    <div className="space-y-4">
      {entries.map((entry, index) => (
        <article key={`${entry.title || entry.degree || entry.role || "entry"}-${index}`}>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {entry.title || entry.role || entry.degree || entry.name || "Entry"}
              </h3>
              {entry.subtitle || entry.company || entry.school || entry.college ? (
                <p className="text-sm text-slate-600">{entry.subtitle || entry.company || entry.school || entry.college}</p>
              ) : null}
            </div>
            {renderMeta ? <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">{renderMeta(entry)}</p> : null}
          </div>
          {entry.description ? <p className="mt-2 text-sm leading-6 text-slate-700">{entry.description}</p> : null}
          {renderBullets(entry.bullets)}
          {entry.techStack?.length ? (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">Tech:</span> {entry.techStack.join(", ")}
            </p>
          ) : null}
          {entry.cgpa ? (
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-slate-900">CGPA:</span> {entry.cgpa}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function renderSkillGroups(groups = []) {
  if (!Array.isArray(groups) || !groups.some((group) => group?.items?.length)) {
    return null;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map((group, index) => (
        <article key={`${group.category || "skills"}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">{group.category || "Skills"}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{(group.items || []).join(", ")}</p>
        </article>
      ))}
    </div>
  );
}

function renderTimeline(entries = []) {
  if (!Array.isArray(entries) || !entries.length) {
    return null;
  }

  return (
    <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-slate-200">
      {entries.map((entry, index) => (
        <article key={`${entry.role || "experience"}-${index}`} className="relative pl-10">
          <span className="absolute left-0 top-1.5 h-6 w-6 rounded-full border-4 border-white bg-slate-900 shadow" />
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">{entry.role || "Role"}</h3>
              {entry.company ? <p className="text-sm text-slate-600">{entry.company}</p> : null}
            </div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              {entry.duration || formatDateRange(entry.startDate, entry.endDate)}
            </p>
          </div>
          {entry.description ? <p className="mt-2 text-sm leading-6 text-slate-700">{entry.description}</p> : null}
          {renderBullets(entry.bullets)}
        </article>
      ))}
    </div>
  );
}

function ResumePreview({ resume, templateId }) {
  const template = getResumeTemplate(templateId);

  if (!resume) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-16 text-center text-sm text-slate-500">
        Fill the form and generate your resume to see the preview.
      </div>
    );
  }

  const normalized = normalizeResumeData(resume);

  const dynamicSections = (normalized.customSections || [])
    .filter((section) => section.isVisible !== false && (section.title || section.items?.length))
    .map((section, index) => ({
      key: `custom-${index}`,
      title: section.title || "Custom Section",
      content: renderBullets(section.items)
    }));

  const sections = {
    summary: normalized.summary ? <p className="text-sm leading-7 text-slate-700">{normalized.summary}</p> : null,
    skills: renderSkillGroups(normalized.skills),
    experience: renderTimeline(normalized.experience),
    projects: renderEntries(normalized.projects),
    education: renderEntries(normalized.education, (entry) => formatDateRange(entry.startDate, entry.endDate)),
    certifications: renderBullets(normalized.certifications),
    achievements: renderBullets(normalized.achievements),
    customSections: dynamicSections.map((section) => (
      <ResumeSection
        key={section.key}
        title={section.title}
        titleClassName={template.sectionTitleClassName}
        className={template.sectionClassName}
      >
        {section.content}
      </ResumeSection>
    )),
    hobbies: renderBullets(normalized.hobbies)
  };

  const labels = {
    summary: "Professional Summary",
    skills: "Skills",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    certifications: "Certifications",
    achievements: "Other Achievements",
    customSections: "Additional Sections",
    hobbies: "Hobbies / Interests"
  };

  return (
    <div id="resume-preview" className={`rounded-[2rem] p-8 shadow-[0_24px_70px_rgba(15,23,42,0.10)] ${template.containerClassName}`}>
      <ResumeHeader personalInfo={normalized.personalInfo} jobRole={normalized.jobRole} className={template.headerClassName} />

      <div className="mt-6 space-y-5">
        {template.sectionOrder.map((key) =>
          key === "customSections" ? (
            normalized.sectionVisibility?.customSections !== false ? sections.customSections : null
          ) : normalized.sectionVisibility?.[key] !== false ? (
            <ResumeSection
              key={key}
              title={labels[key]}
              titleClassName={template.sectionTitleClassName}
              className={template.sectionClassName}
            >
              {sections[key]}
            </ResumeSection>
          ) : null
        )}
      </div>
    </div>
  );
}

export default ResumePreview;
