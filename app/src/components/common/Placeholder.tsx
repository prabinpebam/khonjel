interface PlaceholderProps {
  title: string;
  description?: string;
}

/** Neutral stand-in for surfaces that arrive in a later phase. */
export function Placeholder({ title, description }: PlaceholderProps) {
  return (
    <section className="grid min-h-[60vh] place-items-center">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {description ?? "This surface is part of the Khonjel mock and arrives in a later phase."}
        </p>
      </div>
    </section>
  );
}
