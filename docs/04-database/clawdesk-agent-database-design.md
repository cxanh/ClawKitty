# ClawDesk 数据设计文档

## 文档速览

这份文档专门说明：
- 当前数据存储设计与核心实体
- 本地数据目录和主要数据文件
- 后续升级存储时的边界约束

最后更新：2026-03-12


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
