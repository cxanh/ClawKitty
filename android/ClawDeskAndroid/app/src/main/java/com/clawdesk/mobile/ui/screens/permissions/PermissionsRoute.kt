package com.clawdesk.mobile.ui.screens.permissions

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
import com.clawdesk.mobile.data.model.optObject
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
fun PermissionsRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues()
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    var payload by remember { mutableStateOf<JsonObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(baseUrl) {
        repository.getPermissions().onSuccess { payload = it }.onFailure { error = it.message }
    }

    val defaults = payload?.optArray("riskDefaults")?.objectList().orEmpty()
    val toolPolicies = payload?.optArray("toolPolicies")?.objectList().orEmpty()
    val pending = payload?.optArray("pendingRequests")?.objectList().orEmpty()
    val history = payload?.optArray("approvalHistory")?.objectList().orEmpty()
    val deviceSnapshot = payload?.optObject("deviceSnapshot")

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("Permissions", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里对齐桌面端的权限与审批边界：默认风险策略、工具级策略、待审批请求和审批历史。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "设备权限概览") {
            KeyValueRow("设备总数", deviceSnapshot?.optString("total") ?: "0")
            KeyValueRow("已批准", deviceSnapshot?.optString("approved") ?: "0")
            KeyValueRow("部分批准", deviceSnapshot?.optString("partial") ?: "0")
            KeyValueRow("待处理", deviceSnapshot?.optString("pending") ?: "0")
        }

        renderPermissionSection(
            title = "默认风险策略",
            items = defaults,
            emptySummary = "当前没有默认风险策略。"
        ) { item ->
            listOf(
                "风险级别：${item.optString("risk") ?: "--"}",
                "策略：${item.optString("policy") ?: "--"}",
                "说明：${item.optString("description") ?: "--"}"
            )
        }

        renderPermissionSection(
            title = "工具策略",
            items = toolPolicies,
            emptySummary = "当前没有工具级策略。"
        ) { item ->
            listOf(
                "工具：${item.optString("displayName") ?: item.optString("toolId") ?: "--"}",
                "风险：${item.optString("risk") ?: "--"}",
                "当前策略：${item.optString("policy") ?: "--"}",
                "推荐策略：${item.optString("recommendedPolicy") ?: "--"}"
            )
        }

        renderPermissionSection(
            title = "待审批请求",
            items = pending,
            emptySummary = "当前没有待审批请求。"
        ) { item ->
            listOf(
                "标题：${item.optString("title") ?: "--"}",
                "动作：${item.optString("actionType") ?: "--"}",
                "风险：${item.optString("risk") ?: "--"}",
                "目标：${item.optString("targetLabel") ?: "--"}"
            )
        }

        renderPermissionSection(
            title = "审批历史",
            items = history,
            emptySummary = "当前没有审批历史。"
        ) { item ->
            listOf(
                "标题：${item.optString("title") ?: "--"}",
                "决策：${item.optString("decision") ?: "--"}",
                "执行人：${item.optString("actor") ?: "--"}",
                "时间：${formatIsoTime(item.optString("timestamp"))}"
            )
        }

        if (!error.isNullOrBlank()) {
            ErrorCard(error ?: "")
        }
    }
}

@Composable
private fun renderPermissionSection(
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
            items.take(6).forEach { item ->
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
