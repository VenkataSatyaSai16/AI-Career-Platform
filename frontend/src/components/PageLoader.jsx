function PageLoader({ label = "Loading data" }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
      <p className="text-sm font-medium text-slate-600">{label}</p>
    </div>
  );
}

export default PageLoader;
