import { ThemeProvider } from "@app/providers/ThemeProvider";
import { ServicesProvider } from "@app/providers/ServicesProvider";
import { AppRouter } from "@app/router/AppRouter";
import { MockStudio } from "@app/devtools/MockStudio";

export function App() {
  return (
    <ThemeProvider>
      <ServicesProvider>
        <AppRouter />
        {import.meta.env.DEV ? <MockStudio /> : null}
      </ServicesProvider>
    </ThemeProvider>
  );
}
