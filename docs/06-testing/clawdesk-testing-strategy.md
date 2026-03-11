# ClawDesk 测试文档

## 文档速览

这份文档专门说明：
- 当前测试策略和验证层次
- 哪些链路需要冒烟与走查
- 测试文档如何配合答辩准备

最后更新：2026-03-12


## 1. 文档目标

这份文档定义当前毕业设计阶段的测试重点和验证方式。

## 2. 当前测试层次

### 2.1 构建与类型检查

- `npm run check`
- `npm run build`
- `npm run package:dir`

### 2.2 模块冒烟

当前已经通过脚本验证的链路包括：

- chat
- agent tasks
- safe actions
- reminder plans / deliveries
- study roadmaps
- file workspaces
- approvals
- course schedule

### 2.3 页面演示走查

答辩前需人工走查：

- Home
- Chat
- Tasks
- Activity
- Capabilities
- Permissions
- Devices

## 3. 当前验收重点

当前不是追求测试覆盖率数字，而是追求核心演示链路稳定：

1. 能启动
2. 能聊天
3. 能形成任务和提醒成果
4. 能看到活动和能力边界
5. 能解释权限与设备管理

## 4. 答辩前文档配套

答辩前建议至少联动查看这些文档：

- `graduation-mvp-acceptance-checklist.md`
- `demo-data-preparation-checklist.md`
- `pre-defense-runbook.md`
