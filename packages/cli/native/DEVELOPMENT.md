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

## Icon bundle revision 1.0.1

This is an explicit native resource revision: `CFBundleIconFile` now points to
`Contents/Resources/MineCodex.icns`, bundle version is `2`, and the outer app is
re-signed. The service host executable remains byte-for-byte unchanged. The
manager's ad-hoc designated requirement changes when its Info.plist changes.
The service identifier and launch-agent plist remain unchanged.

The existing `MacPlatformAdapter.installService()` is the migration path: run the
old installed manager's `unregister` before replacing its bundle; verify the new
staged bundle; replace it; then register and kickstart the new service. An old
registration failure aborts replacement. Use `mcx install` / the normal update
flow; do not copy a new icon or re-sign the installed app in place. System approval
may be required after re-registration; preserve macOS's decision and existing CLI
reporting. Real Background Items approval and UI upgrade acceptance must be checked
on a target installation before release.

The icon uses the filled project mark on a neutral rounded backing so one ICNS
remains legible in light and dark system surfaces. SVG artwork is generated at
`assets/brand/minecodex-service-icon.svg` by `npm run build:icons`. Rasterize that
SVG into an iconset at 16/32/128/256/512px and each size's @2x resolution, then run
`iconutil -c icns <iconset> -o app-template/Contents/Resources/MineCodex.icns`.
Commit the resulting template ICNS with any deliberate native artwork revision.
`npm run build:service` copies it into the built bundle before signing. Ordinary
JavaScript releases continue shipping the existing signed bundle unchanged.

Validation for this revision: strict deep signature verification, universal
architectures, ICNS structure and plist checks, system icon loading through
`NSWorkspace`, installer regressions, and npm package audit. These checks do not
register a background item or change an installed service.
