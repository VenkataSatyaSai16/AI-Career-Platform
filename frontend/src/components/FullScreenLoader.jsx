function FullScreenLoader({ label = "Loading" }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-10 py-12 text-center shadow-2xl shadow-cyan-950/20 backdrop-blur">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-cyan-400" />
        <p className="text-sm font-medium text-slate-200">{label}</p>
      </div>
    </div>
  );
}

export default FullScreenLoader;
