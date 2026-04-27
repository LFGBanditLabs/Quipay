import { createContext } from "react";
import type { ThemeContextValue } from "./useTheme";

export const ThemeContext = createContext<ThemeContextValue | null>(null);
