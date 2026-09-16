type JunctionNodeProps = {
  active?: boolean;
  className?: string;
  size?: "small" | "medium";
};

export function JunctionNode({
  active = false,
  className,
  size = "small",
}: JunctionNodeProps) {
  return (
    <span
      className={["junction-node", className].filter(Boolean).join(" ")}
      data-active={active ? "true" : "false"}
      data-size={size}
      aria-hidden="true"
    />
  );
}
