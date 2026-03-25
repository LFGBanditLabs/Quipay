import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

// ─── Data ─────────────────────────────────────────────────────────────────────

interface FAQ {
  id: number;
  categoryKey: string;
  question: string;
  answer: string;
}

const CATEGORY_KEYS = [
  "all",
  "tokens",
  "streams",
  "withdrawals",
  "security",
  "fees",
  "account",
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

interface FAQDef {
  id: number;
  categoryKey: Exclude<CategoryKey, "all">;
}

const FAQ_DEFS: FAQDef[] = [
  { id: 1, categoryKey: "tokens" },
  { id: 2, categoryKey: "tokens" },
  { id: 3, categoryKey: "tokens" },
  { id: 4, categoryKey: "tokens" },
  { id: 5, categoryKey: "streams" },
  { id: 6, categoryKey: "streams" },
  { id: 7, categoryKey: "streams" },
  { id: 8, categoryKey: "streams" },
  { id: 9, categoryKey: "streams" },
  { id: 10, categoryKey: "streams" },
  { id: 11, categoryKey: "withdrawals" },
  { id: 12, categoryKey: "withdrawals" },
  { id: 13, categoryKey: "withdrawals" },
  { id: 14, categoryKey: "withdrawals" },
  { id: 15, categoryKey: "withdrawals" },
  { id: 16, categoryKey: "fees" },
  { id: 17, categoryKey: "fees" },
  { id: 18, categoryKey: "fees" },
  { id: 19, categoryKey: "security" },
  { id: 20, categoryKey: "security" },
  { id: 21, categoryKey: "security" },
  { id: 22, categoryKey: "security" },
  { id: 23, categoryKey: "account" },
  { id: 24, categoryKey: "account" },
  { id: 25, categoryKey: "account" },
];

// ─── Icons ────────────────────────────────────────────────────────────────────

const IconSearch = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: open ? "rotate(180deg)" : "rotate(0deg)",
      transition: "transform .25s ease",
    }}
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const IconX = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ─── Highlight matching text ──────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escaped})`, "gi");
  const parts = text.split(regex);
  // Pre-compute character-offset keys so we never mutate during render
  const keyed = parts.reduce<{ key: string; part: string }[]>((acc, part) => {
    const offset =
      acc.length > 0 ? acc.reduce((sum, item) => sum + item.part.length, 0) : 0;
    acc.push({ key: `${offset}-${part.length}`, part });
    return acc;
  }, []);
  return (
    <>
      {keyed.map(({ key, part }) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={key}
            style={{
              background: "var(--accent-transparent-strong)",
              color: "inherit",
              borderRadius: "2px",
              padding: "0 1px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={key}>{part}</span>
        ),
      )}
    </>
  );
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────

function FAQItem({
  faq,
  query,
  defaultOpen,
}: {
  faq: FAQ;
  query: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <div className={`hc-faq-item ${open ? "open" : ""}`}>
      <button
        className="hc-faq-q"
        onClick={() => {
          setOpen((o: boolean) => !o);
        }}
        aria-expanded={open}
      >
        <span>
          <Highlight text={faq.question} query={query} />
        </span>
        <span className="hc-faq-chevron">
          <IconChevron open={open} />
        </span>
      </button>
      <div
        className="hc-faq-a-wrap"
        style={{ maxHeight: open ? "500px" : "0" }}
      >
        <div className="hc-faq-a">
          <Highlight text={faq.answer} query={query} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HelpCenter() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");

  const faqs: FAQ[] = useMemo(
    () =>
      FAQ_DEFS.map((def) => ({
        id: def.id,
        categoryKey: def.categoryKey,
        question: t(`help.faq_${def.id}_q`),
        answer: t(`help.faq_${def.id}_a`),
      })),
    [t],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return faqs.filter((f: FAQ) => {
      const matchesCategory =
        activeCategory === "all" || f.categoryKey === activeCategory;
      const matchesQuery =
        !q ||
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory, faqs]);

  const grouped = useMemo(() => {
    const isFiltered = activeCategory !== "all" || query.trim();
    if (isFiltered) {
      const key =
        activeCategory !== "all"
          ? t(`help.cat_${activeCategory}`)
          : t("help.results_label");
      return { [key]: filtered };
    }
    return (CATEGORY_KEYS.slice(1) as Exclude<CategoryKey, "all">[]).reduce<
      Record<string, FAQ[]>
    >((acc, cat) => {
      const items = filtered.filter((f: FAQ) => f.categoryKey === cat);
      if (items.length) acc[t(`help.cat_${cat}`)] = items;
      return acc;
    }, {});
  }, [filtered, activeCategory, query, t]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Mulish:wght@400;500;600;700&display=swap');

        @keyframes hcFadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hcPulse  { 0%,100% { opacity:.6; } 50% { opacity:1; } }

        .hc-root *, .hc-root *::before, .hc-root *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .hc-root {
          font-family: 'Mulish', sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          padding: 0 0 80px;
        }

        .hc-hero {
          background: var(--text);
          padding: 64px 24px 80px;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .hc-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 55% 60% at 20% 50%, var(--accent-transparent) 0%, transparent 60%),
            radial-gradient(ellipse 45% 50% at 80% 40%, var(--accent-transparent) 0%, transparent 60%);
          pointer-events: none;
        }
        .hc-hero-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .18em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 16px;
          animation: hcFadeUp .4s ease both;
        }
        .hc-hero-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(32px, 5vw, 54px);
          font-weight: 700;
          color: var(--bg);
          line-height: 1.15;
          margin-bottom: 16px;
          animation: hcFadeUp .4s .08s ease both;
        }
        .hc-hero-title span { color: var(--accent); }
       

        .hc-search-wrap {
          position: relative;
          max-width: 560px;
          margin: 0 auto;
          animation: hcFadeUp .4s .22s ease both;
        }
        .hc-search-icon {
          position: absolute;
          left: 18px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--muted);
          pointer-events: none;
          display: flex;
        }
        .hc-search-input {
          width: 100%;
          padding: 16px 48px 16px 50px;
          border: none;
          border-radius: 12px;
          font-family: 'Mulish', sans-serif;
          font-size: 15px;
          background: var(--surface);
          color: var(--text);
          box-shadow: 0 4px 24px var(--shadow-color);
          outline: none;
          transition: box-shadow .2s;
        }
        .hc-search-input::placeholder { color: var(--muted); }
        .hc-search-input:focus { box-shadow: 0 4px 32px var(--accent-transparent-strong), 0 0 0 2px var(--accent); }
        .hc-search-clear {
          position: absolute;
          right: 16px;
          top: 50%;
          transform: translateY(-50%);
          background: var(--surface-subtle);
          border: none;
          border-radius: 50%;
          width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          color: var(--muted);
          transition: background .2s, color .2s;
        }
        .hc-search-clear:hover { background: var(--accent); color: #fff; }

        .hc-stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          padding: 28px 24px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
        }
        .hc-stat { text-align: center; }
        .hc-stat-num {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 700;
          color: var(--accent);
          line-height: 1;
        }
        .hc-stat-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-top: 4px;
        }

        .hc-body {
          max-width: 860px;
          margin: 0 auto;
          padding: 40px 24px 0;
        }

        .hc-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 36px;
          animation: hcFadeUp .35s ease both;
        }
        .hc-chip {
          padding: 7px 16px;
          border-radius: 99px;
          border: 1.5px solid var(--border);
          background: var(--card);
          font-family: 'Mulish', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: var(--muted);
          cursor: pointer;
          transition: all .18s;
          letter-spacing: .02em;
        }
        .hc-chip:hover { border-color: var(--accent); color: var(--accent); }
        .hc-chip.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #fff;
          box-shadow: 0 2px 12px var(--accent-transparent-strong);
        }

        .hc-section { margin-bottom: 40px; animation: hcFadeUp .3s ease both; }
        .hc-section-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--text);
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 2px solid var(--border);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hc-section-count {
          font-family: 'Mulish', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .08em;
          color: #fff;
          background: var(--accent);
          border-radius: 99px;
          padding: 2px 8px;
        }

        .hc-faq-item {
          border: 1.5px solid var(--border);
          border-radius: 14px;
          margin-bottom: 8px;
          background: var(--card);
          overflow: hidden;
          transition: border-color .2s, box-shadow .2s;
        }
        .hc-faq-item:hover, .hc-faq-item.open {
          border-color: var(--accent-transparent-strong);
          box-shadow: 0 2px 16px var(--shadow-color);
        }
        .hc-faq-q {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 18px 20px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: 'Mulish', sans-serif;
          font-size: 15px;
          font-weight: 700;
          color: var(--text);
          line-height: 1.4;
          transition: color .2s;
        }
        .hc-faq-q:hover { color: var(--accent); }
        .hc-faq-chevron { flex-shrink: 0; color: var(--muted); display: flex; }
        .hc-faq-a-wrap {
          overflow: hidden;
          transition: max-height .3s cubic-bezier(.4,0,.2,1);
        }
        .hc-faq-a {
          padding: 16px 20px 20px;
          font-size: 14px;
          line-height: 1.75;
          color: var(--text);
          border-top: 1px solid var(--border);
        }

        .hc-empty {
          text-align: center;
          padding: 64px 24px;
          color: var(--muted);
        }
        .hc-empty-icon { font-size: 48px; margin-bottom: 16px; animation: hcPulse 2s ease infinite; }
        .hc-empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          color: var(--text);
          margin-bottom: 8px;
        }
        .hc-empty-sub { font-size: 14px; }

        .hc-contact {
          margin-top: 56px;
          padding: 36px 32px;
          background: var(--text);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }
        .hc-contact-text h3 {
          font-family: 'Playfair Display', serif;
          font-size: 22px;
          color: #f5f3ff;
          margin-bottom: 6px;
        }
        .hc-contact-text p { font-size: 14px; color: #8a7f74; line-height: 1.5; }
        .hc-contact-btn {
          padding: 13px 28px;
          background: var(--accent);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: 'Mulish', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: opacity .2s, transform .15s;
          box-shadow: 0 4px 16px var(--accent-transparent-strong);
          letter-spacing: .03em;
        }
        .hc-contact-btn:hover { opacity: .9; transform: translateY(-1px); }

        @media (max-width: 600px) {
          .hc-stats { gap: 16px; }
          .hc-contact { flex-direction: column; text-align: center; }
          .hc-contact-btn { width: 100%; }
        }
      `}</style>

      <div className="hc-root">
        {/* Hero */}
        <div className="hc-hero">
          <div className="hc-hero-eyebrow">{t("help.eyebrow")}</div>
          <h1 className="hc-hero-title">
            {t("help.hero_title_line1")}
            <br />
            {t("help.hero_title_line2")}{" "}
            <span>{t("help.hero_title_highlight")}</span>
          </h1>
          <p style={{ color: "var(--bg)" }}>{t("help.hero_subtitle")}</p>
          <div className="hc-search-wrap">
            <span className="hc-search-icon">
              <IconSearch />
            </span>
            <input
              className="hc-search-input"
              type="text"
              placeholder={t("help.search_placeholder")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              aria-label={t("help.search_aria")}
            />
            {query && (
              <button
                className="hc-search-clear"
                onClick={() => {
                  setQuery("");
                }}
                aria-label={t("help.clear_search_aria")}
              >
                <IconX />
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hc-stats">
          <div className="hc-stat">
            <div className="hc-stat-num">{FAQ_DEFS.length}+</div>
            <div className="hc-stat-label">{t("help.stats_articles")}</div>
          </div>
          <div className="hc-stat">
            <div className="hc-stat-num">{CATEGORY_KEYS.length - 1}</div>
            <div className="hc-stat-label">{t("help.stats_categories")}</div>
          </div>
          <div className="hc-stat">
            <div className="hc-stat-num">~5s</div>
            <div className="hc-stat-label">{t("help.stats_avg_time")}</div>
          </div>
        </div>

        {/* Body */}
        <div className="hc-body">
          {/* Category chips */}
          <div className="hc-chips">
            {CATEGORY_KEYS.map((key) => (
              <button
                key={key}
                className={`hc-chip ${activeCategory === key ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(key);
                  setQuery("");
                }}
              >
                {t(`help.cat_${key}`)}
              </button>
            ))}
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="hc-empty">
              <div className="hc-empty-icon">🔍</div>
              <div className="hc-empty-title">{t("help.no_results_title")}</div>
              <div className="hc-empty-sub">{t("help.no_results_sub")}</div>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div className="hc-section" key={cat}>
                <div className="hc-section-title">
                  {cat}
                  <span className="hc-section-count">{items.length}</span>
                </div>
                {items.map((faq: FAQ) => (
                  <FAQItem
                    key={faq.id}
                    faq={faq}
                    query={query}
                    defaultOpen={!!query.trim()}
                  />
                ))}
              </div>
            ))
          )}

          {/* Contact banner */}
          {/* <div className="hc-contact">
            <div className="hc-contact-text">
              <h3>Still have questions?</h3>
              <p>
                Can not find what you are looking for? Reach out to our team on
                Discord or open a GitHub issue.
              </p>
            </div>
            <button
              className="hc-contact-btn"
              onClick={() => {
                window.open("https://discord.gg/quipay", "_blank");
              }}
            >
              Join our Discord
            </button>
          </div> */}
        </div>
      </div>
    </>
  );
}
