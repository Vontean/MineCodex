# Source migration baseline

MineCodex was initialized from the following verified local repositories on 2026-08-11:

| MineCodex module | Source repository | Source commit |
| --- | --- | --- |
| `packages/runtime-host` | `CodexRuntimeHost` | `2ca081af288ad1c3e5b2eba1828eaa69f5f9b73c` plus the verified Runtime 99 working-tree integration |
| `features/model-slider` | `CodexModelSlider` | `665d1524d036dc21fb3c77ae09dec1441100b855` |
| `features/notes` | `CodexNotes` | `9a0069220ced77040cbba299a79aa62bc2a6f574` |
| `features/images` | `CodexImageHost` | `eee04c1a389b900e3b5d2587a68b041a61e3562d` |

The RuntimeHost working-tree snapshot includes the completed Model Slider animation and
catalog timing work verified in the isolated profile at CDP port 9233. The source repositories
were not changed during migration. MineCodex is the canonical source after this import.
