# Why Eval Driven Development

> The quality of agentic automation depends less on the ability to generate code and more on the ability to recognize correct code when it appears.

---

## The Evolution Analogy

Biological evolution solves an impossibly large design problem — producing organisms that survive in complex, changing environments — using two mechanisms:

1. **Random mutation** creates variation. Mutations do not aim for good designs. They produce a wide, undirected spread of candidates.
2. **Natural selection** retains what works. Organisms that fit their environment survive and reproduce; those that do not are removed.

The system works not because mutation produces the best designs. It works because the selection process is infallible. Natural selection never lets a fatally unfit organism persist. Over millions of iterations, that relentless filter — applied to an enormous volume of variation — produced every species on Earth, including humans.

The key insight: **the generator does not need to be intelligent. The selector does.**

---

## Agentic Automation Faces The Same Problem

Agents can generate code. LLMs produce plausible, syntactically correct, sometimes brilliant implementations at high speed and volume. The generation side of the problem is largely solved.

But generation without selection is random mutation without natural selection. An agent can produce the right code — and then iterate past it, because nothing in the system recognized it as correct.

Without a rigorous selection mechanism:

- Correct implementations get overwritten by subsequent iterations.
- Broken code that happens to look plausible survives.
- Quality is determined by the last thing the agent produced, not the best thing.
- The human becomes the sole filter, which does not scale.

The bottleneck in agentic automation is not generation. It is detection — the ability to know good code when it exists.

---

## Eval As Natural Selection

Eval Driven Development is the selection pressure for agentic code generation.

| Evolution | Agentic Automation |
|---|---|
| Random mutation produces variation. | An agent produces code candidates. |
| Natural selection filters for fitness. | Evals filter for correctness and quality. |
| Fitness is defined by the environment. | Quality is defined by user expectations. |
| Unfit organisms do not reproduce. | Code that fails evals does not ship. |
| The generator is blind. The selector is not. | The agent does not need to be perfect. The eval does. |

The same principle holds: **invest in the selector, not the generator.** A mediocre generator paired with an infallible selector will converge on correct code. A brilliant generator paired with a weak selector will drift.

---

## Implication

The practical consequence is that building better evals — defining user expectations precisely, capturing real product behavior, and detecting gaps automatically — is higher leverage than improving code generation.

EDD is the framework for building that selection layer. The detailed methodology is in [01-eval-driven-development.md](./01-eval-driven-development.md), and the Khonjel-specific interpretation is in [03-khonjel-edd-interpretation.md](./03-khonjel-edd-interpretation.md).
