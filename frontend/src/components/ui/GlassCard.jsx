import { forwardRef } from "react";

export const GlassCard = forwardRef(function GlassCard({ as: Element = "div", hover = false, className = "", children, ...props }, ref) {
  return (
    <Element ref={ref} className={`glass-card ${hover ? "glass-card--hover" : ""} ${className}`.trim()} {...props}>
      {children}
    </Element>
  );
});
