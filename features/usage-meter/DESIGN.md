# Usage Meter

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

## 用户任务与范围

在原生导航栏 Avatar 上方查看当前账号剩余额度，点击直达 Settings → Usage。
仅向 `nav[data-app-navigation-rail="true"]` 注入一个控件，不注册通用侧栏
菜单项，不向 Settings 的分类列表插入内容。

## 数据契约

已在 2026-09-29 的运行中 Codex 确认：原生 QueryClient 的成功额度数据缓存键为
`["rate-limit-status"]`，由 Codex 自行更新。
插件只订阅该缓存，校验响应的 user_id/account_id 与当前原生 auth 一致，不自行请求
接口，不持久化账号或额度数据。切换账号、退出登录、额度数据缺失时隐藏旧值。

窗口按 `limit_window_seconds` 识别：604800 为周、18000 为五小时；不依赖
primary/secondary 顺序或套餐字符串。剩余百分比为 clamp(100-used_percent,0,100)，
四舍五入显示整数。缺失/非法值不当成零。

单周窗口显示一个周环和周剩余数字。周与五小时同时存在时，周在外、五小时在内，
中央显示五小时剩余数字，不带百分号。没有周窗口时不显示本控件。

## 视觉 tokens

| 角色 | 权威 token / 值 | 用途 |
| --- | --- | --- |
| 点击区域 | 克隆 Avatar 的原生按钮 class 和布局样式属性；目标 36×36px | 与导航项对齐 |
| 环图 | 24×24px；viewBox 32；圆心 16；周半径 43/3、五小时半径 10.5；描边 10/3 viewBox units（渲染 2.5px） | 自定义数据图，不是替代导航图标 |
| 周环 | `--color-text-tertiary`（原生中性灰） | 单圈或外圈 |
| 五小时环 | `--color-text-secondary`（中性灰） | 双圈内圈 |
| 轨道 | 对应环色 18% alpha | 剩余额度的底轨 |
| 中央数字 | 继承环的中性灰；`--font-sans-default`；`--text-xs` × 2/3（8px），单双圈与三位数均一致；500、tabular-nums、line-height:1 | 优先五小时 |

环从顶部顺时针填充。额度 Tooltip 的特殊内容是两列对齐，列间距16px；其通用材质和文字样式遵循根规范。Tooltip 在按钮右侧 2px，纵向居中并约束在窗口内；
鼠标悬停延迟 350ms，键盘聚焦立即显示，Escape 隐藏。单圈一行 Weekly Limit；
双圈依次为 5h Limit、Weekly Limit，数值带 %。没有额外标题或说明。

原生 Avatar 点击区域目标为 36px，头像可见直径为 24px；额度外环含描边的可见直径同为 24px，
数字与环均以按钮几何中心对齐；中性灰取自原生 navbar，不使用彩色强调。
注入点为头像整行在最近原生纵向容器中的前一项，复用该容器的 8px 间距；不向头像内部横向行插入按钮，不改动原生容器布局。
单双圈使用同一实现，双圈验收图采用模拟值，不更改账号缓存。减少动画偏好不添加进度过渡。

## 跳转与生命周期

已确认原生入口指向 `/settings/usage?tab=overview`。使用当前 React Router
的 navigate，并保留当前路由 state；不模拟设置菜单内部点击。
移除功能时清除缓存订阅、DOM observer、事件、Tooltip 与按钮。
