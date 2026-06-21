import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { ConnectionAuthMode, ConnectionKind, ConnectionProfile } from "@services/ports";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select } from "@components/ui/select";
import { ProviderIcon } from "@components/brand/provider-icon";

const KINDS: ConnectionKind[] = [
  "openai",
  "openai-compatible",
  "azure-openai",
  "anthropic",
  "gemini",
  "groq",
  "deepgram",
  "xai",
  "bedrock",
  "vertex",
];

const AUTH_MODES: { value: ConnectionAuthMode; label: string }[] = [
  { value: "bearer-token", label: "Bearer token (Authorization)" },
  { value: "api-key-header", label: "API key header" },
  { value: "aad", label: "Entra ID / AAD" },
];

const EMPTY: ConnectionProfile = {
  id: "",
  kind: "openai",
  baseEndpoint: "",
  authMode: "bearer-token",
};

/** Provider connection profiles (cloud/self-hosted/Azure). Backed by the real ConnectionService. */
export function ConnectionsSettings() {
  const { connections, secrets } = useServices();
  const [list, setList] = useState<ConnectionProfile[]>([]);
  const [keyed, setKeyed] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<ConnectionProfile>(EMPTY);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void connections.list().then(async (l) => {
      if (!live) return;
      setList(l);
      const flags: Record<string, boolean> = {};
      await Promise.all(
        l.map(async (c) => {
          flags[c.id] = await secrets.has(c.id);
        }),
      );
      if (live) setKeyed(flags);
    });
    return () => {
      live = false;
    };
  }, [connections, secrets]);

  const isAzure = draft.kind === "azure-openai";

  async function save() {
    const id = draft.id.trim();
    const baseEndpoint = draft.baseEndpoint.trim();
    if (!id || !baseEndpoint) {
      setError("An id and base endpoint are required.");
      return;
    }
    setError(null);
    const profile: ConnectionProfile = {
      ...draft,
      id,
      baseEndpoint,
      headerName: draft.authMode === "api-key-header" ? draft.headerName?.trim() || "api-key" : undefined,
      apiVersion: isAzure ? draft.apiVersion?.trim() || undefined : undefined,
    };
    const next = await connections.upsert(profile);
    if (apiKey.trim()) {
      await secrets.set(id, apiKey.trim());
      setKeyed((k) => ({ ...k, [id]: true }));
    }
    setList(next);
    setDraft(EMPTY);
    setApiKey("");
  }

  async function remove(id: string) {
    setList(await connections.remove(id));
    setKeyed((k) => {
      const next = { ...k };
      delete next[id];
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Saved connections</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No provider connections yet. Add one below to use a cloud or self-hosted model. The API
            key is stored separately in your OS keychain.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((profile) => (
              <li
                key={profile.id}
                className="flex items-center gap-3 rounded-md border border-border bg-surface p-3"
              >
                <ProviderIcon provider={profile.kind} className="size-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{profile.id}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {profile.kind} · {profile.baseEndpoint}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-pill border px-2 py-0.5 text-xs ${
                    keyed[profile.id]
                      ? "border-border text-muted-foreground"
                      : "border-danger text-danger"
                  }`}
                >
                  {keyed[profile.id] ? "Key set" : "No key"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${profile.id}`}
                  onClick={() => void remove(profile.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Add a connection</h3>
        <div className="rounded-md border border-border bg-surface p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conn-id">Name</Label>
              <Input
                id="conn-id"
                value={draft.id}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                placeholder="my-openai"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Provider</Label>
              <Select
                className="w-full"
                aria-label="Provider"
                value={draft.kind}
                onValueChange={(v) => setDraft({ ...draft, kind: v as ConnectionKind })}
                options={KINDS.map((k) => ({ value: k, label: k, icon: <ProviderIcon provider={k} /> }))}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="conn-endpoint">Base endpoint</Label>
              <Input
                id="conn-endpoint"
                value={draft.baseEndpoint}
                onChange={(e) => setDraft({ ...draft, baseEndpoint: e.target.value })}
                placeholder={isAzure ? "https://<resource>.cognitiveservices.azure.com" : "https://api.openai.com"}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Authentication</Label>
              <Select
                className="w-full"
                aria-label="Authentication mode"
                value={draft.authMode}
                onValueChange={(v) => setDraft({ ...draft, authMode: v as ConnectionAuthMode })}
                options={AUTH_MODES}
              />
            </div>
            {draft.authMode === "api-key-header" ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="conn-header">Header name</Label>
                <Input
                  id="conn-header"
                  value={draft.headerName ?? ""}
                  onChange={(e) => setDraft({ ...draft, headerName: e.target.value })}
                  placeholder="api-key"
                />
              </div>
            ) : null}
            {isAzure ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="conn-apiversion">API version</Label>
                <Input
                  id="conn-apiversion"
                  value={draft.apiVersion ?? ""}
                  onChange={(e) => setDraft({ ...draft, apiVersion: e.target.value })}
                  placeholder="2024-10-21"
                />
              </div>
            ) : null}
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="conn-key">API key</Label>
              <Input
                id="conn-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Stored encrypted in your OS keychain (safeStorage); never shown again"
              />
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button className="mt-4" onClick={() => void save()}>
            <Plus /> Add connection
          </Button>
        </div>
      </section>
    </div>
  );
}
