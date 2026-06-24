# Archive — point-in-time records

Completed and dated documents kept for history. These reflect a **moment in time**; for current
truth, use the living spec in [`../product-spec/`](../product-spec/) and the policies in
[`../security/`](../security/).

```
archive/
├── audits/                              Dated security & privacy audits + the original hardening plan
│   ├── independent-security-privacy-audit-2026-06-23.md
│   ├── security-privacy-audit.md
│   └── security-privacy-hardening-plan.md
├── delivery-plans/                      Completed build plans (implemented behind the seam)
│   ├── backend/                         Backend architecture + benchmarks + 14-step implementation plan
│   ├── gpu-acceleration/                GPU detect / provision / runtime / UX spec + phased plan
│   └── parakeet-integration-plan.md     NVIDIA Parakeet (sherpa-onnx) integration
├── reference-analysis/                  Screen-by-screen analysis of the source apps (OpenWhispr + reference)
└── frontend-wiring-fixes.md             One-time frontend wiring audit + fix tracker
```

> **Note:** some cross-links inside these archived docs still point at their original locations in
> the live spec and may be stale. That is expected for historical material.
