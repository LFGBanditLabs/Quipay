import React from "react";
import { useTranslation } from "react-i18next";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
} from "@/components/ui/Modal";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  const shortcutGroups = [
    {
      title: t("shortcuts.navigation_group") || "Navigation",
      shortcuts: [
        {
          key: "Ctrl + D",
          label: t("shortcuts.dashboard") || "Go to Dashboard",
        },
        { key: "Ctrl + N", label: t("shortcuts.new_stream") || "New Stream" },
        { key: "Ctrl + W", label: t("shortcuts.withdraw") || "Withdraw" },
        { key: "Ctrl + ,", label: t("shortcuts.settings") || "Settings" },
      ],
    },
    {
      title: t("shortcuts.general_group") || "General",
      shortcuts: [
        {
          key: "Ctrl + /",
          label: t("shortcuts.show_help") || "Show shortcuts",
        },
        { key: "Esc", label: t("common.close") || "Close" },
      ],
    },
  ];

  return (
    <Modal open={isOpen} onOpenChange={onClose}>
      <ModalContent className="sm:max-w-md">
        <ModalHeader>
          <ModalTitle className="bg-gradient-to-r from-indigo-400 to-pink-400 bg-clip-text text-2xl font-bold text-transparent">
            {t("shortcuts.title") || "Keyboard Shortcuts"}
          </ModalTitle>
          <ModalDescription>
            {t("shortcuts.description") || "Efficiency at your fingertips."}
          </ModalDescription>
        </ModalHeader>

        <div className="mt-4 space-y-6">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-3 text-xs font-semibold tracking-wider text-[var(--muted)] uppercase">
                {group.title}
              </h3>
              <div className="space-y-3">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm text-[var(--text)]">
                      {shortcut.label}
                    </span>
                    <kbd className="inline-flex min-w-[2.5rem] items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-subtle)] px-2 py-1 text-[10px] font-medium text-[var(--muted)] shadow-sm">
                      {shortcut.key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ModalContent>
    </Modal>
  );
};

export default KeyboardShortcutsModal;
