# ClawDesk 技术设计文档

## 文档速览

这份文档专门说明：
- 桌面端与 Runtime 的技术架构
- 模块边界、数据流和关键决策
- 当前技术路线为何这样设计

最后更新：2026-03-12


## 1. 技术目标

当前技术架构的核心目标是：

1. 让桌面端能在没有 OpenClaw 的电脑上独立运行
2. 保留对现有 `.openclaw` 数据的兼容读取与导入能力
3. 让 Chat、Tasks、Activity、Permissions、Devices 共用同一套本地 Runtime
4. 支持后续继续扩展 Android 和更多 Agent 能力

## 2. 架构总览

当前架构由三层组成：

- Electron 桌面壳
- 本地 Runtime
- 数据与兼容层

## 3. 当前主要模块

当前 Runtime 已经包含这些核心模块：

- chat
- agent tasks
- safe actions
- reminder plans / deliveries
- study roadmaps
- file workspaces
- permissions / approvals
- devices / pairing center
- activity
- capabilities

## 4. 数据目录策略

当前默认数据目录为应用自管目录，而不是强依赖用户机器已有的 `.openclaw`。

这样可以保证：

- 新手电脑无需安装 OpenClaw
- 首次启动可自动初始化空数据骨架
- 老数据可按兼容导入方式迁移

## 5. 毕设阶段边界

毕业设计阶段优先保证：

- 桌面端主功能稳定
- 数据目录清晰
- 无开发环境电脑可运行
- 核心链路可演示
