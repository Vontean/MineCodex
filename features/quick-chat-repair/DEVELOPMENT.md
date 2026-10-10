# Quick Chat 退出修复

独立默认启用的 page-script，不依赖 Quick Chat 增强开关。没有业务数据、页面或附加控件。

Codex 26.1002.52244 / build 13536 的 Motion AnimatePresence 在 `propagate=true`
且没有渲染子元素时，缺少向父层报告退出完成的分支。关闭 Quick Chat（Esc 即可）后，
原生透明全屏层仍拦截主页面点击；与是否截图或是否启用 MCX 无关。
Motion 上游已有对应空容器分支：
https://github.com/motiondivision/motion/blob/main/packages/framer-motion/src/components/AnimatePresence/index.tsx

所属 Adapter 在原生 Quick Chat 全屏层内查找当前 React Fiber 的空 AnimatePresence，
核对 propagate、父层退出 context、usePresence 回调依赖及仍为 false 的注册条目，
调用该容器自己的 safeToRemove。正常父层动画与非空子元素继续由原生管理。
不删除 React 节点，不改 pointer-events，不调用最外层关闭回调，不重载页面或改安装文件。

MutationObserver 在节点及 style 变化后合并为 microtask 检查，卸载时断开并取消待处理工作。
没有定时巡检；不匹配契约时跳过。官方修复正常卸载后没有残留登记，本插件不会再介入。
自检的 available 仅证明修复监听已安装，不代表当前构建的原生交互已验收。

测试覆盖原生登记契约、非空退出、重新打开、去重、范围边界与卸载。
使用实际打包的 React / AnimatePresence 验证时，原始应用源码与截图只留在忽略的本机证据目录。

经典聊天的 Pin 属于 `quick-chat` 增强：仅固定期间通过属性标记让透明背景穿透，Minimize 解除固定，退出 / 卸载释放标记。退出修复仍独立工作，不依赖 Pin 状态，不改变原生层的 class 或动画注册契约。当前组合验收覆盖固定、取消固定后外部点击关闭、透明层移除和主页面命中。
