import React from "react";

function ResumeSection({ title, children, titleClassName, className }) {
  if (!children) {
    return null;
  }

  return (
    <section className={className}>
      <h2 className={titleClassName}>{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default ResumeSection;
