import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab favicon — white TGC on black square. */
export default function Icon() {
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
          fontSize: 11,
          fontWeight: 800,
          color: "#ffffff",
          fontFamily: "Georgia, serif",
          letterSpacing: "0.04em",
        }}
      >
        TGC
      </div>
    ),
    { ...size }
  );
}
