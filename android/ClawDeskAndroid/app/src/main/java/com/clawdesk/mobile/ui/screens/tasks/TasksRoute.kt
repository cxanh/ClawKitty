package com.clawdesk.mobile.ui.screens.tasks

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.clawdesk.mobile.data.model.objectList
import com.clawdesk.mobile.data.model.optArray
import com.clawdesk.mobile.data.model.optInt
import com.clawdesk.mobile.data.model.optString
import com.clawdesk.mobile.data.repository.MobileRepository
import com.clawdesk.mobile.ui.components.EmptyStateCard
import com.clawdesk.mobile.ui.components.ErrorCard
import com.clawdesk.mobile.ui.components.KeyValueRow
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard
import com.clawdesk.mobile.ui.components.formatIsoTime
import kotlinx.serialization.json.JsonObject

@Composable
fun TasksRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues()
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    var taskBoard by remember { mutableStateOf<JsonObject?>(null) }
    var safeActions by remember { mutableStateOf<JsonObject?>(null) }
    var reminderPlans by remember { mutableStateOf<JsonObject?>(null) }
    var studyRoadmaps by remember { mutableStateOf<JsonObject?>(null) }
    var fileWorkspaces by remember { mutableStateOf<JsonObject?>(null) }
    var courseSchedule by remember { mutableStateOf<JsonObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun refresh() {
        error = null
        repository.getAgentTasks().onSuccess { taskBoard = it }.onFailure { error = it.message }
        repository.getAgentSafeActions().onSuccess { safeActions = it }.onFailure { if (error == null) error = it.message }
        repository.getReminderPlans().onSuccess { reminderPlans = it }.onFailure { if (error == null) error = it.message }
        repository.getStudyRoadmaps().onSuccess { studyRoadmaps = it }.onFailure { if (error == null) error = it.message }
        repository.getFileWorkspaces().onSuccess { fileWorkspaces = it }.onFailure { if (error == null) error = it.message }
        repository.getCourseSchedule().onSuccess { courseSchedule = it }.onFailure { if (error == null) error = it.message }
    }

    LaunchedEffect(baseUrl) {
        refresh()
    }

    val taskItems = taskBoard?.optArray("tasks")?.objectList().orEmpty()
    val actionItems = safeActions?.optArray("actions")?.objectList().orEmpty()
    val reminderItems = reminderPlans?.optArray("plans")?.objectList().orEmpty()
    val roadmapItems = studyRoadmaps?.optArray("roadmaps")?.objectList().orEmpty()
    val workspaceItems = fileWorkspaces?.optArray("workspaces")?.objectList().orEmpty()
    val courseEntries = courseSchedule?.optArray("entries")?.objectList().orEmpty()

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("任务中心", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里同步桌面端任务工作台：Agent 任务卡、安全动作、提醒计划、学习路线图、文件工作台和课表。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "总体摘要") {
            KeyValueRow("Agent 任务卡", (taskBoard?.optInt("total") ?: 0).toString())
            KeyValueRow("Safe actions", (safeActions?.optInt("total") ?: 0).toString())
            KeyValueRow("Reminder plans", (reminderPlans?.optInt("total") ?: 0).toString())
            KeyValueRow("Study roadmaps", (studyRoadmaps?.optInt("total") ?: 0).toString())
            KeyValueRow("File workspaces", (fileWorkspaces?.optInt("total") ?: 0).toString())
            KeyValueRow("课表条目", (courseSchedule?.optInt("total") ?: 0).toString())
        }

        renderJsonListSection(
            title = "Agent 任务卡",
            items = taskItems,
            emptySummary = "桌面端创建的任务卡会在这里同步显示。"
        ) { item ->
            listOf(
                "标题：${item.optString("title") ?: "--"}",
                "状态：${item.optString("status") ?: "--"}",
                "来源：${item.optString("sourceReplyMode") ?: "--"}",
                "更新时间：${formatIsoTime(item.optString("updatedAt"))}"
            )
        }

        renderJsonListSection(
            title = "安全动作",
            items = actionItems,
            emptySummary = "课程提醒草稿、文件整理简报、学习计划草稿会在这里同步。"
        ) { item ->
            listOf(
                "标题：${item.optString("title") ?: "--"}",
                "类型：${item.optString("kind") ?: "--"}",
                "状态：${item.optString("status") ?: "--"}",
                "下一步：${item.optArray("nextSteps")?.size ?: 0} 条"
            )
        }

        renderJsonListSection(
            title = "提醒计划",
            items = reminderItems,
            emptySummary = "桌面端生成的 reminder plan 会在这里看到。"
        ) { item ->
            listOf(
                "标题：${item.optString("title") ?: "--"}",
                "类型：${item.optString("kind") ?: "--"}",
                "状态：${item.optString("status") ?: "--"}",
                "提醒窗口：${item.optArray("reminderWindows")?.size ?: 0} 个"
            )
        }

        renderJsonListSection(
            title = "学习路线图",
            items = roadmapItems,
            emptySummary = "学习路线图用于展示编程语言等长期学习目标。"
        ) { item ->
            listOf(
                "标题：${item.optString("title") ?: "--"}",
                "状态：${item.optString("status") ?: "--"}",
                "里程碑：${item.optArray("milestones")?.size ?: 0} 个",
                "周计划：${item.optArray("weeklyPlan")?.size ?: 0} 周"
            )
        }

        renderJsonListSection(
            title = "文件工作台",
            items = workspaceItems,
            emptySummary = "文件工作台会同步显示搜索根目录、分组视图和整理建议。"
        ) { item ->
            listOf(
                "标题：${item.optString("title") ?: "--"}",
                "状态：${item.optString("status") ?: "--"}",
                "搜索根目录：${item.optArray("searchRoots")?.size ?: 0} 个",
                "事件视图：${item.optArray("eventViews")?.size ?: 0} 个"
            )
        }

        renderJsonListSection(
            title = "课程表",
            items = courseEntries,
            emptySummary = "课程提醒的课表数据会在这里同步。"
        ) { item ->
            listOf(
                "课程：${item.optString("courseName") ?: "--"}",
                "星期：${item.optString("weekday") ?: "--"}",
                "时间：${item.optString("startTime") ?: "--"} - ${item.optString("endTime") ?: "--"}",
                "地点：${item.optString("location") ?: "--"}"
            )
        }

        if (!error.isNullOrBlank()) {
            ErrorCard(error ?: "")
        }
    }
}

@Composable
private fun renderJsonListSection(
    title: String,
    items: List<JsonObject>,
    emptySummary: String,
    describe: (JsonObject) -> List<String>
) {
    if (items.isEmpty()) {
        EmptyStateCard(title, emptySummary)
        return
    }

    SectionCard(title = title) {
        androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            items.take(4).forEach { item ->
                androidx.compose.material3.Card(modifier = Modifier.fillMaxWidth()) {
                    androidx.compose.foundation.layout.Column(
                        modifier = Modifier.padding(12.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        describe(item).forEach { line ->
                            Text(line)
                        }
                    }
                }
            }
        }
    }
}
