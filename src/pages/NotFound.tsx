import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

export default function NotFound() {
  const navigate = useNavigate();
  const [count, setCount] = useState(10);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => {
        if (c <= 1) {
          clearInterval(id);
          void navigate("/");
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-center">
      {/* Large 404 */}
      <p
        className="select-none font-black text-white leading-none"
        style={{
          fontSize: "clamp(6rem, 20vw, 14rem)",
          letterSpacing: "-0.04em",
          opacity: 0.08,
        }}
      >
        404
      </p>

      {/* Content */}
      <div className="-mt-8 flex flex-col items-center gap-5">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            backgroundColor: "rgba(250,204,21,0.1)",
            border: "1px solid rgba(250,204,21,0.2)",
          }}
        >
          <svg
            className="h-7 w-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#facc15"
            strokeWidth="1.75"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
            <circle cx="12" cy="16" r="0.5" fill="#facc15" />
          </svg>
        </div>

        <div>
          <h1
            className="text-[28px] font-bold text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            Page not found
          </h1>
          <p className="mt-2 text-[15px] text-neutral-500">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
            style={{ backgroundColor: "#facc15" }}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            </svg>
            Go home
          </Link>
          <button
            onClick={() => {
              void navigate(-1);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-6 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-white/[0.08]"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                d="M19 12H5M5 12l7 7M5 12l7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Go back
          </button>
        </div>

        <p className="text-[12px] text-neutral-700">
          Redirecting to home in{" "}
          <span className="font-mono font-bold text-neutral-500">{count}s</span>
        </p>
      </div>
    </div>
  );
}
