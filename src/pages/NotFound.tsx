import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section
      className="relative grid min-h-[calc(100vh-180px)] place-items-center overflow-hidden px-4 pb-12 pt-8"
      aria-labelledby="not-found-title"
    >
      <div
        className="animate-breathe pointer-events-none absolute h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.22)_0%,transparent_70%)] blur-[50px]"
        aria-hidden="true"
      />

      <article className="relative z-10 w-full max-w-[700px] rounded-[22px] border border-[rgba(148,163,184,0.28)] bg-[linear-gradient(160deg,rgba(15,23,42,0.9),rgba(30,41,59,0.78)),var(--surface)] px-[1.3rem] pb-[2.3rem] pt-[2.1rem] text-center shadow-[0_18px_44px_rgba(2,6,23,0.55),inset_0_1px_0_rgba(255,255,255,0.05)] max-sm:rounded-2xl max-sm:px-4 max-sm:pb-7 max-sm:pt-6">
        <div
          className="relative mx-auto mb-4 grid aspect-square w-[min(300px,85vw)] place-items-center"
          role="img"
          aria-label="Centered animated 404 illustration"
        >
          <div className="animate-spin-outer absolute inset-[8%] rounded-full border-2 border-[rgba(125,211,252,0.4)]" />
          <div className="animate-spin-inner absolute inset-[22%] rounded-full border-2 border-[rgba(167,139,250,0.55)]" />
          <div className="absolute inset-[32%] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.45)_0%,rgba(99,102,241,0.1)_65%,transparent_100%)] blur-[4px]" />
          <p className="drop-shadow-[0_0_24px_rgba(103,232,249,0.35)] relative z-10 m-0 text-[clamp(3.8rem,12vw,5.8rem)] font-extrabold leading-none tracking-[0.04em] text-slate-50">
            404
          </p>
        </div>

        <p className="mb-[0.45rem] mt-0 text-[0.82rem] font-bold uppercase tracking-[0.08em] text-blue-300">
          Error 404
        </p>
        <h1
          id="not-found-title"
          className="m-0 text-[clamp(1.55rem,3.3vw,2.2rem)] leading-[1.2] text-slate-50"
        >
          Page not found
        </h1>
        <p className="mx-auto mb-[1.3rem] mt-[0.85rem] max-w-[500px] leading-[1.55] text-slate-300">
          This route does not exist in Quipay. Head back home and continue from
          a valid page.
        </p>

        <Link
          to="/"
          className="inline-flex min-w-[132px] items-center justify-center rounded-full border border-[rgba(147,197,253,0.42)] bg-[linear-gradient(135deg,#0ea5e9,#6366f1)] px-[1.15rem] py-[0.72rem] font-bold text-slate-50 shadow-[0_10px_24px_rgba(59,130,246,0.32)] outline-none transition-all duration-150 ease-out hover:-translate-y-[2px] hover:shadow-[0_14px_28px_rgba(59,130,246,0.38)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Go Home
        </Link>
      </article>
    </section>
  );
}
