import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (size: number, strokeWidth: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
});

export function ChevronLeftIcon({ size = 22, ...p }: IconProps) {
  return (
    <svg {...base(size, 2.25)} {...p}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function CheckIcon({ size = 16, ...p }: IconProps) {
  return (
    <svg {...base(size, 3)} {...p}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function PhoneIcon({ size = 14, ...p }: IconProps) {
  return (
    <svg {...base(size, 2.5)} {...p}>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </svg>
  );
}
