import type { ReactNode } from "react";
import { useSettingsStore } from "@stores/settings";
import { SettingRow } from "@components/common/SettingRow";
import { Select } from "@components/ui/select";
import { Switch } from "@components/ui/switch";

/** A setting row whose control is a boolean toggle bound to the settings store. */
export function ToggleRow({
  title,
  subtitle,
  settingKey,
  badge,
}: {
  title: string;
  subtitle?: string;
  settingKey: string;
  badge?: ReactNode;
}) {
  const checked = useSettingsStore((s) => s.toggles[settingKey] ?? false);
  const setToggle = useSettingsStore((s) => s.setToggle);
  return (
    <SettingRow
      title={title}
      subtitle={subtitle}
      badge={badge}
      control={
        <Switch label={title} checked={checked} onCheckedChange={(v) => setToggle(settingKey, v)} />
      }
    />
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** A setting row whose control is a select bound to the settings store. */
export function SelectRow({
  title,
  subtitle,
  settingKey,
  options,
}: {
  title: string;
  subtitle?: string;
  settingKey: string;
  options: SelectOption[];
}) {
  const value = useSettingsStore((s) => s.values[settingKey] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  return (
    <SettingRow
      title={title}
      subtitle={subtitle}
      control={
        <Select value={value} onChange={(e) => setValue(settingKey, e.target.value)}>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      }
    />
  );
}
