export function Button({ as: Element = "button", variant = "primary", size = "md", className = "", type = "button", children, ...props }) {
  return (
    <Element
      className={`button button--${variant} ${size !== "md" ? `button--${size}` : ""} ${className}`.trim()}
      type={Element === "button" ? type : undefined}
      {...props}
    >
      {children}
    </Element>
  );
}
