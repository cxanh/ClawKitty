# ClawDesk API 规划文档（Agent 助手方向）

## 文档速览

这份文档专门说明：
- 项目早期 API 规划基线
- 最初的接口范围与设计思路
- 与当前正式 API 文档的关系

最后更新：2026-03-12


## 1. 文档目标

这份文档用于重新定义 Runtime API 的主边界。

新的 API 规划以这些能力为中心：
- Chat
- Tasks
- Activity
- Capabilities
- Mobile Companion

而不是只围绕设备、进程和系统监控。

## 2. API 设计原则

### 2.1 用户价值优先
API 先服务于：
- 对话
- 任务
- Agent 状态透明
- 能力可见性

### 2.2 支撑能力后置
设备、Relay、日志仍然存在，但属于支撑性 API。

### 2.3 多端共享
桌面端和 Android 端都应复用同一套 Agent API。

### 2.4 安全边界清晰
所有高风险动作必须：
- scope 清晰
- 可审批
- 可审计

## 3. 认证与 scope

建议 scope 调整为：
- `chat.read`
- `chat.write`
- `task.read`
- `task.write`
- `activity.read`
- `capability.read`
- `device.read`
- `logs.read`
- `relay.read`
- `relay.control`
- `admin.settings`

移动端第一阶段默认：
- `chat.read`
- `chat.write`
- `task.read`
- `activity.read`
- `capability.read`
- `device.read`
- `logs.read`
- `relay.read`

## 4. 核心数据模型

### 4.1 ConversationSummary
```json
{
  "conversationId": "conv_001",
  "title": "整理明天课程资料",
  "status": "active",
  "lastMessageAt": "2026-03-11T10:00:00.000Z",
  "source": "android"
}
```

### 4.2 MessageItem
```json
{
  "messageId": "msg_001",
  "conversationId": "conv_001",
  "role": "assistant",
  "content": "我已经开始整理课程资料。",
  "taskId": "task_001",
  "createdAt": "2026-03-11T10:00:00.000Z"
}
```

### 4.3 AgentTask
```json
{
  "taskId": "task_001",
  "summary": "整理课程资料",
  "status": "running",
  "sourceType": "chat",
  "approvalStatus": "not-required",
  "assignedModelId": "gpt-4.1",
  "createdAt": "2026-03-11T10:00:00.000Z",
  "updatedAt": "2026-03-11T10:01:00.000Z"
}
```

### 4.4 ActivityEntry
```json
{
  "activityId": "act_001",
  "taskId": "task_001",
  "kind": "task-step",
  "title": "开始扫描下载目录",
  "description": "Agent 正在按课程名称分类资料。",
  "severity": "info",
  "createdAt": "2026-03-11T10:01:00.000Z"
}
```

### 4.5 CapabilityItem
```json
{
  "capabilityId": "skill_pdf_sorter",
  "kind": "skill",
  "displayName": "资料整理",
  "description": "按课程、文件类型整理资料",
  "enabled": true,
  "availabilityStatus": "available",
  "requiresApproval": false
}
```

## 5. 主产品 API

## 5.1 Chat

### `GET /api/v1/chat/conversations`
获取会话列表。

### `GET /api/v1/chat/conversations/:conversationId`
获取会话详情与最近消息。

### `POST /api/v1/chat/conversations`
新建会话。

### `POST /api/v1/chat/messages`
发送消息。

请求示例：
```json
{
  "conversationId": "conv_001",
  "content": "帮我整理今天的课程资料",
  "source": "android"
}
```

返回示例：
```json
{
  "accepted": true,
  "conversationId": "conv_001",
  "taskId": "task_001"
}
```

## 5.2 Tasks

### `GET /api/v1/tasks`
获取任务列表。

### `GET /api/v1/tasks/:taskId`
获取任务详情。

### `POST /api/v1/tasks`
手动创建任务。

### `POST /api/v1/tasks/:taskId/cancel`
取消任务。

### `POST /api/v1/tasks/:taskId/approve`
批准高风险动作。

## 5.3 Activity

### `GET /api/v1/activity`
获取最近活动流。

### `GET /api/v1/activity/:activityId`
获取活动详情。

## 5.4 Capabilities

### `GET /api/v1/capabilities/models`
### `GET /api/v1/capabilities/skills`
### `GET /api/v1/capabilities/tools`

这些接口都要返回：
- displayName
- description
- enabled
- availabilityStatus
- requiresApproval
- recommendedUseCases

## 6. 支撑 API

### 6.1 Runtime
- `GET /api/v1/runtime/health`
- `GET /api/v1/runtime/onboarding`

### 6.2 Devices
- `GET /api/v1/devices`
- `GET /api/v1/devices/:deviceId`
- `GET /api/v1/devices/pairing-center`

### 6.3 Browser
- `GET /api/v1/browser/relay`
- `GET /api/v1/browser/relay/events`

### 6.4 Logs
- `GET /api/v1/logs/summary`
- `GET /api/v1/logs/query`

## 7. Android 重点接口

Android 端近期最重要的是：
- `GET /api/v1/mobile/overview`
- `GET /api/v1/mobile/pairing-flow`
- `GET /api/v1/mobile/pairing-status`
- `POST /api/v1/mobile/pairing-request`

后续需要新增或正式化：
- `GET /api/v1/chat/conversations`
- `POST /api/v1/chat/messages`
- `GET /api/v1/tasks`
- `GET /api/v1/activity`
- `GET /api/v1/capabilities/*`

## 8. 一句话结论

API 规划已经从“系统控制接口集合”调整为：

`以聊天、任务、活动流和能力目录为核心，设备与 Relay 为支撑。`
