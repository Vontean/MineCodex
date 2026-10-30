# Usage Meter

通用视觉、材质、按钮、Tooltip 与原生 sidebar 层级遵循根 [DESIGN.md](../../DESIGN.md)。本文件只记录功能特有组件、布局、数据语义与通用组件选型。

## 用户任务与范围

在原生导航栏 Usage 位置查看当前账号剩余额度，点击直达 Settings → Usage。
仅向 `nav[data-app-navigation-rail="true"]` 注入一个控件，不注册通用侧栏
菜单项，不向 Settings 的分类列表插入内容。

## 数据契约

原生 QueryClient 的额度查询族前缀为 `["rate-limit-status"]`，由 Codex 自行更新。
Codex `26.1027.30824`（macOS build `22943`）的实际 Renderer 已确认查询键为
`["rate-limit-status", userId, accountId]`；旧版使用无后缀键。精确读取旧键会漏掉新版缓存。
Adapter 按查询族发现候选，校验响应的 user_id/account_id 与当前原生 auth 一致，
在匹配身份的已有数据中选择 dataUpdatedAt 最新的一项；不依赖后缀数量、位置或内容，
不把其他账号或尚无数据的候选作为当前额度。订阅同一查询族的变化，不自行请求接口，
不持久化账号或额度数据。切换账号、退出登录、额度数据缺失时隐藏旧值。
自检分别记录缓存待加载、当前身份无匹配额度、窗口数据契约不可用与锚点/导航不可用，
避免把所有失效原因归为“额度或锚点缺失”。

该构建已完成只读故障复现及独立 profile 的完整注入检查：MCX 控件挂载、原生入口隐藏、
原生额度与主题 token 可用；电脑控制工具拒绝访问 Codex App，未完成可见 GUI 与鼠标验收。

窗口按 `limit_window_seconds` 识别：604800 为周、18000 为五小时；不依赖
primary/secondary 顺序或套餐字符串。剩余百分比为 clamp(100-used_percent,0,100)，
四舍五入显示整数。缺失/非法值不当成零。
刷新时间优先使用窗口 `reset_at`（Unix 秒），否则以 QueryClient 的 `dataUpdatedAt`
（毫秒）加 `reset_after_seconds` 转成固定时间点。缺失或非法时间不显示刷新行；
相对值缺少缓存更新时间时不猜测时间，也不在每次读取时顺延。

单周窗口显示一个周环和周剩余数字。周与五小时同时存在时，在同一半径上分成两段：
上方 3/4 扇区表示五小时，下方 1/4 扇区表示总额度（当前为周额度）。中央显示五小时
剩余数字，不带百分号。没有周窗口时不显示本控件。不按套餐字符串判断视觉分支。

## 视觉 tokens

| 角色 | 权威 token / 值 | 用途 |
| --- | --- | --- |
| 点击区域 | 克隆 Usage（旧版回退 Avatar）的原生按钮 class 和布局样式属性；目标 36×36px | 与导航项对齐 |
| 环图 | 24×24px；viewBox 32；圆心 16；统一半径 44/3；描边 2px，使用 non-scaling-stroke | 自定义数据图，不是替代导航图标 |
| 进度环 | `--color-usage-meter-fill`，由共享 UI 映射为 `--mcx-color-usage-meter-fill`，旧版回退文字三级色 | 单圈及双扇区统一颜色；额度类型由扇区位置与 Tooltip 区分，保持 Plus 与 Pro 视觉一致 |
| 轨道 | `--color-usage-meter-track`，由共享 UI 映射为 `--mcx-color-usage-meter-track`；旧版回退对应环色 18% alpha | 剩余额度的底轨 |
| 中央数字 | 与可用额度进度环使用相同的 `--mcx-color-usage-meter-fill`（旧版同样回退文字三级色）；`--font-sans-default`；`--text-xs` × 2/3，单双圈与三位数均一致；500、tabular-nums、line-height:1 | 优先五小时 |

单周环保留从顶部顺时针填充。双段环的扇区分界位于左下与右下（以顶部为 0°，
顺时针角度为 225° 与 135°）；每个分界两侧各退让 12°，所有末端用圆头。
圆头中心间距为 24°，在 24px 实际尺寸下净空约 2.6px，满额与耗尽时底轨也保留切口。
3/4 与 1/4 表示扇区占比，切口从扇区两端等量扣除。五小时路径从 237° 到 483°，
周路径从 213° 逆时针到 147°。额度扣减时，两段都从左下切口开始露出底轨，
上段经左侧、顶部向右侧扣减，下段经底部向右侧扣减。0% 只显示底轨，不保留进度圆点。

额度 Tooltip 的特殊内容是两列对齐，列间距16px；其通用材质和文字样式遵循根规范。Tooltip 在按钮右侧 2px，纵向居中并约束在窗口内；
鼠标悬停延迟 350ms，键盘聚焦立即显示，Escape 隐藏。单圈一组 Weekly Limit；
双段依次为 5h Limit、Weekly Limit，数值带 %。各组在额度行下面显示两列
`Reset in` 与本地刷新时间（`MM/DD HH:mm`，24 小时制，精确到分），沿用相同文字 token；
每次打开提示重新按系统本地时区格式化。双组之间使用 `--mcx-color-border-subtle`
的 50% alpha 分割线，线两侧各留一个 `--mcx-spacing`；仅 Weekly 时没有分割线。
没有额外标题或说明。

原生 Avatar 点击区域目标为 36px，头像可见直径为 24px；额度外环含描边的可见直径同为 24px，
数字与环均以按钮几何中心对齐；中性灰取自原生 navbar，不使用彩色强调。
优先在原生 Usage 按钮前挂载替代按钮，并通过专有标记隐藏原生按钮；不删除或修改其 React 子树。原生重建时重新接管，关闭、卸载或额度数据不可用时移除标记，立即恢复原生入口。旧版缺少 Usage 时才使用头像整行前一项，复用原生纵向容器间距。

原生依据：Codex `26.1021.31345` 的实际 Renderer DOM、计算样式与样式表；Usage 使用 36px 热区、1.75px non-scaling-stroke，以及独立的 fill / track token。本功能按用户选择采用 2px 描边，保留自己的 24px 数据图、中央数字和分段语义；不复制原生额度菜单。
单双圈使用同一实现；需模拟边界值时仅替换测试输入，不更改账号缓存。减少动画偏好不添加进度过渡。

## 跳转与生命周期

本功能点击后导航至 `/settings/usage?tab=overview`。使用当前 React Router
的 navigate，并保留当前路由 state；不模拟设置菜单内部点击。
移除功能时清除缓存订阅、DOM observer、事件、Tooltip 与按钮。
