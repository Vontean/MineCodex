# Usage Meter · 额度环

在 Codex 原生 navbar 的 Help 与 Account 之间显示当前登录账号的**剩余额度**。

- 只有周额度：单圈，中心为周剩余百分比整数。
- 同时有周与五小时额度：外圈为周、内圈为五小时，中心显示五小时剩余数字。
- 悬浮或键盘聚焦显示 Tooltip；双圈时先显示 `5h Limit`，再显示 `Weekly Limit`，标签左对齐、百分比右对齐。
- 点击进入原生 Settings → Usage。

数据直接订阅当前账号的原生额度缓存，与 Usage 页同步。窗口类型按实际时长识别，
不通过套餐名称猜测。缺失数据、退出登录或切换账号时不展示旧额度。
不新增 API 请求，不持久化账号信息，不修改 Settings 分类导航。

MineCodex 管理页面可单独开关此功能。设计与原生接入契约见 [DESIGN.md](DESIGN.md)。

```bash
node --test features/usage-meter/test/*.test.mjs
```
