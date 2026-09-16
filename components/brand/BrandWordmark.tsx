type BrandWordmarkProps = {
  className?: string;
};

export function BrandWordmark({ className }: BrandWordmarkProps) {
  return (
    <span className={["brand-wordmark", className].filter(Boolean).join(" ")}>
      SANDHI
    </span>
  );
}
