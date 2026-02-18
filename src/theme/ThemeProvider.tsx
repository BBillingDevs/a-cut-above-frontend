import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
} from "react";
import { ConfigProvider, theme } from "antd";

type ThemeMode = "light" | "dark";
type ThemeCtx = {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside ThemeProvider");
  return ctx;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("aca_theme_mode");
    return saved === "dark" || saved === "light"
      ? (saved as ThemeMode)
      : "light";
  });

  useEffect(() => {
    localStorage.setItem("aca_theme_mode", mode);
    document.documentElement.setAttribute("data-theme", mode);
  }, [mode]);

  const { defaultAlgorithm, darkAlgorithm } = theme;

  const antdTheme = useMemo(() => {
    const isDark = mode === "dark";

    return {
      algorithm: isDark ? darkAlgorithm : defaultAlgorithm,
      token: {
        // Your palette
        colorPrimary: "#274f2c", // deep forest
        colorInfo: "#274f2c",
        colorSuccess: "#729542", // fresh green
        colorWarning: "#dda737", // gold
        colorError: "#b42318",

        // Make it feel “premium”
        borderRadius: 14,
        fontFamily: `"Inter", system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif`,
      },
      components: {
        Layout: {
          headerBg: isDark ? "rgba(18,20,18,0.88)" : "rgba(253,251,247,0.88)",
          bodyBg: isDark ? "#121412" : "#FDFBF7",
        },
        Card: {
          borderRadiusLG: 18,
        },
        Button: {
          borderRadius: 12,
        },
        Input: {
          borderRadiusLG: 999,
        },
        Menu: {
          darkItemBg: "transparent",
          darkItemSelectedBg: "rgba(221,167,55,0.18)",
          darkItemSelectedColor: "#f7dba0",
        },
      },
    };
  }, [mode, defaultAlgorithm, darkAlgorithm]);

  const ctxValue = useMemo(
    () => ({
      mode,
      setMode,
      toggle: () => setMode((m) => (m === "light" ? "dark" : "light")),
    }),
    [mode],
  );

  return (
    <ThemeContext.Provider value={ctxValue}>
      <ConfigProvider theme={antdTheme}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}
