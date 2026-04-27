export type PdfTableCell =
  | string
  | {
      content: string;
      colSpan?: number;
      styles?: {
        halign?: "left" | "center" | "right" | "justify";
        fontStyle?: "normal" | "bold" | "italic" | "bolditalic";
      };
    };
