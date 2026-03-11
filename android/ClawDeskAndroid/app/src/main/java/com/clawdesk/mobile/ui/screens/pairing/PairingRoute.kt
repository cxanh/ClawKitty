package com.clawdesk.mobile.ui.screens.pairing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.clawdesk.mobile.data.model.MobilePairingFlowDto
import com.clawdesk.mobile.data.model.MobilePairingStatusDto
import com.clawdesk.mobile.data.model.PairingRequestInput
import com.clawdesk.mobile.data.repository.MobileRepository
import com.clawdesk.mobile.ui.components.BulletList
import com.clawdesk.mobile.ui.components.ErrorCard
import com.clawdesk.mobile.ui.components.KeyValueRow
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard
import kotlinx.coroutines.launch

@Composable
fun PairingRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues(),
    onNavigateBack: () -> Unit
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    var flow by remember { mutableStateOf<MobilePairingFlowDto?>(null) }
    var status by remember { mutableStateOf<MobilePairingStatusDto?>(null) }
    var deviceName by remember { mutableStateOf("我的 Android 设备") }
    var sessionToken by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    suspend fun refresh() {
        repository.getPairingFlow().onSuccess { flow = it }
        repository.getPairingStatus().onSuccess {
            status = it
            if (sessionToken.isBlank()) {
                sessionToken = it.activePairingSession?.id ?: ""
            }
        }
    }

    LaunchedEffect(baseUrl) {
        refresh()
    }

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("配对中心", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里对齐桌面端的配对中心与审批流。移动端先承担轻量接入，不直接放开高风险控制。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "桌面状态") {
            KeyValueRow("Desktop ready", status?.desktopReady?.toString() ?: "加载中")
            KeyValueRow("Runtime ready", status?.runtimeReady?.toString() ?: "加载中")
            KeyValueRow("Relay ready", status?.relayReady?.toString() ?: "加载中")
            KeyValueRow("Active session", status?.hasActivePairingSession?.toString() ?: "加载中")
            KeyValueRow("Pending approvals", (status?.pendingApprovalCount ?: 0).toString())
            KeyValueRow("Transport", status?.pairingTransport ?: flow?.pairingTransport ?: "--")
        }

        SectionCard(title = "配对步骤", subtitle = "先在桌面端生成 session，再由移动端提交 pairing request。") {
            BulletList(flow?.steps?.map { "${it.title}（${it.owner}）" }.orEmpty())
        }

        SectionCard(title = "提交配对请求") {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = sessionToken,
                    onValueChange = { sessionToken = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Session token") }
                )
                OutlinedTextField(
                    value = deviceName,
                    onValueChange = { deviceName = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Device name") }
                )
                Button(
                    onClick = {
                        if (sessionToken.isBlank()) {
                            message = "请先在桌面端生成 pairing session。"
                        } else {
                            scope.launch {
                                repository.submitPairingRequest(
                                    PairingRequestInput(
                                        sessionToken = sessionToken,
                                        clientType = "android",
                                        deviceName = deviceName,
                                        requestedScopes = listOf(
                                            "device.read",
                                            "task.read",
                                            "logs.read",
                                            "relay.read",
                                            "alerts.read"
                                        )
                                    )
                                ).onSuccess {
                                    message = "配对请求已提交：${it.id}"
                                    refresh()
                                }.onFailure {
                                    message = it.message ?: "配对请求提交失败"
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("提交配对请求")
                }
            }
        }

        if (message != null) {
            ErrorCard(message ?: "")
        }

        Button(onClick = onNavigateBack, modifier = Modifier.fillMaxWidth()) {
            Text("返回")
        }
    }
}
