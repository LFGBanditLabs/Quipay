import React from "react";
import { Link } from "react-router-dom";

const footerLinks = {
  product: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Payroll", to: "/payroll" },
    { label: "Treasury", to: "/treasury-management" },
    { label: "Governance", to: "/governance" },
  ],
  resources: [
    { label: "Documentation", to: "/help" },
    { label: "Debugger", to: "/debug" },
    { label: "API Reference", href: "https://developers.stellar.org" },
    { label: "Soroban Docs", href: "https://soroban.stellar.org" },
  ],
  company: [
    { label: "About", href: "#" },
    { label: "Blog", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Contact", href: "#" },
  ],
};

const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/LFGBanditLabs/Quipay",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path
          fillRule="evenodd"
          d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    label: "Twitter / X",
    href: "https://twitter.com/Quipay",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    label: "Discord",
    href: "https://discord.gg/Quipay",
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
      </svg>
    ),
  },
];

const FooterLink: React.FC<{
  label: string;
  to?: string;
  href?: string;
}> = ({ label, to, href }) => {
  const className =
    "text-[var(--muted)] hover:text-[var(--text)] transition-colors duration-200 text-sm";

  if (to) {
    return (
      <Link to={to} className={className}>
        {label}
      </Link>
    );
  }

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  }

  return <span className={className}>{label}</span>;
};

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[var(--surface-subtle)] border-t border-[var(--border)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-500/25">
                Q
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Quipay
              </span>
            </div>
            <p className="text-[var(--muted)] text-sm mb-4 max-w-xs">
              Payroll on Autopilot. Seamless, continuous streaming payments
              built on Stellar.
            </p>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface)] border border-[var(--border)] w-fit">
              <svg
                className="w-4 h-4 text-indigo-400"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M11.99 0C5.366 0 0 5.366 0 11.99c0 5.268 3.297 9.762 7.94 11.386.581.104.778-.252.778-.56 0-.274-.01-.992-.015-1.948-3.232.702-3.913-1.558-3.913-1.558-.528-1.342-1.29-1.699-1.29-1.699-1.054-.72.08-.706.08-.706 1.166.082 1.78 1.197 1.78 1.197 1.036 1.776 2.718 1.264 3.38.966.106-.75.405-1.264.737-1.555-2.577-.293-5.285-1.288-5.285-5.733 0-1.266.452-2.3 1.194-3.112-.12-.293-.518-1.472.114-3.068 0 0 .973-.312 3.187 1.189a11.1 11.1 0 012.907-.39c.985 0 1.977.133 2.907.39 2.213-1.501 3.184-1.189 3.184-1.189.633 1.596.235 2.775.115 3.068.744.812 1.192 1.846 1.192 3.112 0 4.457-2.712 5.437-5.298 5.724.416.359.788 1.07.788 2.158 0 1.558-.014 2.813-.014 3.195 0 .31.193.67.798.556C20.707 21.748 24 17.255 24 11.99 24 5.366 18.634 0 11.99 0z" />
              </svg>
              <span className="text-xs font-medium text-[var(--muted)]">
                Built on Stellar
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--text)] mb-4">
              Product
            </h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--text)] mb-4">
              Resources
            </h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} />
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-[var(--text)] mb-4">
              Company
            </h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <FooterLink {...link} />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-[var(--border)]">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-[var(--muted)]">
              © {currentYear} Quipay. Licensed under the{" "}
              <a
                href="https://opensource.org/license/mit"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--text)] transition-colors"
              >
                MIT License
              </a>
              .
            </p>

            <div className="flex items-center gap-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--muted)] hover:text-[var(--text)] transition-colors duration-200"
                  aria-label={social.label}
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
