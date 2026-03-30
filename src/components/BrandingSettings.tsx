import { useState, useCallback, useRef, ChangeEvent } from "react";
import { useWallet } from "../hooks/useWallet";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BrandingSettingsProps {
  /** Employer wallet address */
  employerAddress: string;
  /** Optional callback fired after successful save */
  onSave?: () => void;
}

interface BrandingData {
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
}

type SaveStatus = "idle" | "loading" | "success" | "error";

// ─── Component ────────────────────────────────────────────────────────────────

export default function BrandingSettings({
  employerAddress,
  onSave,
}: BrandingSettingsProps) {
  const { address } = useWallet();
  const [branding, setBranding] = useState<BrandingData>({
    primaryColor: "#2563eb",
    secondaryColor: "#64748b",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch existing branding on mount
  const fetchBranding = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiBase = import.meta.env?.VITE_API_BASE_URL || "";
      const response = await fetch(
        `${apiBase}/api/employers/${employerAddress}/branding`,
        {
          credentials: "include",
        },
      );

      if (response.ok) {
        const data = await response.json();
        setBranding({
          logoUrl: data.logoUrl,
          primaryColor: data.primaryColor || "#2563eb",
          secondaryColor: data.secondaryColor || "#64748b",
        });
        if (data.logoUrl) {
          setLogoPreview(data.logoUrl);
        }
      }
    } catch (err) {
      console.error("Failed to fetch branding:", err);
    } finally {
      setIsLoading(false);
    }
  }, [employerAddress]);

  // Load branding on mount
  useState(() => {
    void fetchBranding();
  });

  const handleLogoSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      setErrorMsg("Please select a PNG, JPG, or SVG file");
      return;
    }

    // Validate file size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg("File size must be under 2MB");
      return;
    }

    setLogoFile(file);
    setErrorMsg("");

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleColorChange = (
    field: "primaryColor" | "secondaryColor",
    value: string,
  ) => {
    // Validate hex color format
    if (!/^#[0-9A-Fa-f]{6}$/.test(value) && value !== "") {
      return;
    }
    setBranding((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaveStatus("loading");
    setErrorMsg("");

    try {
      const apiBase = import.meta.env?.VITE_API_BASE_URL || "";

      // Upload logo if changed
      if (logoFile) {
        const formData = new FormData();
        formData.append("logo", logoFile);

        const logoResponse = await fetch(
          `${apiBase}/api/employers/${employerAddress}/branding/logo`,
          {
            method: "POST",
            body: formData,
            credentials: "include",
          },
        );

        if (!logoResponse.ok) {
          throw new Error("Failed to upload logo");
        }
      }

      // Update colors
      const colorsResponse = await fetch(
        `${apiBase}/api/employers/${employerAddress}/branding/colors`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            primaryColor: branding.primaryColor,
            secondaryColor: branding.secondaryColor,
          }),
          credentials: "include",
        },
      );

      if (!colorsResponse.ok) {
        throw new Error("Failed to update colors");
      }

      setSaveStatus("success");
      onSave?.();

      // Reset after 2 seconds
      setTimeout(() => {
        setSaveStatus("idle");
        setLogoFile(null);
      }, 2000);
    } catch (err: unknown) {
      console.error("Failed to save branding:", err);
      const message = err instanceof Error ? err.message : "Save failed";
      setErrorMsg(message);
      setSaveStatus("error");

      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    }
  };

  const handleDeleteLogo = async () => {
    try {
      const apiBase = import.meta.env?.VITE_API_BASE_URL || "";
      const response = await fetch(
        `${apiBase}/api/employers/${employerAddress}/branding/logo`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (response.ok) {
        setLogoPreview(null);
        setLogoFile(null);
        setBranding((prev) => ({ ...prev, logoUrl: undefined }));
      }
    } catch (err) {
      console.error("Failed to delete logo:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-[var(--muted)]">Loading branding settings...</div>
      </div>
    );
  }

  // Check if user is the employer
  if (address !== employerAddress) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-500">
        You can only manage branding for your own employer account.
      </div>
    );
  }

  return (
    <>
      <style>{`
        .bs-container {
          max-width: 800px;
        }
        .bs-section {
          margin-bottom: 32px;
        }
        .bs-section-title {
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 12px;
          color: var(--text);
        }
        .bs-section-desc {
          font-size: 14px;
          color: var(--muted);
          margin-bottom: 16px;
        }
        .bs-logo-preview {
          width: 200px;
          height: 120px;
          border: 2px dashed var(--border);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: var(--surface);
          margin-bottom: 12px;
        }
        .bs-logo-preview img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
        .bs-logo-placeholder {
          color: var(--muted);
          font-size: 14px;
        }
        .bs-btn {
          padding: 10px 18px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: opacity 0.2s, transform 0.15s;
          border: none;
        }
        .bs-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .bs-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .bs-btn-primary {
          background: var(--accent);
          color: white;
        }
        .bs-btn-secondary {
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border);
        }
        .bs-btn-danger {
          background: rgba(239, 68, 68, 0.15);
          color: #ef4444;
        }
        .bs-color-input-group {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }
        .bs-color-input {
          flex: 1;
        }
        .bs-color-input label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
          margin-bottom: 6px;
        }
        .bs-color-input input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--surface);
          color: var(--text);
          font-family: 'DM Mono', monospace;
          font-size: 14px;
        }
        .bs-color-preview {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          border: 1px solid var(--border);
          margin-top: 24px;
        }
        .bs-error {
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          font-size: 13px;
        }
        .bs-success {
          margin-top: 12px;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          font-size: 13px;
        }
      `}</style>

      <div className="bs-container">
        {/* Logo Section */}
        <div className="bs-section">
          <h3 className="bs-section-title">Company Logo</h3>
          <p className="bs-section-desc">
            Upload your company logo to appear on worker payslips. Supported
            formats: PNG, JPG, SVG (max 2MB)
          </p>

          <div className="bs-logo-preview">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" />
            ) : (
              <div className="bs-logo-placeholder">No logo uploaded</div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml"
            onChange={handleLogoSelect}
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              className="bs-btn bs-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
            >
              {logoPreview ? "Change Logo" : "Upload Logo"}
            </button>
            {logoPreview && (
              <button
                className="bs-btn bs-btn-danger"
                onClick={() => void handleDeleteLogo()}
              >
                Remove Logo
              </button>
            )}
          </div>
        </div>

        {/* Colors Section */}
        <div className="bs-section">
          <h3 className="bs-section-title">Brand Colors</h3>
          <p className="bs-section-desc">
            Customize the color scheme for your payslips. Use hex color codes
            (e.g., #2563eb)
          </p>

          <div className="bs-color-input-group">
            <div className="bs-color-input">
              <label htmlFor="primaryColor">Primary Color</label>
              <input
                id="primaryColor"
                type="text"
                value={branding.primaryColor}
                onChange={(e) =>
                  handleColorChange("primaryColor", e.target.value)
                }
                placeholder="#2563eb"
                maxLength={7}
              />
            </div>
            <div
              className="bs-color-preview"
              style={{ backgroundColor: branding.primaryColor }}
            />
          </div>

          <div className="bs-color-input-group">
            <div className="bs-color-input">
              <label htmlFor="secondaryColor">Secondary Color</label>
              <input
                id="secondaryColor"
                type="text"
                value={branding.secondaryColor}
                onChange={(e) =>
                  handleColorChange("secondaryColor", e.target.value)
                }
                placeholder="#64748b"
                maxLength={7}
              />
            </div>
            <div
              className="bs-color-preview"
              style={{ backgroundColor: branding.secondaryColor }}
            />
          </div>
        </div>

        {/* Save Button */}
        <button
          className={`bs-btn ${
            saveStatus === "success" ? "bs-btn-success" : "bs-btn-primary"
          }`}
          onClick={() => void handleSave()}
          disabled={saveStatus === "loading"}
        >
          {saveStatus === "loading"
            ? "Saving..."
            : saveStatus === "success"
              ? "Saved!"
              : "Save Branding"}
        </button>

        {errorMsg && <div className="bs-error">{errorMsg}</div>}
        {saveStatus === "success" && (
          <div className="bs-success">
            Branding settings saved successfully!
          </div>
        )}
      </div>
    </>
  );
}
