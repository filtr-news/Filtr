// app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      {/* Logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-sm.png"
        alt="Filtr"
        style={{ width: 200, marginBottom: "2.5rem", opacity: 0.9 }}
      />

      {/* Green filter bar accent — matches the brand mark */}
      <div
        aria-hidden="true"
        style={{
          width: 2,
          height: 48,
          backgroundColor: "#6aaa8e",
          borderRadius: 2,
          marginBottom: "2rem",
        }}
      />

      <h1
        style={{
          fontSize: "1.1rem",
          fontWeight: 400,
          color: "#9ca3af",
          marginBottom: "0.5rem",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        404
      </h1>

      <p
        style={{
          fontSize: "1.5rem",
          fontWeight: 500,
          marginBottom: "0.75rem",
          color: "#ffffff",
        }}
      >
        Nothing to extract here.
      </p>

      <p
        style={{
          fontSize: "1rem",
          color: "#6b7280",
          marginBottom: "2.5rem",
          maxWidth: 360,
          lineHeight: 1.6,
        }}
      >
        That page doesn&apos;t exist. Let&apos;s get you back to filtering what matters.
      </p>

      <Link
        href="/"
        style={{
          display: "inline-block",
          padding: "0.6rem 1.5rem",
          border: "1px solid #6aaa8e",
          borderRadius: "6px",
          color: "#6aaa8e",
          textDecoration: "none",
          fontSize: "0.9rem",
          letterSpacing: "0.05em",
          transition: "background 0.15s",
        }}
      >
        Back to Filtr →
      </Link>
    </div>
  );
}
