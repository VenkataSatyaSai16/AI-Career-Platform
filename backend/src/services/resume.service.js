const pdfParse = require("pdf-parse");
const { extractPdfText } = require("./llm.service");

const RESUME_BUILDER_STEPS = [
  { key: "name", question: "What is your full name?" },
  { key: "education", question: "Tell me about your education. Include degree, college, graduation year, and notable academic highlights." },
  { key: "skills", question: "What are your main technical and professional skills? List tools, languages, frameworks, and core strengths." },
  { key: "projects", question: "Describe your best projects. Include what you built, technologies used, and the impact or outcome." },
  { key: "experience", question: "Tell me about your work experience, internships, freelance work, or major responsibilities." }
];

async function parseUploadedResume({ file, resumeText } = {}) {
  let cleanedText = "";
  let fileName = "";
  let source = "text";

  if (file) {
    const result = await pdfParse(file.buffer);
    cleanedText = cleanResumeText(result.text);
    fileName = file.originalname;
    source = "file";

    if (!cleanedText || cleanedText.length < 80) {
      console.log("Resume PDF had little embedded text, using Gemini OCR fallback:", file.originalname);
      const extractedText = await extractPdfText(file.buffer);
      cleanedText = cleanResumeText(extractedText);
    }
  } else {
    cleanedText = cleanResumeText(resumeText);
  }

  if (!cleanedText) {
    const error = new Error("We could not read text from that PDF. Please upload a clearer PDF or paste the resume text.");
    error.statusCode = 400;
    throw error;
  }

  return {
    fileName,
    source,
    resumeText: cleanedText
  };
}

function getResumeBuilderQuestion(step = 0) {
  const normalizedStep = Math.max(0, Number(step) || 0);
  const currentStep = RESUME_BUILDER_STEPS[normalizedStep] || null;

  return {
    step: normalizedStep,
    totalSteps: RESUME_BUILDER_STEPS.length,
    field: currentStep?.key || null,
    question: currentStep?.question || "",
    isComplete: !currentStep
  };
}

function normalizeResumeBuilderData(data = {}) {
  return {
    name: normalizeBuilderField(data.name),
    education: normalizeBuilderField(data.education),
    skills: normalizeBuilderField(data.skills),
    projects: normalizeBuilderField(data.projects),
    experience: normalizeBuilderField(data.experience)
  };
}

function normalizeResumeRequest(payload = {}) {
  if (payload?.data) {
    const legacyData = normalizeResumeBuilderData(payload.data);

    return {
      personalInfo: {
        fullName: legacyData.name,
        email: "",
        countryCode: "",
        phoneNumber: "",
        address: "",
        portfolio: "",
        codingPlatforms: []
      },
      education: [{ degree: legacyData.education, college: "", cgpa: "", startDate: "", endDate: "" }],
      skills: [{ category: "Skills", items: normalizeStringArray(legacyData.skills) }],
      projects: [{ title: "Project Highlights", description: legacyData.projects, techStack: "" }],
      experience: [{ role: "Experience", company: "", startDate: "", endDate: "", duration: "", description: legacyData.experience }],
      certifications: [],
      achievements: [],
      customSections: [],
      hobbies: [],
      sectionVisibility: defaultSectionVisibility(),
      jobRole: "",
      template: "conversation",
      userId: ""
    };
  }

  const personalInfo = payload.personalInfo || {};
  const codingPlatforms = normalizeObjectArray(personalInfo.codingPlatforms, {
    name: "",
    link: ""
  })
    .map((item) => ({
      name: normalizeBuilderField(item.name),
      link: normalizeBuilderField(item.link)
    }))
    .filter((item) => item.name || item.link);
  const legacySkills = normalizeStringArray(payload.skills);
  const normalizedSkills =
    Array.isArray(payload.skills) && payload.skills.some((item) => item && typeof item === "object" && "category" in item)
      ? payload.skills
          .map((item) => ({
            category: normalizeBuilderField(item.category),
            items: normalizeStringArray(item.items)
          }))
          .filter((item) => item.category || item.items.length)
      : legacySkills.length
        ? [{ category: "Skills", items: legacySkills }]
        : [];

  return {
    personalInfo: {
      fullName: normalizeBuilderField(personalInfo.fullName || personalInfo.name),
      email: normalizeBuilderField(personalInfo.email),
      countryCode: normalizeBuilderField(personalInfo.countryCode),
      phoneNumber: normalizeBuilderField(personalInfo.phoneNumber || personalInfo.phone),
      address: normalizeBuilderField(personalInfo.address),
      portfolio: normalizeBuilderField(personalInfo.portfolio),
      codingPlatforms
    },
    education: normalizeObjectArray(payload.education, {
      degree: "",
      college: "",
      cgpa: "",
      startDate: "",
      endDate: ""
    }).map((item) => ({
      degree: normalizeBuilderField(item.degree),
      college: normalizeBuilderField(item.college || item.school),
      cgpa: normalizeBuilderField(item.cgpa),
      startDate: normalizeBuilderField(item.startDate),
      endDate: normalizeBuilderField(item.endDate || item.year)
    })),
    skills: normalizedSkills,
    projects: normalizeObjectArray(payload.projects, {
      title: "",
      description: "",
      techStack: ""
    }).map((item) => ({
      title: normalizeBuilderField(item.title),
      description: normalizeBuilderField(item.description),
      techStack: normalizeStringArray(item.techStack)
    })),
    experience: normalizeObjectArray(payload.experience, {
      role: "",
      company: "",
      startDate: "",
      endDate: "",
      duration: "",
      description: ""
    }).map((item) => ({
      role: normalizeBuilderField(item.role),
      company: normalizeBuilderField(item.company),
      startDate: normalizeBuilderField(item.startDate),
      endDate: normalizeBuilderField(item.endDate),
      duration: normalizeBuilderField(item.duration || formatDateRange(item.startDate, item.endDate)),
      description: normalizeBuilderField(item.description)
    })),
    certifications: normalizeStringArray(payload.certifications),
    achievements: normalizeStringArray(payload.achievements || payload.otherAchievements),
    customSections: normalizeObjectArray(payload.customSections, {
      title: "",
      items: [],
      isVisible: true
    })
      .map((item) => ({
        title: normalizeBuilderField(item.title),
        items: normalizeStringArray(item.items),
        isVisible: item.isVisible !== false
      }))
      .filter((item) => item.title || item.items.length),
    hobbies: normalizeStringArray(payload.hobbies),
    sectionVisibility: {
      ...defaultSectionVisibility(),
      ...(payload.sectionVisibility || {})
    },
    jobRole: normalizeBuilderField(payload.jobRole),
    template: normalizeBuilderField(payload.template) || "minimal",
    userId: normalizeBuilderField(payload.userId)
  };
}

function buildResumeGenerationPrompt(payload = {}) {
  const normalized = normalizeResumeRequest(payload);

  return [
    "Generate a professional ATS-friendly resume based on the following details.",
    `Optimize it for the job role: ${normalized.jobRole || "General Software Role"}.`,
    "Use clear headings, bullet points, action verbs, and keep it concise and structured.",
    "Return valid JSON only with this shape:",
    JSON.stringify(
      {
        summary: "string",
        skills: [
          {
            category: "string",
            items: ["string"]
          }
        ],
        experience: [
          {
            role: "string",
            company: "string",
            startDate: "string",
            endDate: "string",
            duration: "string",
            description: "string",
            bullets: ["string"]
          }
        ],
        projects: [
          {
            title: "string",
            description: "string",
            techStack: ["string"],
            bullets: ["string"]
          }
        ],
        education: [
          {
            degree: "string",
            school: "string",
            cgpa: "string",
            startDate: "string",
            endDate: "string"
          }
        ],
        certifications: ["string"],
        achievements: ["string"],
        customSections: [
          {
            title: "string",
            items: ["string"]
          }
        ],
        hobbies: ["string"]
      },
      null,
      2
    ),
    "Do not use markdown. Do not use tables. Do not include images. Keep headings ATS parsable.",
    "",
    "Candidate details:",
    JSON.stringify(normalized, null, 2)
  ].join("\n");
}

function buildStructuredResume(payload = {}, generatedContent = {}) {
  const normalized = normalizeResumeRequest(payload);
  const generated = generatedContent || {};

  return {
    personalInfo: {
      ...normalized.personalInfo,
      phone: formatPhone(normalized.personalInfo)
    },
    jobRole: normalized.jobRole,
    summary: cleanResumeText(generated.summary || buildFallbackSummary(normalized)),
    skills: buildSkillGroups(normalized.skills, generated.skills),
    experience: buildExperienceEntries(normalized.experience, generated.experience),
    projects: buildProjectEntries(normalized.projects, generated.projects),
    education: buildEducationEntries(normalized.education, generated.education),
    certifications: uniqueStrings(generated.certifications?.length ? generated.certifications : normalized.certifications),
    achievements: uniqueStrings(generated.achievements?.length ? generated.achievements : normalized.achievements),
    customSections: buildCustomSections(normalized.customSections, generated.customSections),
    hobbies: uniqueStrings(generated.hobbies?.length ? generated.hobbies : normalized.hobbies),
    sectionVisibility: normalized.sectionVisibility,
    template: normalized.template
  };
}

function buildResumeText(resume = {}) {
  const sections = [];

  sections.push(resume.personalInfo?.fullName || "Candidate Name");
  const contact = [
    resume.personalInfo?.email,
    formatPhone(resume.personalInfo),
    resume.personalInfo?.address
  ]
    .filter(Boolean)
    .join(" | ");
  if (contact) {
    sections.push(contact);
  }
  const linkLabels = [
    resume.personalInfo?.portfolio ? "Portfolio" : "",
    ...(resume.personalInfo?.codingPlatforms || []).map((item) => item.name || "Profile")
  ].filter(Boolean);
  if (linkLabels.length) {
    sections.push(linkLabels.join(" | "));
  }
  if (resume.jobRole) {
    sections.push(resume.jobRole);
  }

  pushSection(sections, "PROFESSIONAL SUMMARY", resume.summary ? [resume.summary] : []);
  pushSection(
    sections,
    "SKILLS",
    (resume.skills || []).map((group) => `${group.category || "Skills"}: ${(group.items || []).join(", ")}`)
  );

  if (Array.isArray(resume.experience) && resume.experience.length) {
    sections.push("", "EXPERIENCE");
    resume.experience.forEach((item) => {
      sections.push(`${item.role || "Role"}${item.company ? ` | ${item.company}` : ""}${(item.duration || formatDateRange(item.startDate, item.endDate)) ? ` | ${item.duration || formatDateRange(item.startDate, item.endDate)}` : ""}`);
      if (item.description) {
        sections.push(item.description);
      }
      (item.bullets || []).forEach((bullet) => sections.push(`- ${bullet}`));
      sections.push("");
    });
  }

  if (Array.isArray(resume.projects) && resume.projects.length) {
    sections.push("", "PROJECTS");
    resume.projects.forEach((item) => {
      sections.push(item.title || "Project");
      if (item.description) {
        sections.push(item.description);
      }
      if (item.techStack?.length) {
        sections.push(`Tech Stack: ${item.techStack.join(", ")}`);
      }
      (item.bullets || []).forEach((bullet) => sections.push(`- ${bullet}`));
      sections.push("");
    });
  }

  if (Array.isArray(resume.education) && resume.education.length) {
    sections.push("", "EDUCATION");
    resume.education.forEach((item) => {
      sections.push(
        [item.degree, item.school, formatDateRange(item.startDate, item.endDate), item.cgpa ? `CGPA: ${item.cgpa}` : ""].filter(Boolean).join(" | ")
      );
    });
  }

  pushSection(sections, "CERTIFICATIONS", resume.certifications || [], true);
  pushSection(sections, "OTHER ACHIEVEMENTS", resume.achievements || [], true);
  if (Array.isArray(resume.customSections) && resume.customSections.length) {
    resume.customSections
      .filter((section) => section.isVisible !== false)
      .forEach((section) => pushSection(sections, section.title || "CUSTOM SECTION", section.items || [], true));
  }
  pushSection(sections, "HOBBIES / INTERESTS", resume.hobbies || [], true);

  return cleanResumeText(sections.join("\n"));
}

function buildResumeLatex(resume = {}) {
  const sections = [];
  const linkParts = [];

  if (resume.personalInfo?.portfolio) {
    linkParts.push(`\\href{${escapeLatexUrl(resume.personalInfo.portfolio)}}{Portfolio}`);
  }

  (resume.personalInfo?.codingPlatforms || []).forEach((item) => {
    if (item?.link) {
      linkParts.push(`\\href{${escapeLatexUrl(item.link)}}{${escapeLatexText(item.name || "Profile")}}`);
    }
  });

  const contactLine = [
    escapeLatexText(resume.personalInfo?.email),
    escapeLatexText(formatPhone(resume.personalInfo)),
    escapeLatexText(resume.personalInfo?.address)
  ]
    .filter(Boolean)
    .join(" \\textbar\\ ");

  sections.push("\\documentclass[11pt]{article}");
  sections.push("\\usepackage[margin=0.7in]{geometry}");
  sections.push("\\usepackage[hidelinks]{hyperref}");
  sections.push("\\usepackage{enumitem}");
  sections.push("\\setlist[itemize]{noitemsep, topsep=2pt, leftmargin=1.4em}");
  sections.push("\\begin{document}");
  sections.push(`{\\LARGE \\textbf{${escapeLatexText(resume.personalInfo?.fullName || "Candidate Name")}}}\\\\`);
  if (contactLine) {
    sections.push(`${contactLine}\\\\`);
  }
  if (linkParts.length) {
    sections.push(`${linkParts.join(" \\textbar\\ ")}\\\\`);
  }
  if (resume.jobRole) {
    sections.push(`\\textit{${escapeLatexText(resume.jobRole)}}\\\\`);
  }

  pushLatexSection(sections, "Professional Summary", resume.summary ? [escapeLatexText(resume.summary)] : []);
  pushLatexSection(
    sections,
    "Skills",
    (resume.skills || []).map((group) => `${escapeLatexText(group.category || "Skills")}: ${escapeLatexText((group.items || []).join(", "))}`)
  );
  pushLatexEntrySection(sections, "Experience", resume.experience, (item) => `${escapeLatexText(item.role || "Role")} \\hfill ${escapeLatexText(item.duration || formatDateRange(item.startDate, item.endDate))}`, (item) => escapeLatexText(item.company), "description");
  pushLatexEntrySection(sections, "Projects", resume.projects, (item) => escapeLatexText(item.title || "Project"), (item) => item.techStack?.length ? `Tech Stack: ${escapeLatexText(item.techStack.join(", "))}` : "", "description");
  pushLatexEntrySection(sections, "Education", resume.education, (item) => escapeLatexText(item.degree || "Education"), (item) => `${escapeLatexText(item.school)}${item.cgpa ? ` \\hfill CGPA: ${escapeLatexText(item.cgpa)}` : ""}${formatDateRange(item.startDate, item.endDate) ? `\\\\${escapeLatexText(formatDateRange(item.startDate, item.endDate))}` : ""}`, "");
  pushLatexSection(sections, "Certifications", (resume.certifications || []).map(escapeLatexText), true);
  pushLatexSection(sections, "Other Achievements", (resume.achievements || []).map(escapeLatexText), true);
  (resume.customSections || [])
    .filter((section) => section.isVisible !== false)
    .forEach((section) => pushLatexSection(sections, section.title || "Custom Section", (section.items || []).map(escapeLatexText), true));
  pushLatexSection(sections, "Hobbies / Interests", (resume.hobbies || []).map(escapeLatexText), true);
  sections.push("\\end{document}");

  return sections.join("\n");
}

function buildResumePdfBuffer(resume = {}) {
  const text = buildResumeText(resume);
  const rawLines = text.split("\n");
  const pageLines = [];

  while (rawLines.length) {
    pageLines.push(rawLines.splice(0, 44));
  }

  const objects = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>";

  const pageObjectNumbers = [];
  let objectNumber = 4;

  pageLines.forEach((lines) => {
    const pageObjectNumber = objectNumber;
    const contentObjectNumber = objectNumber + 1;
    pageObjectNumbers.push(pageObjectNumber);

    const escapedLines = lines.map((line) => `(${escapePdfText(line)}) Tj`).join("\nT*\n");
    const contentStream = `BT\n/F1 11 Tf\n50 770 Td\n14 TL\n${escapedLines}\nET`;

    objects[pageObjectNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`;
    objects[contentObjectNumber] =
      `<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream`;

    objectNumber += 2;
  });

  objects[2] = `<< /Type /Pages /Count ${pageObjectNumbers.length} /Kids [${pageObjectNumbers.map((pageNumber) => `${pageNumber} 0 R`).join(" ")}] >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  for (let index = 1; index < objects.length; index += 1) {
    if (!objects[index]) {
      continue;
    }

    offsets[index] = Buffer.byteLength(pdf, "utf8");
    pdf += `${index} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < objects.length; index += 1) {
    const offset = offsets[index] || 0;
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}

function buildFallbackResume(data = {}) {
  return buildResumeText(buildStructuredResume(data, {}));
}

function parseGeneratedResumeJson(text) {
  const cleaned = cleanResumeText(text);

  if (!cleaned) {
    return null;
  }

  try {
    return JSON.parse(cleaned);
  } catch (_error) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return null;
    }

    try {
      return JSON.parse(match[0]);
    } catch (_secondError) {
      return null;
    }
  }
}

function storeResumeInSession(session, resumeData) {
  session.resume = {
    fileName: resumeData.fileName || "",
    source: resumeData.source,
    resumeText: resumeData.resumeText,
    updatedAt: new Date().toISOString()
  };
}

function storeResumeBuilderInSession(session, builderData) {
  session.resumeBuilder = {
    ...builderData,
    updatedAt: new Date().toISOString()
  };
}

function cleanResumeText(text) {
  if (!text) {
    return "";
  }

  return String(text)
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeBuilderField(value) {
  return String(value || "").trim();
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return uniqueStrings(value.map((item) => normalizeBuilderField(item)).filter(Boolean));
  }

  return uniqueStrings(
    String(value || "")
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function normalizeObjectArray(value, shape) {
  if (!Array.isArray(value) || !value.length) {
    return [shape];
  }

  return value.map((item) => ({ ...shape, ...(item || {}) }));
}

function uniqueStrings(items = []) {
  return [...new Set(items.map((item) => cleanResumeText(item)).filter(Boolean))];
}

function buildFallbackSummary(data) {
  const role = data.jobRole || "software role";
  const skills = data.skills.flatMap((group) => group.items || []).slice(0, 4).join(", ");
  return cleanResumeText(
    `Motivated candidate targeting ${role}${skills ? ` with strengths in ${skills}` : ""}. Focused on clear execution, practical problem solving, and ATS-friendly presentation.`
  );
}

function buildSkillGroups(input = [], generated = []) {
  if (Array.isArray(generated) && generated.some((item) => item && typeof item === "object" && "category" in item)) {
    return generated
      .map((item) => ({
        category: cleanResumeText(item.category),
        items: uniqueStrings(item.items || [])
      }))
      .filter((item) => item.category || item.items.length);
  }

  return input
    .map((item) => ({
      category: cleanResumeText(item.category),
      items: uniqueStrings(item.items || [])
    }))
    .filter((item) => item.category || item.items.length);
}

function buildExperienceEntries(input = [], generated = []) {
  const generatedList = Array.isArray(generated) ? generated : [];

  return input
    .filter((item) => item.role || item.company || item.description)
    .map((item, index) => {
      const ai = generatedList[index] || {};
      return {
        role: cleanResumeText(ai.role || item.role),
        company: cleanResumeText(ai.company || item.company),
        startDate: cleanResumeText(ai.startDate || item.startDate),
        endDate: cleanResumeText(ai.endDate || item.endDate),
        duration: cleanResumeText(ai.duration || item.duration || formatDateRange(item.startDate, item.endDate)),
        description: cleanResumeText(ai.description || item.description),
        bullets: uniqueStrings(ai.bullets?.length ? ai.bullets : deriveBullets(item.description))
      };
    });
}

function buildProjectEntries(input = [], generated = []) {
  const generatedList = Array.isArray(generated) ? generated : [];

  return input
    .filter((item) => item.title || item.description)
    .map((item, index) => {
      const ai = generatedList[index] || {};
      return {
        title: cleanResumeText(ai.title || item.title),
        description: cleanResumeText(ai.description || item.description),
        techStack: uniqueStrings(ai.techStack?.length ? ai.techStack : item.techStack),
        bullets: uniqueStrings(ai.bullets?.length ? ai.bullets : deriveBullets(item.description))
      };
    });
}

function buildEducationEntries(input = [], generated = []) {
  const generatedList = Array.isArray(generated) ? generated : [];

  return input
    .filter((item) => item.degree || item.college)
    .map((item, index) => {
      const ai = generatedList[index] || {};
      return {
        degree: cleanResumeText(ai.degree || item.degree),
        school: cleanResumeText(ai.school || item.college),
        cgpa: cleanResumeText(ai.cgpa || item.cgpa),
        startDate: cleanResumeText(ai.startDate || item.startDate),
        endDate: cleanResumeText(ai.endDate || item.endDate)
      };
    });
}

function buildCustomSections(input = [], generated = []) {
  if (Array.isArray(generated) && generated.length) {
    return generated
      .map((item) => ({
        title: cleanResumeText(item.title),
        items: uniqueStrings(item.items || []),
        isVisible: item.isVisible !== false
      }))
      .filter((item) => item.title || item.items.length);
  }

  return input
    .map((item) => ({
      title: cleanResumeText(item.title),
      items: uniqueStrings(item.items || []),
      isVisible: item.isVisible !== false
    }))
    .filter((item) => item.title || item.items.length);
}

function deriveBullets(text) {
  return String(text || "")
    .split(/\n|\. /)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function pushSection(target, title, items, bullets = false) {
  const cleanedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!cleanedItems.length) {
    return;
  }

  target.push("", title);
  cleanedItems.forEach((item) => {
    target.push(bullets ? `- ${item}` : item);
  });
}

function pushLatexSection(target, title, items, bullets = false) {
  const cleanedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!cleanedItems.length) {
    return;
  }

  target.push(`\\section*{${escapeLatexText(title)}}`);

  if (bullets) {
    target.push("\\begin{itemize}");
    cleanedItems.forEach((item) => target.push(`\\item ${item}`));
    target.push("\\end{itemize}");
    return;
  }

  cleanedItems.forEach((item) => target.push(`${item}\\\\`));
}

function pushLatexEntrySection(target, title, items = [], titleRenderer, subtitleRenderer, descriptionField) {
  const cleanedItems = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!cleanedItems.length) {
    return;
  }

  target.push(`\\section*{${escapeLatexText(title)}}`);
  cleanedItems.forEach((item) => {
    target.push(`\\textbf{${titleRenderer(item)}}\\\\`);
    const subtitle = subtitleRenderer(item);
    if (subtitle) {
      target.push(`${subtitle}\\\\`);
    }
    if (descriptionField && item[descriptionField]) {
      target.push(`${escapeLatexText(item[descriptionField])}\\\\`);
    }
    if (Array.isArray(item.bullets) && item.bullets.length) {
      target.push("\\begin{itemize}");
      item.bullets.forEach((bullet) => target.push(`\\item ${escapeLatexText(bullet)}`));
      target.push("\\end{itemize}");
    }
  });
}

function escapePdfText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function escapeLatexText(value) {
  return String(value || "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

function escapeLatexUrl(value) {
  return String(value || "").replace(/\\/g, "/");
}

function formatPhone(personalInfo = {}) {
  return [normalizeBuilderField(personalInfo.countryCode), normalizeBuilderField(personalInfo.phoneNumber)].filter(Boolean).join(" ").trim();
}

function formatDateRange(startDate, endDate) {
  const start = normalizeBuilderField(startDate);
  const end = normalizeBuilderField(endDate);

  if (!start && !end) {
    return "";
  }

  const formatPart = (value) => {
    if (!value) {
      return "Present";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return parsed.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric"
    });
  };

  return `${formatPart(start)} - ${formatPart(end)}`;
}

function defaultSectionVisibility() {
  return {
    summary: true,
    education: true,
    skills: true,
    projects: true,
    experience: true,
    certifications: true,
    achievements: true,
    customSections: true,
    hobbies: true
  };
}

module.exports = {
  buildFallbackResume,
  buildResumeLatex,
  buildResumePdfBuffer,
  buildResumeGenerationPrompt,
  buildResumeText,
  buildStructuredResume,
  cleanResumeText,
  getResumeBuilderQuestion,
  normalizeResumeBuilderData,
  normalizeResumeRequest,
  parseGeneratedResumeJson,
  parseUploadedResume,
  storeResumeBuilderInSession,
  storeResumeInSession
};
