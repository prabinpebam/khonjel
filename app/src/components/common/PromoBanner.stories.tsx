import type { Meta, StoryObj } from "@storybook/react-vite";
import { PromoBanner } from "./PromoBanner";

const meta = {
  title: "Common/PromoBanner",
  component: PromoBanner,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-full max-w-2xl">
        <Story />
      </div>
    ),
  ],
  args: {
    headline: "Teach Khonjel your words",
    supporting: "Add names, jargon, and snippets so transcripts come out right.",
    chips: ["Names", "Acronyms", "Snippets"],
  },
} satisfies Meta<typeof PromoBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Dismissible: Story = { args: { onDismiss: () => {} } };
