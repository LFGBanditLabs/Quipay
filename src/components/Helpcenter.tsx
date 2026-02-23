import { useState, useMemo } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

interface FAQ {
  id: number;
  category: string;
  question: string;
  answer: string;
}

const CATEGORIES = [
  "All",
  "Tokens",
  "Streams",
  "Withdrawals",
  "Security",
  "Fees",
  "Account",
];

const FAQS: FAQ[] = [
  // Tokens
  {
    id: 1,
    category: "Tokens",
    question: "What is the difference between XLM and USDC?",
    answer:
      "XLM (Stellar Lumens) is the native currency of the Stellar network, used primarily to pay transaction fees and maintain account reserves. USDC is a stablecoin pegged 1:1 to the US Dollar, making it ideal for payroll since its value doesn't fluctuate. Quipay supports both, but USDC is recommended for salary streams to protect workers from price volatility.",
  },
  {
    id: 2,
    category: "Tokens",
    question: "Can I use other tokens besides XLM and USDC?",
    answer:
      "Currently Quipay supports XLM and USDC on the Stellar network. Support for additional Stellar-based assets may be added in future updates. Check our changelog or Discord for announcements.",
  },
  {
    id: 3,
    category: "Tokens",
    question: "How do I add a USDC trustline to my wallet?",
    answer:
      "To receive USDC on Stellar, your wallet must establish a trustline with the USDC issuer (Circle). Most Stellar wallets like Lobstr or XBULL do this automatically when you select USDC. In Quipay, you'll be prompted to add the trustline the first time you set up a USDC stream.",
  },
  {
    id: 4,
    category: "Tokens",
    question: "What is the minimum XLM reserve required?",
    answer:
      "The Stellar network requires every account to maintain a base reserve of 1 XLM. Each additional trustline or data entry adds 0.5 XLM to your required reserve. Quipay will warn you if your balance is close to the minimum reserve.",
  },
  // Streams
  {
    id: 5,
    category: "Streams",
    question: "What is a PayrollStream?",
    answer:
      "A PayrollStream is a smart contract that continuously drips salary to a worker's wallet in real-time. Instead of waiting for a monthly or bi-weekly paycheck, workers accumulate earnings every second. Employers fund the stream upfront and workers can withdraw at any time.",
  },
  {
    id: 6,
    category: "Streams",
    question: "What happens when a stream is canceled?",
    answer:
      "When an employer cancels a stream, it stops immediately. Any earnings already accrued up to that moment remain available for the worker to withdraw. Unspent funds are returned to the employer's wallet. Workers are notified of the cancellation in real-time.",
  },
  {
    id: 7,
    category: "Streams",
    question: "Can a stream be paused instead of canceled?",
    answer:
      "Yes, employers can pause a stream temporarily — for example during unpaid leave. During a pause, no new tokens accumulate. The worker retains access to all previously earned funds. Pausing is reversible; canceling is permanent.",
  },
  {
    id: 8,
    category: "Streams",
    question: "How is the stream rate calculated?",
    answer:
      "The stream rate is calculated as: Annual Salary / 365 / 24 / 3600 = tokens per second. For example, a $52,000/year salary streams at approximately 0.001648 USDC per second. The dashboard shows your live earnings ticking up in real time.",
  },
  {
    id: 9,
    category: "Streams",
    question: "What happens if the employer's stream balance runs out?",
    answer:
      "If the stream contract runs out of funds, the stream automatically pauses. Employers receive an email and in-app warning when the balance drops below a 7-day runway threshold. Workers keep all earnings accrued before the stream stopped.",
  },
  {
    id: 10,
    category: "Streams",
    question: "Can multiple workers be added to one stream?",
    answer:
      "Each stream is tied to one worker wallet address. Employers can create multiple streams simultaneously — one per employee — all managed from the employer dashboard. There is no hard cap on the number of active streams.",
  },
  // Withdrawals
  {
    id: 11,
    category: "Withdrawals",
    question: "When can I withdraw my earnings?",
    answer:
      "You can withdraw your accumulated earnings at any time — there is no lock-up period. Simply click the Withdraw button in your worker dashboard and confirm the transaction in your wallet. Funds arrive within seconds.",
  },
  {
    id: 12,
    category: "Withdrawals",
    question: "Is there a minimum withdrawal amount?",
    answer:
      "There is no minimum enforced by Quipay, but the Stellar network requires enough XLM in your wallet to cover the transaction fee (typically 0.00001 XLM). Extremely small withdrawals may cost more in fees than the amount withdrawn.",
  },
  {
    id: 13,
    category: "Withdrawals",
    question: "How long does a withdrawal take?",
    answer:
      "Stellar transactions confirm in 3-5 seconds on average. Once you confirm the withdrawal in your wallet, funds will appear in your balance almost instantly.",
  },
  {
    id: 14,
    category: "Withdrawals",
    question: "Why is my withdrawable amount showing zero?",
    answer:
      "This can happen if: (1) your stream was just started and only seconds have elapsed, (2) the stream has been paused or canceled, (3) you recently completed a withdrawal and the balance is rebuilding, or (4) there is a network delay fetching your balance — try refreshing.",
  },
  // Fees
  {
    id: 15,
    category: "Fees",
    question: "What fees does Quipay charge?",
    answer:
      "Quipay charges a small protocol fee on each stream, deducted from the employer's deposit. Worker withdrawals have no Quipay fee. The only cost to workers is the Stellar network transaction fee (~0.00001 XLM per transaction), which is negligible.",
  },
  {
    id: 16,
    category: "Fees",
    question: "Are there gas fees on Stellar?",
    answer:
      "Stellar uses a fixed, predictable fee model instead of variable gas. Each transaction costs 100 stroops (0.00001 XLM), which at current XLM prices is a fraction of a cent. This is one of the key reasons Quipay is built on Stellar.",
  },
  {
    id: 17,
    category: "Fees",
    question: "Does Quipay take a cut of my salary?",
    answer:
      "No. The protocol fee is paid by employers on top of the salary amount. Workers receive 100% of the agreed salary with no deductions from Quipay. Your employer covers all streaming fees.",
  },
  // Security
  {
    id: 18,
    category: "Security",
    question: "Is my salary safe if Quipay goes offline?",
    answer:
      "Yes. Salary funds are held in non-custodial smart contracts on the Stellar blockchain, not by Quipay. Even if Quipay's frontend goes offline, you can interact with the contract directly using a Stellar explorer or compatible wallet to withdraw your funds.",
  },
  {
    id: 19,
    category: "Security",
    question: "Can Quipay access or freeze my funds?",
    answer:
      "No. Quipay is a non-custodial protocol — we never hold your private keys or have the ability to move your funds. Only the wallet addresses specified in the stream contract can withdraw. Employers can only cancel future accruals, not reclaim already-earned amounts.",
  },
  {
    id: 20,
    category: "Security",
    question: "Has Quipay's smart contract been audited?",
    answer:
      "Quipay's PayrollStream contracts are open source and have undergone community review. A formal third-party security audit is planned before the mainnet launch. Audit reports will be published publicly. Always check our docs for the latest audit status.",
  },
  {
    id: 21,
    category: "Security",
    question:
      "What should I do if I suspect unauthorized access to my account?",
    answer:
      "Since Quipay is non-custodial, 'account access' means access to your wallet's private key or seed phrase. If compromised: immediately transfer funds to a new secure wallet, then update your stream recipient address with your employer. Never share your seed phrase with anyone, including Quipay support.",
  },
  // Account
  {
    id: 22,
    category: "Account",
    question: "How do I connect my wallet to Quipay?",
    answer:
      "Click 'Connect Wallet' in the top navigation. Quipay supports Freighter, Lobstr, and any WalletConnect-compatible Stellar wallet. Select your wallet provider, approve the connection request, and you're in — no account creation or email required.",
  },
  {
    id: 23,
    category: "Account",
    question: "Can I use Quipay on mobile?",
    answer:
      "Yes. Quipay's interface is fully responsive and works on mobile browsers. For the best mobile experience, use a wallet with a built-in browser like Lobstr. The worker dashboard is optimized for quick balance checks and withdrawals on the go.",
  },
  {
    id: 24,
    category: "Account",
    question: "How do I switch between employer and worker views?",
    answer:
      "The dashboard automatically detects your role based on your wallet activity. If your wallet is set as a stream recipient, you'll see the worker view. If you've created streams, you'll see the employer view. You can toggle manually using the role switcher in the top right corner.",
  },
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
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return FAQS.filter((f: FAQ) => {
      const matchesCategory =
        activeCategory === "All" || f.category === activeCategory;
      const matchesQuery =
        !q ||
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  const grouped = useMemo(() => {
    const isFiltered = activeCategory !== "All" || query.trim();
    if (isFiltered) {
      const key = activeCategory !== "All" ? activeCategory : "Results";
      return { [key]: filtered };
    }
    return CATEGORIES.slice(1).reduce<Record<string, FAQ[]>>((acc, cat) => {
      const items = filtered.filter((f: FAQ) => f.category === cat);
      if (items.length) acc[cat] = items;
      return acc;
    }, {});
  }, [filtered, activeCategory, query]);

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
          <div className="hc-hero-eyebrow">Quipay Help Center</div>
          <h1 className="hc-hero-title">
            Got questions?
            <br />
            We have <span>answers.</span>
          </h1>
          <p style={{ color: "var(--bg)" }}>
            Everything you need to know about tokens, streams, withdrawals, and
            keeping your salary safe.
          </p>
          <div className="hc-search-wrap">
            <span className="hc-search-icon">
              <IconSearch />
            </span>
            <input
              className="hc-search-input"
              type="text"
              placeholder='Search questions… e.g. "cancel stream", "USDC fees"'
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
              }}
              aria-label="Search FAQs"
            />
            {query && (
              <button
                className="hc-search-clear"
                onClick={() => {
                  setQuery("");
                }}
                aria-label="Clear search"
              >
                <IconX />
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hc-stats">
          <div className="hc-stat">
            <div className="hc-stat-num">{FAQS.length}+</div>
            <div className="hc-stat-label">Articles</div>
          </div>
          <div className="hc-stat">
            <div className="hc-stat-num">{CATEGORIES.length - 1}</div>
            <div className="hc-stat-label">Categories</div>
          </div>
          <div className="hc-stat">
            <div className="hc-stat-num">~5s</div>
            <div className="hc-stat-label">Avg answer time</div>
          </div>
        </div>

        {/* Body */}
        <div className="hc-body">
          {/* Category chips */}
          <div className="hc-chips">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`hc-chip ${activeCategory === cat ? "active" : ""}`}
                onClick={() => {
                  setActiveCategory(cat);
                  setQuery("");
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Results */}
          {filtered.length === 0 ? (
            <div className="hc-empty">
              <div className="hc-empty-icon">🔍</div>
              <div className="hc-empty-title">No results found</div>
              <div className="hc-empty-sub">
                Try a different search term or browse by category above.
              </div>
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
