import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen / PWA app icon — white TGC on black square. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          borderRadius: 0,
          fontSize: 62,
          fontWeight: 800,
          color: "#ffffff",
          fontFamily: "Georgia, serif",
          letterSpacing: "0.03em",
        }}
      >
        TGC
      </div>
    ),
    { ...size }
  );
}
