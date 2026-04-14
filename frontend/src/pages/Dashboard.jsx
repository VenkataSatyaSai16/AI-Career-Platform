import React, { useMemo } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout, uploadProfileImage } from "../services/api";
import { clearAuth, getStoredAuthUser, updateStoredAuthUser } from "../utils/auth";

function Dashboard() {
  const navigate = useNavigate();
  const authUser = useMemo(() => getStoredAuthUser(), []);
  const [profileImage, setProfileImage] = useState(authUser?.profileImage || "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (_error) {
      // Keep logout resilient.
    }

    clearAuth();
    navigate("/", { replace: true });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingImage(true);
    setImageError("");

    try {
      const formData = new FormData();
      formData.append("image", file);
      const response = await uploadProfileImage(formData);
      setProfileImage(response.url || "");
      updateStoredAuthUser({ profileImage: response.url || "" });
    } catch (error) {
      setImageError(error.message || "Image upload failed");
    } finally {
      setUploadingImage(false);
      event.target.value = "";
    }
  };

  const featureCards = [
    {
      eyebrow: "Study Calendar",
      title: "View, create, drag, and sync study sessions on a live calendar",
      description:
        "See all scheduled study tasks in calendar form, move them across time slots, inspect details, and keep updates flowing back to the backend.",
      action: "Open Calendar",
      onClick: () => navigate("/calendar"),
      badge: "Calendar"
    },
    {
      eyebrow: "AI Study Planner",
      title: "Build, track, reschedule, and replan your study roadmap",
      description:
        "Describe what you want to learn in plain language, generate a day-wise plan, mark progress, export it, and update it when life gets in the way.",
      action: "Open Study Planner",
      onClick: () => navigate("/study-planner"),
      badge: "Planner"
    },
    {
      eyebrow: "AI Interview",
      title: "Practice interviews with resume-aware coaching",
      description:
        "Upload a resume, switch interview modes, take voice-enabled mocks, and revisit score-based reports from previous sessions.",
      action: "Open Interview Workspace",
      onClick: () => navigate("/interview-workspace"),
      badge: "Interview"
    },
    {
      eyebrow: "Feedback Actions",
      title: "Generate a study plan later from saved interview feedback",
      description:
        "Keep interview feedback separate from planning, then create a new study plan only when you want one.",
      action: "Generate Plan from Feedback",
      onClick: () => navigate("/interview-workspace", { state: { openPlanGenerator: true } }),
      badge: "Feedback"
    },
    {
      eyebrow: "ATS Friendly Resume Generator",
      title: "Create a separate ATS-safe resume with templates and PDF export",
      description:
        "Fill a structured form, choose a clean template, generate optimized resume content with AI, preview it, and download it as a PDF.",
      action: "Open Resume Generator",
      onClick: () => navigate("/ats-resume-generator"),
      badge: "Resume"
    },
    {
      eyebrow: "Progress Dashboard",
      title: "See how your interview performance changes over time",
      description:
        "Track overall score, communication, technical depth, and completeness across completed interviews.",
      action: "View Progress",
      onClick: () => navigate("/progress"),
      badge: "Progress"
    }
  ];

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#e2e8f0_100%)] px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 px-8 py-10 text-white shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">Workspace</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
                Choose the AI tool you want to work with today.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300">
                Signed in as {authUser?.email || authUser?.name || "your account"}. This hub is set up for your study planner and
                AI interview flow now,
                with room to add more features later without changing the overall experience.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Logout
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Unified Flow</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">Home, auth, feature hub, then focused product workspaces.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Same Visual Language</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">The planner and interview experiences follow the same UI direction.</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Expandable</p>
              <p className="mt-2 text-sm leading-6 text-slate-200">This page is ready to hold additional AI tools later on.</p>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Profile Image</p>
                <h2 className="mt-3 text-2xl font-semibold text-slate-900">Upload to Cloudinary</h2>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Image</span>
            </div>

            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl bg-slate-100 text-xs font-semibold text-slate-500">
                {profileImage ? <img src={profileImage} alt="Profile" className="h-full w-full object-cover" /> : "No image"}
              </div>
              <label className="rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {uploadingImage ? "Uploading..." : "Upload Image"}
              </label>
            </div>

            {imageError ? <p className="mt-4 text-sm text-rose-700">{imageError}</p> : null}
          </article>

          {featureCards.map((card) => (
            <article
              key={card.title}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{card.eyebrow}</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">{card.title}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{card.badge}</span>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">{card.description}</p>

              <button
                type="button"
                onClick={card.onClick}
                className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {card.action}
              </button>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
