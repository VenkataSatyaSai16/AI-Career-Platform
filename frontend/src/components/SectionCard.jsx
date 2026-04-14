function SectionCard({ title, subtitle, action, children, className = "" }) {
  return (
    <section className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      {(title || subtitle || action) && (
        <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export default SectionCard;
