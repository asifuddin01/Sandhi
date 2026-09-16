import { ImageResponse } from "next/og";

import { darkBrandColors, themeMetadataColors } from "@/styles/tokens";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: themeMetadataColors.dark,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <svg width="148" height="148" viewBox="0 0 148 148">
        <g
          fill="none"
          stroke={darkBrandColors.lotus}
          strokeLinecap="round"
          strokeWidth="4"
        >
          <path d="M16 38c30 0 43 13 58 36" />
          <path d="M132 110c-30 0-43-13-58-36" />
          <path d="M16 110c30 0 43-13 58-36" />
          <path d="M132 38c-30 0-43 13-58 36" />
        </g>
        <circle
          cx="74"
          cy="74"
          r="18"
          fill="none"
          stroke={darkBrandColors.lamplight}
          strokeOpacity=".32"
          strokeWidth="3"
        />
        <circle cx="74" cy="74" r="8" fill={darkBrandColors.lamplight} />
      </svg>
    </div>,
    size,
  );
}
