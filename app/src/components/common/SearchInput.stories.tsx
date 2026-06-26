import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SearchInput } from "./SearchInput";

const meta: Meta<typeof SearchInput> = {
  title: "Common/SearchInput",
  component: SearchInput,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [query, setQuery] = useState("");
    return (
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search notes…"
        aria-label="Search notes"
      />
    );
  },
};

export const SmallWithClear: Story = {
  render: () => {
    const [query, setQuery] = useState("meeting");
    return (
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search…"
        aria-label="Search"
        size="sm"
      />
    );
  },
};
