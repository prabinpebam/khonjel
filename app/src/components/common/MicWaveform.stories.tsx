import { useEffect, useRef } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MicWaveform } from "./MicWaveform";

const meta: Meta<typeof MicWaveform> = {
  title: "Common/MicWaveform",
  component: MicWaveform,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The shared live input-level animation used by every dictation surface. The recorder pushes a normalized 0..1 level into `levelRef`; a rAF loop scrolls a rolling history. Bar color comes from the element's text color.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Listening: Story = {
  render: () => {
    const levelRef = useRef(0.4);
    useEffect(() => {
      let raf = 0;
      const tick = () => {
        levelRef.current = 0.2 + Math.random() * 0.6;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, []);
    return (
      <div className="text-accent">
        <MicWaveform levelRef={levelRef} active />
      </div>
    );
  },
};
