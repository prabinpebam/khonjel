import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { useServices } from "@services";
import type { ConnectionAuthMode, ConnectionKind, ConnectionProfile } from "@services/ports";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select } from "@components/ui/select";
import { ProviderIcon } from "@components/brand/provider-icon";
import { cn } from "@lib/utils";

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
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const editing = editingId !== null;
  const isAzure = draft.kind === "azure-openai";
  const hasKey = editing && keyed[editingId] === true;

  /** Reset the editor back to "add a new connection". */
  function startNew() {
    setEditingId(null);
    setDraft(EMPTY);
    setApiKey("");
    setError(null);
  }

  /** Load an existing connection into the editor. The saved API key is never loaded (write-only). */
  function startEdit(profile: ConnectionProfile) {
    setEditingId(profile.id);
    setDraft({ ...profile });
    setApiKey("");
    setError(null);
  }

  async function save() {
    const id = (editingId ?? draft.id).trim();
    const baseEndpoint = draft.baseEndpoint.trim();
    if (!id || !baseEndpoint) {
      setError("A name and base endpoint are required.");
      return;
    }
    setError(null);
    const profile: ConnectionProfile = {
      ...draft,
      id,
      baseEndpoint,
      model: draft.model?.trim() || undefined,
      headerName: draft.authMode === "api-key-header" ? draft.headerName?.trim() || "api-key" : undefined,
      apiVersion: isAzure ? draft.apiVersion?.trim() || undefined : undefined,
    };
    const next = await connections.upsert(profile);
    // The key is write-only: store it only when a new value is entered; blank keeps the existing key.
    if (apiKey.trim()) {
      await secrets.set(id, apiKey.trim());
      setKeyed((k) => ({ ...k, [id]: true }));
    }
    setList(next);
    startNew();
  }

  async function remove(id: string) {
    setList(await connections.remove(id));
    setKeyed((k) => {
      const next = { ...k };
      delete next[id];
      return next;
    });
    if (editingId === id) startNew();
  }

  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-1 text-sm font-semibold text-foreground">Saved connections</h3>
        <p className="mb-3 text-xs text-tertiary-foreground">
          Select a connection to edit it. API keys are stored in your OS keychain and can never be
          viewed or copied.
        </p>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No provider connections yet. Add one below to use a cloud or self-hosted model. The API
            key is stored separately in your OS keychain.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((profile) => {
              const active = editingId === profile.id;
              return (
                <li
                  key={profile.id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-3 transition-colors",
                    active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => startEdit(profile)}
                    aria-label={`Edit ${profile.id}`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <ProviderIcon provider={profile.kind} className="size-5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{profile.id}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {profile.kind}
                        {profile.model ? ` · ${profile.model}` : ""} · {profile.baseEndpoint}
                      </p>
                    </div>
                  </button>
                  <Badge variant={keyed[profile.id] ? "neutral" : "danger"}>
                    {keyed[profile.id] ? "Key set" : "No key"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${profile.id}`}
                    className="text-muted-foreground hover:text-danger"
                    onClick={() => void remove(profile.id)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {editing ? `Edit "${editingId}"` : "Add a connection"}
          </h3>
          {editing ? (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={startNew}>
                <Plus /> New connection
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close editor"
                title="Close"
                onClick={startNew}
              >
                <X />
              </Button>
            </div>
          ) : null}
        </div>
        <Card className="p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="conn-id">Name</Label>
              <Input
                id="conn-id"
                value={draft.id}
                disabled={editing}
                onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                placeholder="my-openai"
              />
              {editing ? (
                <p className="text-xs text-tertiary-foreground">
                  The name identifies this connection and can't be changed.
                </p>
              ) : null}
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
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="conn-model">Model / deployment</Label>
              <Input
                id="conn-model"
                value={draft.model ?? ""}
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                placeholder={isAzure ? "exact Azure deployment name (e.g. gpt-4o)" : "model id (e.g. gpt-4o-mini)"}
              />
              <p className="text-xs text-muted-foreground">
                {isAzure
                  ? "Use the exact Deployment name from the Azure portal (Resource -> Deployments), not the model family name."
                  : "The model id the provider expects. A slot can override this."}
              </p>
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
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  hasKey
                    ? "A key is saved \u2014 type a new one to replace it"
                    : "Stored encrypted in your OS keychain (safeStorage); never shown again"
                }
              />
              <p className="text-xs text-tertiary-foreground">
                {hasKey
                  ? "Your saved key is encrypted in the OS keychain \u2014 it can't be viewed or copied. Leave blank to keep it."
                  : "Stored encrypted in your OS keychain; never shown again."}
              </p>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
          <Button className="mt-4" onClick={() => void save()}>
            {editing ? (
              "Save changes"
            ) : (
              <>
                <Plus /> Add connection
              </>
            )}
          </Button>
        </Card>
      </section>
    </div>
  );
}
