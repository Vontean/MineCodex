# Stable MineCodex background host

`MineCodex.app` is the small, universal native owner of MineCodex's macOS
background item. The npm package ships the built app only; native source and the
build script remain development inputs.

The production app bundle is intentionally versioned independently from the npm
package. Its ad-hoc code identity must stay byte-for-byte stable across ordinary
JavaScript releases because macOS records the helper's designated requirement.
Do not rebuild or change the bundle for an npm version bump. If native behavior
must change, plan an explicit signed-helper migration or introduce a new service
identifier and verify the macOS Background Items upgrade path before release.

Rebuild deliberately with:

```bash
npm run build:service
```
