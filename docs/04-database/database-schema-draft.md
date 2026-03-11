# ClawDesk 数据结构草案（Agent 助手方向）

## 文档速览

这份文档专门说明：
- 项目早期数据结构草案
- 最初的数据表与字段设计
- 与正式数据文档的关系

最后更新：2026-03-12


## 1. 文档目标

这份文档用于把本地数据结构从“偏监控与兼容层”调整为“面向个人 Agent 助手”的数据模型。

新的重点不再只是：
- metrics
- process snapshots
- pairing

而是同时加入：
- conversation
- message
- agent task
- activity feed
- capability registry
- approval records

## 2. 设计原则

- 对话与任务是一等数据实体
- 活动流是用户可读层，不等同于日志
- 模型、技能、工具要能统一展示
- 审批和审计必须可追踪
- 兼容旧 OpenClaw 数据，但不被旧结构绑死

## 3. 建议数据库文件

- 文件名：`clawdesk.db`
- 引擎：SQLite
- 字符集：UTF-8

## 4. 重点表清单

| 表名 | 用途 |
| --- | --- |
| `app_settings` | 应用设置 |
| `conversations` | 会话索引 |
| `messages` | 会话消息 |
| `agent_tasks` | Agent 任务 |
| `task_steps` | 任务步骤 |
| `activity_entries` | 活动流 |
| `capability_items` | 模型/技能/工具目录 |
| `approval_requests` | 审批请求 |
| `paired_devices` | 已配对设备 |
| `pairing_requests` | 配对请求 |
| `task_definitions` | 定时任务定义 |
| `task_runs` | 自动化任务运行记录 |
| `alerts` | 告警记录 |
| `audit_events` | 审计记录 |
| `system_state` | Runtime 当前状态 |

## 5. 关键 DDL 建议

### 5.1 `conversations`
```sql
CREATE TABLE conversations (
  conversation_id TEXT PRIMARY KEY,
  title TEXT,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  last_message_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.2 `messages`
```sql
CREATE TABLE messages (
  message_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  model_id TEXT,
  task_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
);
```

### 5.3 `agent_tasks`
```sql
CREATE TABLE agent_tasks (
  task_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  conversation_id TEXT,
  summary TEXT NOT NULL,
  status TEXT NOT NULL,
  approval_status TEXT NOT NULL,
  assigned_model_id TEXT,
  result_summary TEXT,
  error_summary TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
);
```

### 5.4 `task_steps`
```sql
CREATE TABLE task_steps (
  step_id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id)
);
```

### 5.5 `activity_entries`
```sql
CREATE TABLE activity_entries (
  activity_id TEXT PRIMARY KEY,
  task_id TEXT,
  conversation_id TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(conversation_id)
);
```

### 5.6 `capability_items`
```sql
CREATE TABLE capability_items (
  capability_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  availability_status TEXT NOT NULL,
  requires_approval INTEGER NOT NULL DEFAULT 0,
  meta_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### 5.7 `approval_requests`
```sql
CREATE TABLE approval_requests (
  approval_id TEXT PRIMARY KEY,
  task_id TEXT,
  request_kind TEXT NOT NULL,
  request_summary TEXT NOT NULL,
  status TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT,
  details_json TEXT,
  FOREIGN KEY (task_id) REFERENCES agent_tasks(task_id)
);
```

## 6. 继续保留的支撑数据

这些数据仍然有价值，但现在属于支撑层：
- `paired_devices`
- `pairing_requests`
- `task_definitions`
- `task_runs`
- `alerts`
- `audit_events`
- `system_state`

## 7. 新的数据关系

新的产品表达里，主关系建议变成：

- conversation 产生 message
- message 触发 agent_task
- agent_task 产生 task_step 和 activity_entry
- agent_task 在需要时创建 approval_request
- capability_items 解释 agent_task 执行依赖

## 8. 一句话结论

数据库结构需要从“监控与兼容导入优先”升级为：

`对话、任务、活动流、能力目录优先，设备与监控为支撑。`
