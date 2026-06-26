import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Select } from "./select";

const meta: Meta<typeof Select> = {
  title: "UI/Select",
  component: Select,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-64">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

const OPTIONS = [
  { value: "openai", label: "OpenAI" },
  { value: "azure", label: "Azure OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("openai");
    return <Select value={value} onValueChange={setValue} options={OPTIONS} aria-label="Provider" />;
  },
};

export const WithPlaceholder: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <Select
        value={value}
        onValueChange={setValue}
        options={OPTIONS}
        placeholder="Choose a provider…"
        aria-label="Provider"
      />
    );
  },
};
