import { BrandMark } from "@/components/brand/BrandMark";
import { BrandWordmark } from "@/components/brand/BrandWordmark";

type BrandLockupProps = {
  className?: string;
  compact?: boolean;
};

export function BrandLockup({ className, compact = false }: BrandLockupProps) {
  return (
    <span
      className={["brand-lockup", className].filter(Boolean).join(" ")}
      aria-label="SANDHI Research Lab"
    >
      <BrandMark className="brand-lockup__mark" />
      <BrandWordmark />
      {!compact && <span className="brand-lockup__suffix">Research Lab</span>}
    </span>
  );
}
