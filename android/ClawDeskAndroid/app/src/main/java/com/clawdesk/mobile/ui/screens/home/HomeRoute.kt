package com.clawdesk.mobile.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.clawdesk.mobile.data.model.MobileOverviewDto
import com.clawdesk.mobile.data.model.optArray
import com.clawdesk.mobile.data.model.optInt
import com.clawdesk.mobile.data.model.optObject
import com.clawdesk.mobile.data.repository.MobileRepository
import com.clawdesk.mobile.ui.components.ErrorCard
import com.clawdesk.mobile.ui.components.KeyValueRow
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard
import kotlinx.serialization.json.JsonObject

@Composable
fun HomeRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues(),
    onOpenChat: () -> Unit,
    onOpenTasks: () -> Unit,
    onOpenActivity: () -> Unit,
    onOpenPairing: () -> Unit,
    onOpenMore: () -> Unit
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    var overview by remember { mutableStateOf<MobileOverviewDto?>(null) }
    var chatBootstrap by remember { mutableStateOf<JsonObject?>(null) }
    var permissions by remember { mutableStateOf<JsonObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun refresh() {
        error = null
        repository.getOverview().onSuccess { overview = it }.onFailure { error = it.message }
        repository.getChatBootstrap().onSuccess { chatBootstrap = it }.onFailure {
            if (error == null) error = it.message
        }
        repository.getPermissions().onSuccess { permissions = it }.onFailure {
            if (error == null) error = it.message
        }
    }

    LaunchedEffect(baseUrl) {
        refresh()
    }

    val capabilitySnapshot = chatBootstrap?.optObject("capabilities")
    val conversationCount = chatBootstrap?.optArray("conversations")?.size ?: 0
    val starterPromptCount = chatBootstrap?.optArray("starterPrompts")?.size ?: 0
    val pendingApprovalCount = permissions?.optArray("pendingRequests")?.size ?: 0

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("ClawDesk Mobile", style = MaterialTheme.typography.headlineMedium)
        Text(
            "移动端优先同步桌面当前的核心主链路：首页总览、聊天、任务、活动、能力、权限与设备。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "当前连接") {
            KeyValueRow("Base URL", baseUrl)
            KeyValueRow("Runtime", overview?.runtime?.status ?: "加载中")
            KeyValueRow("Relay", overview?.browserRelay?.relayStatus ?: "加载中")
            KeyValueRow("设备数", (overview?.pairedDevices?.total ?: 0).toString())
            KeyValueRow("任务数", (overview?.tasks?.total ?: 0).toString())
            KeyValueRow("待审批", pendingApprovalCount.toString())
        }

        SectionCard(title = "Agent 总览") {
            KeyValueRow("对话数", conversationCount.toString())
            KeyValueRow("Starter prompts", starterPromptCount.toString())
            KeyValueRow("可用 Provider", (capabilitySnapshot?.optInt("providerCount") ?: 0).toString())
            KeyValueRow("已配对设备", (capabilitySnapshot?.optInt("pairedDeviceCount") ?: 0).toString())
        }

        SectionCard(title = "快捷入口", subtitle = "这里保持与桌面端主叙事一致。") {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onOpenChat, modifier = Modifier.fillMaxWidth()) { Text("进入聊天") }
                Button(onClick = onOpenTasks, modifier = Modifier.fillMaxWidth()) { Text("进入任务中心") }
                Button(onClick = onOpenActivity, modifier = Modifier.fillMaxWidth()) { Text("查看活动时间线") }
                OutlinedButton(onClick = onOpenPairing, modifier = Modifier.fillMaxWidth()) { Text("进入配对中心") }
                OutlinedButton(onClick = onOpenMore, modifier = Modifier.fillMaxWidth()) { Text("查看更多模块") }
            }
        }

        if (error != null) {
            ErrorCard("当前还没有连上桌面 Runtime：$error")
        }
    }
}
