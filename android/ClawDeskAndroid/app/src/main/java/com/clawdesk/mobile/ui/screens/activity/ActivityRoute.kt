package com.clawdesk.mobile.ui.screens.activity

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
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
import com.clawdesk.mobile.data.model.optString
import com.clawdesk.mobile.data.repository.MobileRepository
import com.clawdesk.mobile.ui.components.EmptyStateCard
import com.clawdesk.mobile.ui.components.ErrorCard
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard
import com.clawdesk.mobile.ui.components.formatIsoTime
import com.clawdesk.mobile.ui.components.shorten
import kotlinx.serialization.json.JsonObject

private enum class ActivityFilter(val label: String) {
    All("全部"),
    Agent("Agent"),
    Approvals("审批"),
    Reminders("提醒"),
    Files("文件"),
    System("系统")
}

@Composable
fun ActivityRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues()
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    var activityPayload by remember { mutableStateOf<JsonObject?>(null) }
    var filter by remember { mutableStateOf(ActivityFilter.All) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun refresh() {
        repository.getActivity().onSuccess { activityPayload = it }.onFailure { error = it.message }
    }

    LaunchedEffect(baseUrl) {
        refresh()
    }

    val allItems = activityPayload?.optArray("items")?.objectList().orEmpty()
    val filteredItems = allItems.filter { matchesFilter(it, filter) }

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("活动时间线", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里对应桌面端的 Activity Feed，用来回答“Agent 刚刚做了什么”。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "筛选") {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ActivityFilter.entries.forEach { option ->
                    Button(
                        onClick = { filter = option },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(if (filter == option) "当前：${option.label}" else option.label)
                    }
                }
            }
        }

        if (filteredItems.isEmpty()) {
            EmptyStateCard("暂无活动", "当前筛选下还没有活动记录。")
        } else {
            SectionCard(title = "活动列表", subtitle = "共 ${filteredItems.size} 条") {
                androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    filteredItems.take(20).forEach { item ->
                        androidx.compose.material3.Card(modifier = Modifier.fillMaxWidth()) {
                            androidx.compose.foundation.layout.Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(item.optString("title") ?: item.optString("kind") ?: "未命名活动")
                                Text(shorten(item.optString("summary")), color = MaterialTheme.colorScheme.onSurfaceVariant)
                                Text("类别：${item.optString("kind") ?: "--"}")
                                Text("时间：${formatIsoTime(item.optString("occurredAt"))}")
                            }
                        }
                    }
                }
            }
        }

        if (!error.isNullOrBlank()) {
            ErrorCard(error ?: "")
        }
    }
}

private fun matchesFilter(item: JsonObject, filter: ActivityFilter): Boolean {
    if (filter == ActivityFilter.All) {
        return true
    }

    val kind = item.optString("kind").orEmpty()
    return when (filter) {
        ActivityFilter.All -> true
        ActivityFilter.Agent -> kind.startsWith("chat") || kind.startsWith("agent-task") || kind.startsWith("agent-safe-action")
        ActivityFilter.Approvals -> kind.startsWith("approval") || kind.startsWith("permission")
        ActivityFilter.Reminders -> kind.startsWith("agent-reminder") || kind.startsWith("agent-course-schedule")
        ActivityFilter.Files -> kind.startsWith("agent-file-workspace")
        ActivityFilter.System -> !kind.startsWith("chat") &&
            !kind.startsWith("agent-task") &&
            !kind.startsWith("agent-safe-action") &&
            !kind.startsWith("approval") &&
            !kind.startsWith("permission") &&
            !kind.startsWith("agent-reminder") &&
            !kind.startsWith("agent-course-schedule") &&
            !kind.startsWith("agent-file-workspace")
    }
}
