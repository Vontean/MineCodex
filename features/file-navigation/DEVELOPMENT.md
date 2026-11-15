# File Navigation 开发契约

`check-native-capabilities` 只在当前页面存在可见的原生 `file-tree-container` 时检查 Files 原生模块。冷启动 Home 没有该树时返回 `not-applicable/open-files-tree`；这表示目标页尚未挂载，不表示目录 query 或 Tree 契约失效。进入真实 Files 页面后再执行模块检查，才能区分 Tree 签名变化与目录读取失败。
