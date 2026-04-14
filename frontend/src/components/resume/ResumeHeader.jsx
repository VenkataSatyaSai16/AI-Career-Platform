import React from "react";
import { formatPhone } from "../../utils/resumeForm";

function renderLink(label, url) {
  if (!url) {
    return null;
  }

  return (
    <a key={`${label}-${url}`} href={url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
      {label}
    </a>
  );
}

function ResumeHeader({ personalInfo, jobRole, className }) {
  const formattedPhone = formatPhone(personalInfo);
  const codingPlatforms = Array.isArray(personalInfo?.codingPlatforms) ? personalInfo.codingPlatforms : [];
  const links = [
    personalInfo?.portfolio ? { label: "Portfolio", url: personalInfo.portfolio } : null,
    ...codingPlatforms.map((platform) => ({
      label: platform.name || "Profile",
      url: platform.link
    }))
  ].filter(Boolean);

  return (
    <header className={className}>
      <h1 className="text-3xl font-bold tracking-tight">{personalInfo.fullName || "Candidate Name"}</h1>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {personalInfo.email ? <span>{personalInfo.email}</span> : null}
        {formattedPhone ? <span>{formattedPhone}</span> : null}
        {personalInfo.address ? <span>{personalInfo.address}</span> : null}
        {links.map((item) => renderLink(item.label, item.url))}
      </div>
      {jobRole ? <p className="mt-3 text-sm font-medium">{jobRole}</p> : null}
    </header>
  );
}

export default ResumeHeader;
