import { ThemeProvider } from "@app/providers/ThemeProvider";
import { ServicesProvider } from "@app/providers/ServicesProvider";
import { AppRouter } from "@app/router/AppRouter";
import { MockStudio } from "@app/devtools/MockStudio";
import { EvalBridge } from "@app/devtools/EvalBridge";
import { SettingsSync } from "@app/devtools/SettingsSync";
import { GlobalDictation } from "@app/system/GlobalDictation";

export function App() {
  const underElectron = typeof window !== "undefined" && Boolean(window.khonjel);
  return (
    <ThemeProvider>
      <ServicesProvider>
        <AppRouter />
        {import.meta.env.DEV ? <MockStudio /> : null}
        {import.meta.env.DEV ? <EvalBridge /> : null}
        {underElectron ? <SettingsSync /> : null}
        {underElectron ? <GlobalDictation /> : null}
      </ServicesProvider>
    </ThemeProvider>
  );
}
