# Usage Meter · 额度环

在 Codex 原生 navbar 的 Avatar 上方显示当前登录账号的**剩余额度**。
额度按钮与头像整行同属原生纵向容器，沿用其间距与居中对齐；不挤入头像内部横向行。

环图的单窗口 / 双扇区选择与提示内容统一见 [DESIGN.md](DESIGN.md)。
点击进入原生 Settings → Usage。

数据直接订阅当前账号的原生额度缓存，与 Usage 页同步。窗口类型按实际时长识别，
不通过套餐名称猜测。缺失数据、退出登录或切换账号时不展示旧额度。
不新增 API 请求，不持久化账号信息，不修改 Settings 分类导航。

MineCodex 管理页面可单独开关此功能。设计与原生接入契约见 [DESIGN.md](DESIGN.md)。

```bash
node --test features/usage-meter/test/*.test.mjs
```
