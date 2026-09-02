# Product

## Register

product

## Users

Codex desktop users who route work through OpenCodex and routinely switch between OpenAI and third-party models. They need to compare many model/provider combinations without leaving the Composer flow.

## Product Purpose

Enhance Codex's native model picker with provider-aware model identity, favorites, and a compact scrollable list while preserving Codex's real model, reasoning-effort, Fast-mode, warning, and keyboard state. Success means the enhanced picker feels native and makes a large routed catalog faster to scan and operate.

## Brand Personality

Native, restrained, precise.

## Anti-references

Do not create a separate dashboard, iframe, branded control system, decorative AI surface, or a visually louder replacement for Codex. Do not fake model state or bypass native warnings.

## Design Principles

- Preserve native behavior before enhancing presentation.
- Preserve Codex's native Slider shell and width; shorten routed model labels to their final path segment before native truncation.
- Keep provider identity visible without increasing Composer noise.
- Add complexity only when catalog size requires it.
- Fail closed to the unmodified native picker when private DOM changes.
- Keep all Codex-version-sensitive adaptation inside CodexRuntimeHost.

## Accessibility & Inclusion

Retain native menu roles, slider keyboard support, visible focus, and Fast-mode semantics. New controls provide English and Simplified Chinese labels, remain operable by keyboard, respect reduced motion, and never rely on color alone.
