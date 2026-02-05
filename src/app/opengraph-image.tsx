import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Eurecode - 思考を渡す学習プラットフォーム";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 40,
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          padding: "60px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "16px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
              fontWeight: "bold",
            }}
          >
            E
          </div>
          <span
            style={{
              fontSize: "52px",
              fontWeight: "bold",
              letterSpacing: "-1px",
            }}
          >
            Eurecode
          </span>
        </div>
        <div
          style={{
            fontSize: "36px",
            fontWeight: "bold",
            textAlign: "center",
            marginBottom: "20px",
            background: "linear-gradient(90deg, #6366f1, #a78bfa, #6366f1)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          思考を渡す学習プラットフォーム
        </div>
        <div
          style={{
            fontSize: "22px",
            textAlign: "center",
            color: "#a1a1aa",
            maxWidth: "800px",
            lineHeight: "1.6",
          }}
        >
          コードを渡すのではなく、思考プロセスを渡す。
          <br />
          プログラミング学習支援AIチャットサービス
        </div>
        <div
          style={{
            display: "flex",
            gap: "24px",
            marginTop: "40px",
          }}
        >
          {["解説モード", "生成モード", "壁打ちモード"].map((mode) => (
            <div
              key={mode}
              style={{
                padding: "10px 24px",
                borderRadius: "9999px",
                border: "1px solid rgba(99, 102, 241, 0.4)",
                background: "rgba(99, 102, 241, 0.1)",
                fontSize: "18px",
                color: "#a5b4fc",
              }}
            >
              {mode}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
