# ClawDesk Browser Relay 启动与联调说明

## 文档速览

这份文档专门说明：
- Browser Relay 的启动与联调方式
- 扩展、gateway 和 relay 的协同关系
- 常见问题的排查路径

最后更新：2026-03-12


## 1. 文档目标

这份文档用于说明 Browser Relay 在当前桌面项目中的角色、启动方式和联调路径。

## 2. 当前组成

Browser Relay 当前由三部分组成：

- 桌面端页面和状态展示
- 本地 managed gateway / relay host
- Chrome 扩展侧连接

## 3. 当前已完成的能力

当前已经可以做到：

- 检查 relay 与 gateway 状态
- 查看 relay targets
- 执行 open / focus / close
- 在首页和 OpenClaw 页看到连接状态

## 4. 当前边界

Browser Relay 是桌面端支撑能力，不是当前毕业设计主叙事中心。答辩时可作为技术亮点演示，不必占据主要时间。
