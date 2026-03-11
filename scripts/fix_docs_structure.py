from __future__ import annotations

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
TODAY = "2026-03-12"

PATH_REWRITES = {
    "C:/Users/ASUS/Desktop/openlaw/docs/android-feature-requirements-and-modules.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/android-feature-requirements-and-modules.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/android-first-skeleton-plan.md": "C:/Users/ASUS/Desktop/openlaw/docs/02-technical-design/android-first-skeleton-plan.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/api-v1-spec.md": "C:/Users/ASUS/Desktop/openlaw/docs/03-api/api-v1-spec.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/browser-relay-startup-and-live-debug.md": "C:/Users/ASUS/Desktop/openlaw/docs/02-technical-design/browser-relay-startup-and-live-debug.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/database-schema-draft.md": "C:/Users/ASUS/Desktop/openlaw/docs/04-database/database-schema-draft.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/desktop-first-start-and-managed-home.md": "C:/Users/ASUS/Desktop/openlaw/docs/05-deployment-ops/desktop-first-start-and-managed-home.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/development-progress-and-tasks.md": "C:/Users/ASUS/Desktop/openlaw/docs/09-project-tracking/development-progress-and-tasks.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/implementation-roadmap.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/implementation-roadmap.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/mobile-client-preparation.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/mobile-client-preparation.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/mobile-home-information-architecture.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/mobile-home-information-architecture.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/mobile-pairing-and-authorization-flow.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/mobile-pairing-and-authorization-flow.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/mvp-runthrough-plan.md": "C:/Users/ASUS/Desktop/openlaw/docs/05-deployment-ops/mvp-runthrough-plan.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/next-session-handoff-2026-03-09.md": "C:/Users/ASUS/Desktop/openlaw/docs/09-project-tracking/next-session-handoff-2026-03-09.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/openclaw-device-app-design.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/openclaw-device-app-design.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/packaging-and-startup-guide.md": "C:/Users/ASUS/Desktop/openlaw/docs/05-deployment-ops/packaging-and-startup-guide.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/pairing-center-runtime-flow.md": "C:/Users/ASUS/Desktop/openlaw/docs/02-technical-design/pairing-center-runtime-flow.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/product-feature-list-v1.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/product-feature-list-v1.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/release-branding-and-signing-plan.md": "C:/Users/ASUS/Desktop/openlaw/docs/05-deployment-ops/release-branding-and-signing-plan.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/technical-architecture-draft.md": "C:/Users/ASUS/Desktop/openlaw/docs/02-technical-design/technical-architecture-draft.md",
    "C:/Users/ASUS/Desktop/openlaw/docs/后续任务规划与开发方向.md": "C:/Users/ASUS/Desktop/openlaw/docs/01-prd/后续任务规划与开发方向.md",
    "C:/Users/ASUS/Desktop/openlaw/开发总览与使用说明.md": "C:/Users/ASUS/Desktop/openlaw/docs/09-project-tracking/开发总览与使用说明.md",
}


TITLE_OVERRIDES: dict[str, str] = {
    "README.md": "ClawDesk 文档总索引",
    "document-catalog.md": "ClawDesk 文档目录",
    "documentation-governance.md": "文档治理说明",
    "clawdesk-agent-assistant-prd.md": "ClawDesk 产品需求文档（PRD）",
    "desktop-home-and-chat-information-architecture.md": "桌面 Home 与 Chat 信息架构",
    "graduation-current-implementation-and-future-direction.md": "毕业设计当前实现与后续方向说明",
    "graduation-design-mvp-scope.md": "毕业设计 MVP 范围说明",
    "permissions-and-approval-prd.md": "权限管理与审批体系 PRD",
    "clawdesk-agent-runtime-technical-design.md": "ClawDesk 技术设计文档",
    "clawdesk-agent-api-design.md": "ClawDesk API 设计文档",
    "clawdesk-agent-database-design.md": "ClawDesk 数据设计文档",
    "clawdesk-deployment-and-ops.md": "ClawDesk 部署运维文档",
    "clawdesk-testing-strategy.md": "ClawDesk 测试文档",
    "demo-data-preparation-checklist.md": "答辩演示数据准备清单",
    "graduation-mvp-acceptance-checklist.md": "毕业设计 MVP 验收清单",
    "clawdesk-user-manual.md": "ClawDesk 用户手册",
    "graduation-demo-script.md": "毕业设计演示脚本",
    "development-log-2026-03.md": "ClawDesk 开发日志（2026-03）",
    "browser-relay-startup-and-live-debug.md": "ClawDesk Browser Relay 启动与联调说明",
    "desktop-first-start-and-managed-home.md": "桌面端首次启动与应用自管数据目录说明",
    "mvp-runthrough-plan.md": "ClawDesk MVP 跑通说明",
    "packaging-and-startup-guide.md": "ClawDesk 安装与启动说明",
    "release-branding-and-signing-plan.md": "ClawDesk 品牌与签名规划",
    "pairing-center-runtime-flow.md": "Pairing Center 运行流说明",
}
OVERVIEWS: dict[str, list[str]] = {
    "README.md": ["文档体系总入口和阅读顺序", "正式维护目录与职责划分", "毕业设计阶段优先关注的材料"],
    "document-catalog.md": ["全部文档的分类总目录和跳转入口", "每份文档当前的用途概览", "答辩前和交接时最省时间的导航方式"],
    "documentation-governance.md": ["文档治理规则与更新要求", "代码变动后哪些文档需要同步", "如何避免文档与实现脱节"],
    "clawdesk-agent-assistant-prd.md": ["产品定位、目标用户和核心场景", "毕业设计 MVP 的主功能边界", "桌面端与移动端的优先级"],
    "desktop-home-and-chat-information-architecture.md": ["桌面 Home 与 Chat 的信息架构", "首页和聊天页应展示的关键内容", "更适合演示的页面叙事方式"],
    "graduation-current-implementation-and-future-direction.md": ["现有毕设已经实现了什么", "哪些桌面能力已经可演示", "哪些内容延期到后续开发"],
    "graduation-design-mvp-scope.md": ["毕业设计 MVP 必须交付的范围", "当前优先收口的基础功能", "延期功能与答辩边界说明"],
    "permissions-and-approval-prd.md": ["权限管理与审批体系规则", "低风险自动与高风险审批的边界", "设备、能力、动作三层权限"],
    "android-feature-requirements-and-modules.md": ["Android 端的定位与模块边界", "第一阶段适合做哪些移动端能力", "与桌面端主线如何保持一致"],
    "implementation-roadmap.md": ["项目阶段性实施路线和里程碑", "功能推进顺序与依赖关系", "作为历史路线图的参考价值"],
    "mobile-client-preparation.md": ["移动端当前准备状态", "已完成的接口与配对能力", "后续继续开发的承接点"],
    "mobile-home-information-architecture.md": ["移动端首页应该展示什么", "状态、提醒和审批摘要的优先级", "与桌面首页的职责分工"],
    "mobile-pairing-and-authorization-flow.md": ["移动端配对与授权流程", "桌面审批和 scope 模型", "后续扩展二维码接入的基础规则"],
    "openclaw-device-app-design.md": ["最初从 OpenClaw 原型出发的整体设计", "桌面端与移动端的初始设想", "作为历史背景保留的参考内容"],
    "product-feature-list-v1.md": ["早期功能清单与优先级", "哪些页面曾被定义为 v1 核心", "作为历史范围参考的价值"],
    "后续任务规划与开发方向.md": ["后续阶段的任务规划和方向", "各阶段优先级与建议顺序", "适合毕设后继续推进的内容"],
    "android-first-skeleton-plan.md": ["Android 工程骨架的搭建说明", "目录结构与初始页面规划", "后续继续补齐移动端的起点"],
    "browser-relay-startup-and-live-debug.md": ["Browser Relay 的启动与联调方式", "扩展、gateway 和 relay 的协同关系", "常见问题的排查路径"],
    "clawdesk-agent-runtime-technical-design.md": ["桌面端与 Runtime 的技术架构", "模块边界、数据流和关键决策", "当前技术路线为何这样设计"],
    "pairing-center-runtime-flow.md": ["配对中心的运行时数据流", "会话、审批和已配对设备的关系", "过期清理与审计链路"],
    "technical-architecture-draft.md": ["项目早期技术架构草案", "最初的目录结构与模块设想", "作为历史参考保留的内容"],
    "api-v1-spec.md": ["项目早期 API 规划基线", "最初的接口范围与设计思路", "与当前正式 API 文档的关系"],
    "clawdesk-agent-api-design.md": ["当前主要 API 模块与边界", "聊天、任务、权限、设备等接口集合", "接口演进和复用原则"],
    "clawdesk-agent-database-design.md": ["当前数据存储设计与核心实体", "本地数据目录和主要数据文件", "后续升级存储时的边界约束"],
    "database-schema-draft.md": ["项目早期数据结构草案", "最初的数据表与字段设计", "与正式数据文档的关系"],
    "clawdesk-deployment-and-ops.md": ["项目的部署、运行和排障方式", "安装包、目录版和数据目录说明", "没有开发环境时如何运行程序"],
    "desktop-first-start-and-managed-home.md": ["桌面端首次启动与应用自管数据目录", "没有 OpenClaw 时如何初始化", "旧数据如何导入新目录"],
    "mvp-runthrough-plan.md": ["如何把当前 MVP 跑通", "启动前后的检查顺序", "演示前建议验证的关键链路"],
    "packaging-and-startup-guide.md": ["安装、启动和打包产物说明", "当前有哪些产物以及怎么使用", "常见启动问题与排查点"],
    "release-branding-and-signing-plan.md": ["品牌、安装元数据和签名规划", "当前已完成与未完成的发布项", "毕业设计阶段的发布边界"],
    "clawdesk-testing-strategy.md": ["当前测试策略和验证层次", "哪些链路需要冒烟与走查", "测试文档如何配合答辩准备"],
    "demo-data-preparation-checklist.md": ["答辩演示前建议准备的示例数据", "每个核心页面适合展示什么内容", "如何避免现场用真实隐私数据演示"],
    "graduation-mvp-acceptance-checklist.md": ["毕业设计 MVP 的验收清单", "哪些页面和流程必须可演示", "哪些问题会影响通过"],
    "pre-defense-runbook.md": ["答辩开始前应该如何逐项走查", "哪些链路必须提前验证", "现场异常时优先如何降级处理"],
    "clawdesk-user-manual.md": ["面向用户的安装与页面使用说明", "Chat、Tasks、Permissions 等页面怎么用", "常见问题和基础排障方式"],
    "graduation-demo-script.md": ["毕业设计答辩的推荐演示顺序", "每一段适合展示什么内容", "现场依赖异常时的备用讲法"],
    "development-log-2026-03.md": ["按时间记录的重要开发变化", "每轮开发做了什么和验证了什么", "后续回溯阶段状态时可参考"],
    "development-progress-and-tasks.md": ["当前开发进度和已完成事项", "每轮开发后的状态更新", "接下来最推荐推进的工作"],
    "next-session-handoff-2026-03-09.md": ["某次阶段性交接时的项目状态", "当时已完成内容和建议下一步", "作为历史交接材料保留"],
    "开发总览与使用说明.md": ["当前项目最适合快速上手的总览说明", "如果只想先了解现状应该先看什么", "在整套文档体系中的位置"],
}
REWRITE_BODIES: dict[str, str] = {
    "documentation-governance.md": """
## 1. 文档目标

这份文档用于统一 ClawDesk 当前的文档治理方式，保证后续开发、答辩准备和项目交接都能沿着同一套规则执行。

当前治理目标有四个：

1. 保证文档和代码同步演进
2. 保证不同读者能快速找到自己需要的材料
3. 保证毕业设计阶段的交付边界说得清楚
4. 保证后续继续开发时不需要重新猜项目状态

## 2. 编写原则

### 2.1 读者导向

不同文档类型分别面向不同读者：

- PRD：产品、设计、开发、答辩老师
- 技术设计：开发者、项目维护者
- API 文档：前端、后端、移动端开发者
- 数据文档：开发者、后续维护者
- 部署运维文档：安装、运行、排障相关人员
- 测试文档：开发者、测试者、答辩前走查人员
- 用户手册：最终使用者、演示者
- 开发日志与进度文档：项目维护者、后续接手者

### 2.2 及时更新

当代码和行为发生变化时，应同步更新对应文档：

- 页面结构变化时，更新 PRD、用户手册、演示脚本
- 模块边界变化时，更新技术设计文档
- 接口变化时，更新 API 文档
- 数据结构变化时，更新数据库文档
- 交付方式变化时，更新部署运维文档
- 每轮实质性开发结束后，至少更新一次进度文档和开发日志

### 2.3 版本控制

所有正式文档都纳入 Git 管理，并与代码一起维护：

- 不单独维护脱离代码的文档副本
- 文档变更尽量和对应实现一起提交
- 不允许长期存在实现已经改变但文档还停留在旧版本的状态

## 3. 当前分类规则

当前文档目录按以下层次组织：

- `00-governance`：文档治理与目录规则
- `01-prd`：需求、产品方向、信息架构、路线与规划
- `02-technical-design`：技术架构、运行机制、关键模块设计
- `03-api`：接口说明与历史 API 参考
- `04-database`：数据结构与存储设计
- `05-deployment-ops`：安装、打包、启动、排障、运行目录
- `06-testing`：测试策略与验收清单
- `07-user-guide`：用户手册与演示脚本
- `08-development-log`：按日期记录的开发日志
- `09-project-tracking`：进度、交接、总览说明

## 4. 维护要求

后续维护时统一遵循：

1. 每份正式文档开头都保留“文档速览”
2. 代码变化后同步更新对应文档
3. 重要状态变化同步记录到开发日志或进度文档
4. 历史文档可以保留，但必须放在清晰可理解的分类下

## 5. 一句话结论

文档不是交付后的附属品，而是当前毕业设计可答辩、后续项目可维护的重要基础设施。
""",
    "clawdesk-agent-assistant-prd.md": """
## 1. 产品定位

ClawDesk 当前统一定位为：

`面向大一新生的个人 Agent 助手`

它不是单纯的设备管理面板，也不是单纯的聊天窗口，而是一个帮助用户持续了解 Agent 在做什么、给 Agent 布置任务、接收提醒、管理权限和查看电脑状态的桌面助手。

## 2. 目标用户

当前主要目标用户是刚进入大学的新生。这个用户群体通常：

- 不熟悉复杂的软件配置
- 对提醒、课表、材料查找、学习计划有刚性需求
- 需要产品讲清楚现在能做什么和下一步怎么做
- 对权限、安全和自动化动作既有需求，也会担心风险

## 3. 毕业设计 MVP 主线

毕业设计阶段优先交付的基础能力如下：

1. `Home`
2. `Chat`
3. `Tasks`
4. `Activity`
5. `Capabilities`
6. `Permissions`
7. `Devices`

其中：

- `Chat / Tasks / Activity / Capabilities` 构成个人 Agent 助手主叙事
- `Permissions / Devices` 构成安全边界和设备管理支撑能力

## 4. 核心场景

当前最重要的场景包括：

- 课程提醒
- 文件查找与整理建议
- 学习计划生成
- 生日、会议、截止日等记忆提醒

## 5. 当前不作为毕设主交付的内容

这些能力保留方向和接口，但不作为当前 MVP 的主交付目标：

- Android 与桌面完整能力同步
- 多 Agent 分工体系
- 真正的自动文件整理执行
- 更复杂的模型编排与多步工具链

## 6. 产品原则

当前版本坚持四条原则：

1. 先让用户看懂，再让用户操作
2. 低风险能力优先自动，高风险能力必须可审批
3. 支持没有 OpenClaw 的新手电脑独立运行
4. 毕设阶段优先收口基础功能，不盲目继续扩功能面
""",
    "desktop-home-and-chat-information-architecture.md": """
## 1. Home 的定位

Home 现在是 Agent-first 总览首页，不再是旧 Dashboard 的替代品。

首页应该优先回答四个问题：

1. Agent 当前在做什么
2. 我最值得关注的任务是什么
3. 最近发生了哪些重要变化
4. 现在有哪些能力和风险边界

## 2. Home 核心区块

当前首页应突出这些区块：

- 聊天摘要
- 当前任务焦点
- 最近活动时间线
- Capabilities 摘要
- 待审批数量
- Devices / Runtime / Relay 状态

## 3. Chat 的定位

Chat 是用户和 Agent 建立关系、下达任务、追问进度、获取建议的主入口。

它承担三层作用：

1. 对话入口
2. 任务生成入口
3. 后续动作建议入口

## 4. Chat 页面关键元素

当前聊天页应突出：

- 当前对话列表
- 消息区
- 回复来源说明
- 可转化为任务卡或安全动作的后续建议
- 审批提示和能力边界提示

## 5. Home 与 Chat 的关系

- `Home` 负责概览和导流
- `Chat` 负责发起任务和解释建议
- `Tasks` 承接聊天沉淀下来的结构化成果
- `Activity` 解释最近发生的变化

## 6. 毕设演示建议

答辩时建议先从 Home 进入，再切到 Chat，让老师先看到全局，再看到具体一次交互如何形成任务和提醒。
""",
    "permissions-and-approval-prd.md": """
## 1. 模块定位

Permissions 模块回答一个关键问题：

`Agent 可以做什么，为什么可以做，什么时候必须先经过我确认。`

## 2. 权限层级

当前权限体系按三层组织：

### 2.1 设备权限

- 哪些设备已配对
- 哪些设备被撤销
- 哪些设备最近活跃

### 2.2 能力权限

- 哪些模型可用
- 哪些 Skill 可用
- 哪些 Tool 可见

### 2.3 动作权限

- 是否允许创建提醒
- 是否允许处理任务
- 是否允许文件搜索
- 是否允许高风险桌面动作

## 3. 风险分级

当前默认采用三档分级：

- `low`：允许自动执行
- `medium`：默认先询问
- `high`：默认桌面审批

## 4. 审批策略

当前支持：

- `allow`
- `ask`
- `desktop-approve`
- `deny`

同时保留用户可调整设计，不把风险策略写死。

## 5. 当前已接入审批的动作

毕业设计阶段已接入或关联的高风险路径包括：

- 结束进程
- 移除已配对设备
- Agent 提示中的预审批请求

## 6. 产品原则

当前权限系统遵循：

1. 低风险优先自动
2. 高风险默认审批
3. 用户可以看到当前策略和来源
4. Activity 中要能解释审批前后发生了什么
""",
    "clawdesk-agent-runtime-technical-design.md": """
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
""",
    "clawdesk-agent-api-design.md": """
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
""",
    "clawdesk-agent-database-design.md": """
## 1. 文档目标

当前 ClawDesk 毕设版本以本地文件存储为主，而不是集中式数据库。

这份文档说明：

- 主要数据实体有哪些
- 当前数据保存在哪里
- 为什么选择这种存储方式
- 后续若升级到更正式数据库时需要保留哪些边界

## 2. 当前存储策略

当前版本采用：

- 应用自管数据目录
- JSON 文件为主
- 按业务模块拆分数据文件

## 3. 当前主要数据实体

当前已落盘或持续维护的实体包括：

- conversations
- chat messages
- agent tasks
- safe actions
- reminder plans
- reminder deliveries
- study roadmaps
- course schedule
- file workspaces
- permissions
- approvals
- paired devices
- pairing sessions
- pairing audit
- activity

## 4. 当前设计意义

这种方式更适合毕业设计阶段：

- 易演示
- 易迁移
- 易排查
- 不依赖额外数据库服务
""",
    "clawdesk-deployment-and-ops.md": """
## 1. 文档目标

这份文档用于说明当前项目如何打包、安装、启动、运行和排障。

## 2. 当前交付形态

当前桌面端主要交付形态包括：

- `win-unpacked` 目录版
- Windows 安装器
- 便携版安装产物

毕业设计演示阶段优先使用目录版，路径更稳定，排障也更直接。

## 3. 当前运行方式

运行时由桌面端主进程拉起受管 Runtime。

当前重点特性：

- 不要求用户安装 Node.js
- 不要求用户安装 OpenClaw
- 首次启动自动初始化应用数据目录
- 可在空目录和旧数据导入两种路径下启动

## 4. 运维关注点

当前最重要的运行观察点包括：

- 应用数据目录是否初始化成功
- Runtime 是否正常在线
- Browser Relay 是否就绪
- 日志目录是否持续生成内容

## 5. 毕设阶段建议

毕业设计阶段不追求复杂运维体系，而是追求启动稳定、目录清晰、故障容易定位、文档能说明白。
""",
    "clawdesk-testing-strategy.md": """
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
""",
    "clawdesk-user-manual.md": """
## 1. 文档目标

这份手册面向当前 ClawDesk 桌面端使用者，说明如何安装、启动、理解各页面，以及如何完成当前 MVP 范围内的主要操作。

## 2. 启动程序

当前推荐直接使用目录版：

- 打开 `ClawDesk.exe`
- 等待桌面端初始化 Runtime
- 首次启动时，先阅读首页引导和当前状态摘要

## 3. 核心页面说明

### 3.1 Home

用于快速了解 Agent 状态、任务焦点、最近活动、权限摘要和设备状态。

### 3.2 Chat

用于与 Agent 对话、生成任务卡、生成安全动作草稿。

### 3.3 Tasks

用于查看和管理：

- Agent 任务卡
- 安全动作
- 提醒计划
- 学习路线图
- 文件工作台
- 课表

### 3.4 Activity

用于查看最近发生的行为变化，例如新对话、新任务、新提醒、审批结果和文件工作台预览。

### 3.5 Permissions

用于查看和调整默认风险策略、工具级权限策略，以及处理待审批请求。

### 3.6 Devices

用于查看当前宿主机状态、配对中心、多设备列表和已配对设备详情。

## 4. 当前可演示的典型流程

建议优先演示：

1. Chat 生成任务和提醒草稿
2. Tasks 中查看提醒计划和学习路线图
3. Activity 中查看这些动作的时间线
4. Permissions 中解释风险边界
5. Devices 中展示多设备与配对中心
""",
    "development-log-2026-03.md": """
## 1. 文档目标

这份文档按时间记录 2026 年 3 月的主要开发变化，用于保留阶段性历史，而不是替代当前进度文档。

## 2. 本月重要阶段

### 2026-03-09

- 完成早期设计方案、功能清单、技术草案和项目骨架
- 初步形成 Electron + Vue + Runtime 的桌面方案
- 明确文档、项目和汇报产物的基本结构

### 2026-03-10

- 持续扩展 Browser Relay、Tasks、Logs、Devices 等模块
- 形成更完整的桌面控制台基础
- 开始将项目从工具台校正为个人 Agent 助手

### 2026-03-11

- 按毕业设计 MVP 方向收口桌面主功能
- 完成 Chat、Task Center、Activity、Capabilities、Permissions、Devices 的主线整合
- 强化文档体系、验收清单、演示脚本和项目说明

## 3. 当前作用

这份日志主要用于：

- 快速回顾某个日期做了什么
- 向老师或后续维护者说明项目推进节奏
- 在进度文档之外保留一份按时间排序的历史记录
""",
    "browser-relay-startup-and-live-debug.md": """
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
""",
    "desktop-first-start-and-managed-home.md": """
## 1. 文档目标

这份文档用于说明桌面端如何在没有 OpenClaw 的电脑上完成首次启动，并使用应用自管数据目录运行。

## 2. 当前策略

当前桌面端采用：

- 应用自管数据目录
- 首次启动自动初始化
- 需要时兼容导入旧 `.openclaw` 数据

## 3. 这样设计的意义

这样做可以保证：

- 新手电脑不用安装 OpenClaw
- 打包程序可直接交付运行
- 数据目录更清晰，便于排障和说明

## 4. 当前行为

首次启动时：

- 若无历史数据，则生成空白数据骨架
- 若存在旧数据，则走兼容导入路径
- 页面会进入空状态引导，而不是直接报错
""",
    "mvp-runthrough-plan.md": """
## 1. 文档目标

这份文档说明当前桌面 MVP 从环境检查到启动验证的最短跑通路径。

## 2. 当前推荐顺序

1. 检查依赖与目录
2. 启动桌面端
3. 确认 Runtime 就绪
4. 查看首页状态
5. 走一条主演示链路

## 3. 当前跑通重点

毕业设计阶段优先确认：

- 程序能启动
- Home 能正常显示
- Chat 能生成结果
- Tasks 能承接 Agent 产物
- Activity 能看到时间线
- Permissions 和 Devices 能说明边界与支撑能力
""",
    "packaging-and-startup-guide.md": """
## 1. 文档目标

这份文档用于说明当前桌面程序的打包产物、启动入口和常见启动问题。

## 2. 当前产物类型

目前主要产物包括：

- `win-unpacked` 目录版
- 安装器
- 便携版

## 3. 推荐使用方式

毕业设计演示阶段优先使用目录版：

- 路径稳定
- 易于定位日志与数据目录
- 排障成本更低

## 4. 当前启动链路

用户双击程序后，桌面主进程会：

1. 初始化应用数据目录
2. 拉起本地 Runtime
3. 加载桌面页面
4. 准备提醒和支撑能力
""",
    "release-branding-and-signing-plan.md": """
## 1. 文档目标

这份文档用于说明当前桌面程序在品牌、安装元数据和代码签名上的状态与后续计划。

## 2. 当前已完成

当前已经完成的内容包括：

- 桌面应用品牌名称统一
- 安装包元数据基础配置
- Windows 目录版和安装器产物可生成

## 3. 当前未完成

当前仍属于后续增强项的内容包括：

- 正式代码签名
- 更完整的品牌资源与图标体系
- 更正式的发布级证书配置

## 4. 毕设阶段边界

毕业设计阶段重点是能稳定交付和运行，而不是追求完整商业发布流程，因此这份文档更多是后续规划参考。
""",
}

MANUAL_RETAIN_DOCS = {
    "clawdesk-deployment-and-ops.md",
    "clawdesk-testing-strategy.md",
    "clawdesk-user-manual.md",
    "pre-defense-runbook.md",
    "demo-data-preparation-checklist.md",
}


def overview_block(name: str) -> str:
    bullets = OVERVIEWS.get(
        name,
        [
            "这份文档的主要用途说明尚未补充完成",
            "建议结合文档标题和所在目录阅读",
            "后续维护时应补齐更具体的中文速览",
        ],
    )
    bullet_text = "\n".join(f"- {item}" for item in bullets)
    return f"## 文档速览\n\n这份文档专门说明：\n{bullet_text}\n\n最后更新：{TODAY}\n"


def build_doc(title: str, name: str, body: str) -> str:
    return f"# {title}\n\n{overview_block(name)}\n\n{body.strip()}\n"


def split_body(text: str) -> tuple[str, str]:
    lines = text.splitlines()
    title = lines[0] if lines and lines[0].startswith("# ") else ""
    start = 1 if title else 0

    overview_index = None
    for idx in range(start, len(lines)):
        if lines[idx].strip() == "## 文档速览":
            overview_index = idx
            break

    if overview_index is None:
        body_lines = lines[start:]
    else:
        idx = overview_index + 1
        while idx < len(lines):
            line = lines[idx]
            if line.startswith("最后更新") or line.startswith("Last updated") or line.startswith("后更新") or line.startswith("朂后更新") or line.startswith("鏈"):
                idx += 1
                break
            idx += 1
        while idx < len(lines) and lines[idx].strip() == "":
            idx += 1
        body_lines = lines[idx:]

    while body_lines and (
        body_lines[0].startswith("最后更新")
        or body_lines[0].startswith("Last updated")
        or body_lines[0].startswith("后更新")
        or body_lines[0].startswith("朂后更新")
        or body_lines[0].startswith("鏈")
    ):
        body_lines = body_lines[1:]
        while body_lines and body_lines[0].strip() == "":
            body_lines = body_lines[1:]

    return title, "\n".join(body_lines).strip()


def normalize_title(path: Path, title_line: str) -> str:
    if path.name in TITLE_OVERRIDES:
        return TITLE_OVERRIDES[path.name]
    if title_line.startswith("# "):
        return title_line[2:].strip()
    return path.stem


def rewrite_or_clean(path: Path) -> None:
    if path.name == "document-catalog.md":
        return

    if path.name in MANUAL_RETAIN_DOCS:
        text = path.read_text(encoding="utf-8")
        title_line, body = split_body(text)
        title = normalize_title(path, title_line)
        path.write_text(build_doc(title, path.name, body), encoding="utf-8")
        return

    if path.name in REWRITE_BODIES:
        title = TITLE_OVERRIDES.get(path.name, path.stem)
        path.write_text(build_doc(title, path.name, REWRITE_BODIES[path.name]), encoding="utf-8")
        return

    text = path.read_text(encoding="utf-8")
    title_line, body = split_body(text)
    title = normalize_title(path, title_line)
    path.write_text(build_doc(title, path.name, body), encoding="utf-8")


def folder_label(folder: str) -> str:
    labels = {
        "00-governance": "00-governance 文档治理",
        "01-prd": "01-prd 产品需求与规划",
        "02-technical-design": "02-technical-design 技术设计",
        "03-api": "03-api 接口文档",
        "04-database": "04-database 数据文档",
        "05-deployment-ops": "05-deployment-ops 部署运维",
        "06-testing": "06-testing 测试与验收",
        "07-user-guide": "07-user-guide 用户手册与演示",
        "08-development-log": "08-development-log 开发日志",
        "09-project-tracking": "09-project-tracking 进度与总览",
    }
    return labels.get(folder, folder)


def build_catalog() -> str:
    sections = [
        "# ClawDesk 文档目录",
        "",
        overview_block("document-catalog.md").rstrip(),
        "",
        "## 1. 使用说明",
        "",
        "这份目录用于快速查看当前全部文档的分类、跳转入口和用途概览。",
        "",
        "## 2. 全部文档分类目录",
        "",
        "### 索引文档",
        "",
        "- [ClawDesk 文档总索引](C:/Users/ASUS/Desktop/openlaw/docs/README.md)",
        "  - 文档体系总入口和阅读顺序",
        "  - 正式维护目录与职责划分",
        "  - 毕业设计阶段优先关注的材料",
        "- [ClawDesk 文档目录](C:/Users/ASUS/Desktop/openlaw/docs/document-catalog.md)",
        "  - 全部文档的分类总目录和跳转入口",
        "  - 每份文档当前的用途概览",
        "  - 答辩前和交接时最省时间的导航方式",
        "",
    ]

    groups: dict[str, list[Path]] = {}
    for path in sorted(DOCS.rglob("*.md")):
        if path.name in {"README.md", "document-catalog.md"}:
            continue
        folder = path.relative_to(DOCS).parts[0]
        groups.setdefault(folder, []).append(path)

    for folder in sorted(groups):
        sections.append(f"### {folder_label(folder)}")
        sections.append("")
        for path in groups[folder]:
            title = path.read_text(encoding="utf-8").splitlines()[0].removeprefix("# ").strip()
            sections.append(f"- [{title}](C:/Users/ASUS/Desktop/openlaw/{path.relative_to(ROOT).as_posix()})")
            for bullet in OVERVIEWS.get(path.name, []):
                sections.append(f"  - {bullet}")
        sections.append("")

    sections.extend(
        [
            "## 3. 说明",
            "",
            "- 当前文档已经按治理、需求、技术、接口、数据、运维、测试、用户手册、日志、进度跟踪完成分类。",
            "- 所有正式文档开头都统一采用中文“文档速览”，方便快速判断阅读价值。",
            "- 该目录适合作为答辩前、继续开发前和项目交接时的第一入口。",
        ]
    )

    return "\n".join(sections).rstrip() + "\n"


def build_readme() -> str:
    body = """
## 1. 文档定位

`docs` 是当前 ClawDesk 项目的正式文档主目录。

如果你想快速理解当前项目，建议先看：

1. `document-catalog.md`
2. `01-prd/graduation-current-implementation-and-future-direction.md`
3. `01-prd/graduation-design-mvp-scope.md`
4. `09-project-tracking/development-progress-and-tasks.md`

## 2. 当前目录结构

- [00-governance](C:/Users/ASUS/Desktop/openlaw/docs/00-governance)
- [01-prd](C:/Users/ASUS/Desktop/openlaw/docs/01-prd)
- [02-technical-design](C:/Users/ASUS/Desktop/openlaw/docs/02-technical-design)
- [03-api](C:/Users/ASUS/Desktop/openlaw/docs/03-api)
- [04-database](C:/Users/ASUS/Desktop/openlaw/docs/04-database)
- [05-deployment-ops](C:/Users/ASUS/Desktop/openlaw/docs/05-deployment-ops)
- [06-testing](C:/Users/ASUS/Desktop/openlaw/docs/06-testing)
- [07-user-guide](C:/Users/ASUS/Desktop/openlaw/docs/07-user-guide)
- [08-development-log](C:/Users/ASUS/Desktop/openlaw/docs/08-development-log)
- [09-project-tracking](C:/Users/ASUS/Desktop/openlaw/docs/09-project-tracking)

## 3. 高优先级入口

- [ClawDesk 文档目录](C:/Users/ASUS/Desktop/openlaw/docs/document-catalog.md)
- [毕业设计当前实现与后续方向说明](C:/Users/ASUS/Desktop/openlaw/docs/01-prd/graduation-current-implementation-and-future-direction.md)
- [毕业设计 MVP 范围说明](C:/Users/ASUS/Desktop/openlaw/docs/01-prd/graduation-design-mvp-scope.md)
- [开发进度与任务文档](C:/Users/ASUS/Desktop/openlaw/docs/09-project-tracking/development-progress-and-tasks.md)
- [开发总览与使用说明](C:/Users/ASUS/Desktop/openlaw/docs/09-project-tracking/开发总览与使用说明.md)
- [毕业设计 MVP 验收清单](C:/Users/ASUS/Desktop/openlaw/docs/06-testing/graduation-mvp-acceptance-checklist.md)
- [答辩演示数据准备清单](C:/Users/ASUS/Desktop/openlaw/docs/06-testing/demo-data-preparation-checklist.md)
- [答辩前走查 Runbook](C:/Users/ASUS/Desktop/openlaw/docs/06-testing/pre-defense-runbook.md)
- [毕业设计演示脚本](C:/Users/ASUS/Desktop/openlaw/docs/07-user-guide/graduation-demo-script.md)

## 4. 维护要求

1. 每份正式文档开头都保留“文档速览”
2. 代码变化后同步更新对应文档
3. 重要状态变化同步记录到开发日志或进度文档
4. 后续新增文档时优先放入对应分类目录
"""
    return build_doc(TITLE_OVERRIDES["README.md"], "README.md", body)


def update_references() -> None:
    md_files = list(ROOT.rglob("*.md"))
    for path in md_files:
        text = path.read_text(encoding="utf-8")
        original = text
        for old_path, new_path in PATH_REWRITES.items():
            text = text.replace(old_path, new_path)
        if text != original:
            path.write_text(text, encoding="utf-8")


def main() -> None:
    for tmp in DOCS.rglob("*.tmp.md"):
        tmp.unlink()

    for path in sorted(DOCS.rglob("*.md")):
        rewrite_or_clean(path)

    (DOCS / "README.md").write_text(build_readme(), encoding="utf-8")
    (DOCS / "document-catalog.md").write_text(build_catalog(), encoding="utf-8")
    update_references()


if __name__ == "__main__":
    main()
