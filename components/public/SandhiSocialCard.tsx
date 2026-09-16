import { darkBrandColors, themeMetadataColors } from "@/styles/tokens";

export function SandhiSocialCard({
  title,
  section,
}: {
  title: string;
  section: string;
}) {
  return (
    <div
      style={{
        alignItems: "stretch",
        background: themeMetadataColors.dark,
        color: themeMetadataColors.light,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "70px 82px",
        position: "relative",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          fontSize: 24,
          gap: 20,
          letterSpacing: "0.04em",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            height: 42,
            justifyContent: "center",
            position: "relative",
            width: 62,
          }}
        >
          <div
            style={{
              background: darkBrandColors.lotus,
              height: 2,
              left: 0,
              position: "absolute",
              top: 11,
              transform: "rotate(17deg)",
              width: 38,
            }}
          />
          <div
            style={{
              background: darkBrandColors.lotus,
              bottom: 11,
              height: 2,
              left: 0,
              position: "absolute",
              transform: "rotate(-17deg)",
              width: 38,
            }}
          />
          <div
            style={{
              background: darkBrandColors.lamplight,
              borderRadius: 999,
              height: 10,
              left: 34,
              position: "absolute",
              top: 16,
              width: 10,
            }}
          />
          <div
            style={{
              background: darkBrandColors.lotus,
              height: 2,
              left: 43,
              position: "absolute",
              top: 20,
              width: 19,
            }}
          />
        </div>
        <span>SANDHI Research Lab</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{
            color: darkBrandColors.lotus,
            display: "flex",
            fontFamily: "Arial, sans-serif",
            fontSize: 22,
            letterSpacing: "0.03em",
          }}
        >
          {section}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Spectral, Georgia, serif",
            fontSize: title.length > 72 ? 54 : 68,
            fontWeight: 400,
            letterSpacing: "-0.025em",
            lineHeight: 1.08,
            maxWidth: 970,
          }}
        >
          {title}
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          height: 20,
          width: "100%",
        }}
      >
        <div
          style={{
            background: darkBrandColors.lotus,
            height: 2,
            width: "58%",
          }}
        />
        <div
          style={{
            background: darkBrandColors.lamplight,
            borderRadius: 999,
            height: 12,
            width: 12,
          }}
        />
        <div
          style={{
            background: darkBrandColors.lotus,
            height: 2,
            width: "42%",
          }}
        />
      </div>
    </div>
  );
}
