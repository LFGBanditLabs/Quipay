import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

export const useKeyboardShortcuts = () => {
  const navigate = useNavigate();
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);

  const toggleHelpModal = useCallback(() => {
    setIsHelpModalOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in an input field
      const activeElement = document.activeElement;
      const isInput =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement ||
        activeElement?.hasAttribute("contenteditable");

      if (isInput) return;

      const isModifier = event.ctrlKey || event.metaKey;

      if (!isModifier) return;

      switch (event.key.toLowerCase()) {
        case "n":
          event.preventDefault();
          void navigate("/create-stream");
          break;
        case "d":
          event.preventDefault();
          void navigate("/dashboard");
          break;
        case "w":
          event.preventDefault();
          void navigate("/withdraw");
          break;
        case ",":
          event.preventDefault();
          void navigate("/settings");
          break;
        case "/":
          event.preventDefault();
          toggleHelpModal();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [navigate, toggleHelpModal]);

  return { isHelpModalOpen, setIsHelpModalOpen, toggleHelpModal };
};
