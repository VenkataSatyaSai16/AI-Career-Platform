export const COUNTRY_CODE_OPTIONS = [
  "+1",
  "+44",
  "+61",
  "+81",
  "+91",
  "+971"
];

export function createSectionVisibility(overrides = {}) {
  return {
    summary: true,
    education: true,
    skills: true,
    projects: true,
    experience: true,
    certifications: true,
    achievements: true,
    customSections: true,
    hobbies: true,
    ...overrides
  };
}

export function createEmptyEducation() {
  return {
    degree: "",
    college: "",
    cgpa: "",
    startDate: "",
    endDate: ""
  };
}

export function createEmptyProject() {
  return {
    title: "",
    description: "",
    techStack: ""
  };
}

export function createEmptyExperience() {
  return {
    role: "",
    company: "",
    startDate: "",
    endDate: "",
    duration: "",
    description: ""
  };
}

export function createEmptyCodingPlatform() {
  return {
    name: "",
    link: ""
  };
}

export function createEmptySkillCategory() {
  return {
    category: "",
    items: [""]
  };
}

export function createEmptyCustomSection() {
  return {
    title: "",
    items: [""],
    isVisible: true
  };
}

export function createInitialResumeForm() {
  return {
    personalInfo: {
      fullName: "",
      email: "",
      countryCode: "+91",
      phoneNumber: "",
      address: "",
      portfolio: "",
      links: "",
      codingPlatforms: [createEmptyCodingPlatform()]
    },
    education: [createEmptyEducation()],
    skills: [createEmptySkillCategory()],
    projects: [createEmptyProject()],
    experience: [createEmptyExperience()],
    certifications: [""],
    hobbies: [""],
    achievements: [""],
    customSections: [createEmptyCustomSection()],
    sectionVisibility: createSectionVisibility(),
    jobRole: "",
    template: "minimal"
  };
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeText(item)).filter(Boolean);
  }

  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSkillGroups(value) {
  if (Array.isArray(value) && value.some((item) => item && typeof item === "object" && "category" in item)) {
    return value.map((group) => ({
      category: normalizeText(group.category),
      items: Array.isArray(group.items) ? group.items.map((item) => normalizeText(item)).filter(Boolean) : []
    }));
  }

  const fallbackItems = normalizeStringArray(value);
  return fallbackItems.length ? [{ category: "Skills", items: fallbackItems }] : [createEmptySkillCategory()];
}

function normalizeCodingPlatforms(value) {
  if (!Array.isArray(value) || !value.length) {
    return [createEmptyCodingPlatform()];
  }

  return value.map((item) => ({
    name: normalizeText(item?.name),
    link: normalizeText(item?.link)
  }));
}

function normalizeCustomSections(value) {
  if (!Array.isArray(value) || !value.length) {
    return [createEmptyCustomSection()];
  }

  return value.map((section) => ({
    title: normalizeText(section?.title),
    items: normalizeStringArray(section?.items),
    isVisible: section?.isVisible !== false
  }));
}

export function normalizeResumeData(raw = {}) {
  const initial = createInitialResumeForm();
  const personalInfo = raw.personalInfo || {};
  const phone = normalizeText(personalInfo.phone);
  const countryCode = normalizeText(personalInfo.countryCode) || (phone.startsWith("+") ? phone.split(/\s+/)[0] : initial.personalInfo.countryCode);
  const phoneNumber = normalizeText(personalInfo.phoneNumber) || (phone.startsWith("+") ? phone.replace(countryCode, "").trim() : phone);

  return {
    ...initial,
    ...raw,
    personalInfo: {
      ...initial.personalInfo,
      ...personalInfo,
      fullName: normalizeText(personalInfo.fullName || personalInfo.name),
      email: normalizeText(personalInfo.email),
      countryCode,
      phoneNumber,
      address: normalizeText(personalInfo.address),
      portfolio: normalizeText(personalInfo.portfolio),
      links: normalizeText(personalInfo.links || personalInfo.linkedIn || personalInfo.github),
      codingPlatforms: normalizeCodingPlatforms(
        personalInfo.codingPlatforms ||
          normalizeStringArray(personalInfo.links).map((link, index) => ({
            name: index === 0 ? "LinkedIn / GitHub" : "Link",
            link
          }))
      )
    },
    education:
      Array.isArray(raw.education) && raw.education.length
        ? raw.education.map((item) => ({
            ...createEmptyEducation(),
            ...item,
            degree: normalizeText(item?.degree),
            college: normalizeText(item?.college || item?.school),
            cgpa: normalizeText(item?.cgpa),
            startDate: normalizeText(item?.startDate),
            endDate: normalizeText(item?.endDate || item?.year)
          }))
        : [createEmptyEducation()],
    skills: normalizeSkillGroups(raw.skills),
    projects:
      Array.isArray(raw.projects) && raw.projects.length
        ? raw.projects.map((item) => ({
            ...createEmptyProject(),
            ...item,
            title: normalizeText(item?.title),
            description: normalizeText(item?.description),
            techStack: Array.isArray(item?.techStack) ? item.techStack.join(", ") : normalizeText(item?.techStack)
          }))
        : [createEmptyProject()],
    experience:
      Array.isArray(raw.experience) && raw.experience.length
        ? raw.experience.map((item) => ({
            ...createEmptyExperience(),
            ...item,
            role: normalizeText(item?.role),
            company: normalizeText(item?.company),
            startDate: normalizeText(item?.startDate),
            endDate: normalizeText(item?.endDate),
            duration: normalizeText(item?.duration),
            description: normalizeText(item?.description)
          }))
        : [createEmptyExperience()],
    certifications: normalizeStringArray(raw.certifications).length ? normalizeStringArray(raw.certifications) : [""],
    hobbies: normalizeStringArray(raw.hobbies).length ? normalizeStringArray(raw.hobbies) : [""],
    achievements:
      normalizeStringArray(raw.achievements || raw.otherAchievements).length
        ? normalizeStringArray(raw.achievements || raw.otherAchievements)
        : [""],
    customSections: normalizeCustomSections(raw.customSections),
    sectionVisibility: createSectionVisibility(raw.sectionVisibility),
    jobRole: normalizeText(raw.jobRole),
    template: normalizeText(raw.template) || "minimal",
    summary: normalizeText(raw.summary)
  };
}

export function buildResumePayload(form) {
  const normalized = normalizeResumeData(form);

  return {
    personalInfo: {
      ...normalized.personalInfo,
      codingPlatforms: normalized.personalInfo.codingPlatforms
        .map((item) => ({
          name: normalizeText(item.name),
          link: normalizeText(item.link)
        }))
        .filter((item) => item.name || item.link)
    },
    education: normalized.education.filter((item) => item.degree || item.college || item.endDate || item.startDate),
    skills: normalized.skills
      .map((group) => ({
        category: normalizeText(group.category),
        items: normalizeStringArray(group.items)
      }))
      .filter((group) => group.category || group.items.length),
    projects: normalized.projects
      .map((item) => ({
        ...item,
        techStack: normalizeStringArray(item.techStack)
      }))
      .filter((item) => item.title || item.description || item.techStack.length),
    experience: normalized.experience
      .map((item) => ({
        ...item,
        duration: item.duration || formatDateRange(item.startDate, item.endDate)
      }))
      .filter((item) => item.role || item.company || item.description || item.startDate || item.endDate),
    certifications: normalizeStringArray(normalized.certifications),
    hobbies: normalizeStringArray(normalized.hobbies),
    achievements: normalizeStringArray(normalized.achievements),
    customSections: normalized.customSections
      .map((section) => ({
        title: normalizeText(section.title),
        items: normalizeStringArray(section.items),
        isVisible: section.isVisible !== false
      }))
      .filter((section) => section.title || section.items.length),
    sectionVisibility: normalized.sectionVisibility,
    jobRole: normalized.jobRole,
    template: normalized.template
  };
}

export function formatPhone(personalInfo = {}) {
  const countryCode = normalizeText(personalInfo.countryCode);
  const phoneNumber = normalizeText(personalInfo.phoneNumber);
  return [countryCode, phoneNumber].filter(Boolean).join(" ").trim();
}

export function formatDateRange(startDate, endDate) {
  const start = normalizeText(startDate);
  const end = normalizeText(endDate);

  if (!start && !end) {
    return "";
  }

  const formatLabel = (value) => {
    if (!value) {
      return "Present";
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric"
    });
  };

  return `${formatLabel(start)} - ${formatLabel(end)}`;
}

export function validateResumeForm(form) {
  const payload = buildResumePayload(form);
  const errors = [];

  if (!payload.personalInfo.fullName) {
    errors.push("Full name is required.");
  }

  if (!payload.personalInfo.email) {
    errors.push("Email is required.");
  }

  if (payload.personalInfo.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.personalInfo.email)) {
    errors.push("Email must be valid.");
  }

  if (!payload.personalInfo.phoneNumber) {
    errors.push("Phone number is required.");
  }

  if (payload.personalInfo.phoneNumber && !/^\d{6,15}$/.test(payload.personalInfo.phoneNumber.replace(/\s+/g, ""))) {
    errors.push("Phone number must contain 6 to 15 digits.");
  }

  const urlFields = [
    payload.personalInfo.portfolio,
    ...payload.personalInfo.codingPlatforms.map((item) => item.link)
  ].filter(Boolean);

  urlFields.forEach((url) => {
    try {
      new URL(url);
    } catch (_error) {
      errors.push(`Invalid URL: ${url}`);
    }
  });

  if (!payload.education.some((item) => item.degree || item.college)) {
    errors.push("At least one education entry is recommended for ATS compliance.");
  }

  if (!payload.skills.some((group) => group.items.length)) {
    errors.push("Add at least one skill.");
  }

  return {
    errors,
    payload
  };
}
