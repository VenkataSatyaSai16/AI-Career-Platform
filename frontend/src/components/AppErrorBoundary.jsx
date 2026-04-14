import React from "react";
import { Link } from "react-router-dom";

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unknown render error"
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Application render error", error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  render() {
    if (this.state.hasError) {
      const isAtsRoute = this.props.currentPath === "/ats-resume-generator";

      return (
        <div className="min-h-screen bg-slate-100 px-4 py-10">
          <div className="mx-auto max-w-2xl rounded-3xl border border-rose-200 bg-white p-8 shadow-lg shadow-slate-200/70">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-rose-600">Something broke on this page</p>
            <h1 className="mt-3 text-3xl font-bold text-slate-900">The app hit a render error.</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              Try going back to the dashboard. If this keeps happening, refresh once and we can inspect the specific page data next.
            </p>
            {this.state.errorMessage ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {this.state.errorMessage}
              </div>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/dashboard"
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Go to Dashboard
              </Link>
              <Link
                to="/"
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Go Home
              </Link>
              {isAtsRoute ? (
                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("ai-ats-resume");
                    this.setState({ hasError: false, errorMessage: "" });
                    window.location.assign("/ats-resume-generator");
                  }}
                  className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Reset ATS Draft
                </button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default AppErrorBoundary;
