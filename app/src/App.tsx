import { useEffect } from "react";
import { ThemeProvider } from "@app/providers/ThemeProvider";
import { ServicesProvider } from "@app/providers/ServicesProvider";
import { AppRouter } from "@app/router/AppRouter";
import { EvalBridge } from "@app/devtools/EvalBridge";
import { SettingsSync } from "@app/devtools/SettingsSync";
import { GlobalDictation } from "@app/system/GlobalDictation";
import { FloatingBar } from "@surfaces/floating-bar/FloatingBar";
import { dismissSplash } from "@app/splash";

export function App() {
  // Fade the launch splash out once the React shell has mounted (it honors a min on-screen time).
  useEffect(() => {
    dismissSplash();
  }, []);

  const underElectron = typeof window !== "undefined" && Boolean(window.khonjel);
  const surface =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("surface")
      : null;

  // The floating dictation bar runs in its own always-on-top window (?surface=floating-bar). It
  // needs settings (mic/cleanup) but not the control-panel chrome, dev tools, or the global hotkey
  // controller (the bar owns dictation itself).
  if (surface === "floating-bar") {
    return (
      <ThemeProvider>
        <ServicesProvider>
          {underElectron ? <SettingsSync /> : null}
          <FloatingBar />
        </ServicesProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ServicesProvider>
        <AppRouter />
        {import.meta.env.DEV ? <EvalBridge /> : null}
        {underElectron ? <SettingsSync /> : null}
        {underElectron ? <GlobalDictation /> : null}
      </ServicesProvider>
    </ThemeProvider>
  );
}
