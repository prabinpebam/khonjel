import { Mic } from "lucide-react";
import { Button } from "@components/ui/button";

/** Home placeholder — proves tokens, type families, and the Button primitive. */
export function Home() {
  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">Welcome back</p>
        <h1 className="font-serif text-2xl font-semibold text-foreground">Good to see you.</h1>
      </header>

      <div className="grid place-items-center rounded-lg border border-border bg-surface-2 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-pill bg-accent-soft text-accent">
          <Mic className="size-6" />
        </span>
        <h2 className="mt-4 text-base font-semibold text-foreground">Press to dictate anywhere</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Your voice is transcribed and cleaned up entirely on device. Nothing leaves your machine.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <Button variant="primary">Start dictation</Button>
          <Button variant="secondary">Import audio</Button>
        </div>
      </div>
    </section>
  );
}
