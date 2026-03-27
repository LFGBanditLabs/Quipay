"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogPortal,
  DialogClose,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Modal — glassmorphic overlay wrapper around Dialog primitives
// ---------------------------------------------------------------------------

const Modal = Dialog;
const ModalTrigger = DialogTrigger;
const ModalClose = DialogClose;
const ModalHeader = DialogHeader;
const ModalFooter = DialogFooter;
const ModalTitle = DialogTitle;
const ModalDescription = DialogDescription;

function ModalContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  showCloseButton?: boolean;
}) {
  return (
    <DialogPortal>
      {/* Glassmorphic backdrop */}
      <DialogPrimitive.Backdrop className="fixed inset-0 isolate z-50 bg-black/60 backdrop-blur-md supports-backdrop-filter:backdrop-blur-md data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />

      {/* Glassmorphic panel */}
      <DialogPrimitive.Popup
        data-slot="modal-content"
        className={cn(
          // Layout
          "fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-2xl p-6 outline-none sm:max-w-md",
          // Glassmorphic surface
          "bg-white/10 backdrop-blur-xl dark:bg-slate-950/80",
          "border border-white/20 dark:border-white/10",
          "shadow-2xl shadow-black/30 dark:shadow-black/60",
          "text-sm text-foreground",
          // Animations
          "duration-200",
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
          "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          className,
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <DialogPrimitive.Close
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3 rounded-full opacity-70 hover:opacity-100 focus-visible:opacity-100"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

export {
  Modal,
  ModalTrigger,
  ModalClose,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalTitle,
  ModalDescription,
};
