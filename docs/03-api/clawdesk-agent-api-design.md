# ClawDesk API 设计文档

## 文档速览

这份文档专门说明：
- 当前主要 API 模块与边界
- 聊天、任务、权限、设备等接口集合
- 接口演进和复用原则

最后更新：2026-03-12


## 1. 文档目标

这份文档描述当前 ClawDesk Agent 助手桌面 MVP 的主要 API 边界。

## 2. 当前 API 主线

当前 API 主要分为以下模块：

1. `runtime`
2. `chat`
3. `agent-tasks`
4. `agent-safe-actions`
5. `agent-reminder-plans`
6. `agent-reminder-deliveries`
7. `agent-study-roadmaps`
8. `agent-course-schedule`
9. `agent-file-workspaces`
10. `activity`
11. `capabilities`
12. `permissions`
13. `approvals`
14. `devices`
15. `mobile`

## 3. 设计原则

- 模块边界清晰，按业务而不是按技术细节命名
- 同一类数据尽量提供一致结构
- 高风险动作不直接执行，而先进入审批链路
- Android 与未来移动端优先复用桌面 Runtime 的稳定接口

## 4. 当前已实现的重点接口方向

- 对话与 Agent
- 任务与成果沉淀
- Activity 时间线
- Capabilities 概览
- Permissions 与审批
- 设备与配对中心

## 5. 毕设阶段边界

毕业设计阶段重点是接口可被桌面端稳定调用，结构清晰、可讲解，不强求所有接口都已接入外部真实模型或正式移动端客户端。
