import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
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
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const input = canvas.getByRole("textbox", { name: "Search notes" });
    await userEvent.type(input, "kickoff");
    await expect(input).toHaveValue("kickoff");
    await userEvent.click(canvas.getByRole("button", { name: "Clear search" }));
    await expect(input).toHaveValue("");
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
