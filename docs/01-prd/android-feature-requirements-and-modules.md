# Android 端功能需求与模块设计（桌面能力同步版）

## 文档速览

这份文档专门说明：
- Android 端当前在毕设阶段承担什么角色
- 已经同步了桌面端哪些核心能力
- Android 端的模块与页面如何划分
- 哪些功能属于毕设范围，哪些留到后续继续开发

最后更新：2026-03-12

## 1. 文档目的

这份文档用于统一 Android 端的产品定位、功能边界和模块设计，避免后续开发时继续把移动端做成“只有状态查看”的附属端。

当前明确结论：

`Android 端是桌面版个人 Agent 助手的移动陪伴端。`

它需要与桌面端保持同一条产品主线：
- 首页总览
- 与 Agent 聊天
- 查看任务与结果物
- 查看活动时间线
- 查看能力与权限边界
- 查看设备与配对状态

## 2. Android 端当前定位

毕设阶段采用：

`desktop-first + android companion`

也就是：
- 桌面端负责完整 MVP 演示和主要执行链
- Android 端负责同步桌面当前主要能力，承担移动入口和移动查看角色
- 高风险动作审批与深度执行仍由桌面端主导

## 3. 当前已同步到 Android 的能力

### 3.1 已完成页面

当前 Android 端已具备这些页面：

- `Home`
- `Chat`
- `Tasks`
- `Activity`
- `More`
- `Capabilities`
- `Permissions`
- `Devices`
- `Pairing`
- `Settings`

### 3.2 已同步的数据能力

当前 Android 端已经接上这些桌面 Runtime 数据：

- `mobile/overview`
- `mobile/bootstrap`
- `mobile/alerts-summary`
- `mobile/auth-boundary`
- `mobile/pairing-flow`
- `mobile/pairing-status`
- `chat/bootstrap`
- `chat/conversations`
- `chat/conversations/:conversationId`
- `chat/messages`
- `agent-tasks`
- `agent-safe-actions`
- `agent-reminder-plans`
- `agent-study-roadmaps`
- `agent-file-workspaces`
- `agent-course-schedule`
- `activity`
- `capabilities`
- `permissions`
- `devices`
- `devices/pairing-center`
- `devices/pairing-audit`

### 3.3 当前已具备的交互能力

毕设阶段当前已具备：

- 查看首页总览
- 查看聊天列表与会话详情
- 发送消息给 Agent
- 查看任务中心各工作台摘要
- 查看活动时间线
- 查看能力概览
- 查看权限与审批摘要
- 查看设备列表与配对中心摘要
- 提交移动端配对请求
- 配置和保存 Base URL

## 4. 模块划分

### 4.1 Home

职责：
- 展示 Runtime 状态
- 展示 Relay 状态
- 展示设备数量与待审批数量
- 展示 Agent 能力快照
- 提供进入核心页面的快捷入口

### 4.2 Chat

职责：
- 同步桌面聊天主链路
- 展示会话列表
- 展示会话详情
- 发送消息
- 展示回复来源与审批提示

### 4.3 Tasks

职责：
- 同步桌面任务工作台摘要
- 展示 Agent 任务卡
- 展示 Safe Actions
- 展示 Reminder Plans
- 展示 Study Roadmaps
- 展示 File Workspaces
- 展示 Course Schedule

### 4.4 Activity

职责：
- 同步桌面 Activity Feed
- 展示最近活动
- 支持按类别筛选：
  - Agent
  - 审批
  - 提醒
  - 文件
  - 系统

### 4.5 Capabilities

职责：
- 展示模型、Skills、Tools 的当前状态
- 明确区分：
  - available
  - partial
  - planned

### 4.6 Permissions

职责：
- 展示默认风险策略
- 展示工具级策略
- 展示待审批请求
- 展示审批历史

### 4.7 Devices

职责：
- 保留多设备管理面板
- 展示设备数量
- 展示 Pairing Center 状态
- 展示最近配对审计

### 4.8 Pairing

职责：
- 读取桌面配对流程说明
- 展示桌面准备状态
- 提交 pairing request

### 4.9 Settings

职责：
- 配置桌面 Runtime 的 Base URL
- 支持恢复默认值
- 提示模拟器和真机的连接方式差异

## 5. 毕设阶段边界

### 5.1 进入毕设范围

这些内容属于当前毕设可展示范围：

- Android 工程骨架
- APK 可构建
- 与桌面核心数据链路同步
- 核心页面可浏览
- Chat 可发送消息
- Pairing 可提交请求
- 设置页可保存 Base URL

### 5.2 暂不进入毕设范围

这些内容保留到后续开发：

- Android 端完整高风险审批操作
- Android 端对桌面任务、权限、设备的写操作闭环
- Android 端提醒组件和桌面小组件
- Android 端文件自动整理执行
- Android 端完整推送和后台调度
- Android 端与桌面完全同等的深度执行能力

## 6. 当前实现策略

当前实现遵循：

`先同步桌面核心信息面，再逐步开放移动端交互。`

这样做的原因：
- 更适合毕设阶段收口
- 便于演示“同一套系统，桌面主控，移动伴随”
- 避免在移动端提前引入高风险复杂执行链

## 7. 当前交付结论

截至 2026-03-12，Android 端已经从“工程骨架”推进到：

`可编译、可安装、可浏览桌面当前核心能力的移动端第一版。`

它不是完整等同于桌面端的第二个主控台，但已经足够用于：
- 展示产品整体方向
- 体现多端联动能力
- 支撑毕设汇报中的“移动端扩展与落地路径”

## 8. 后续开发方向

毕设完成后，Android 端优先继续：

1. 聊天页继续增强，补 Starter Prompt 和更强会话管理
2. 任务页增加只读展开详情
3. 审批摘要升级为可交互审批
4. 接入桌面提醒与移动提醒联动
5. 开发移动端首页组件和通知能力
