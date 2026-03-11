package com.clawdesk.mobile.ui.screens.devices

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
import com.clawdesk.mobile.data.model.stringList
import com.clawdesk.mobile.data.repository.MobileRepository
import com.clawdesk.mobile.ui.components.BulletList
import com.clawdesk.mobile.ui.components.EmptyStateCard
import com.clawdesk.mobile.ui.components.ErrorCard
import com.clawdesk.mobile.ui.components.KeyValueRow
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard
import com.clawdesk.mobile.ui.components.formatIsoTime
import kotlinx.serialization.json.JsonObject

@Composable
fun DevicesRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues()
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    var devices by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var pairingCenter by remember { mutableStateOf<JsonObject?>(null) }
    var pairingAudit by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(baseUrl) {
        repository.getDevices().onSuccess { devices = it.objectList() }.onFailure { error = it.message }
        repository.getPairingCenter().onSuccess { pairingCenter = it }.onFailure { if (error == null) error = it.message }
        repository.getPairingAudit().onSuccess { pairingAudit = it.objectList() }.onFailure { if (error == null) error = it.message }
    }

    val pairedDevices = pairingCenter?.optObject("pairedDevices")

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("Devices", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里同步桌面端的设备面板，重点保留多设备数量、配对中心和最近配对审计。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "多设备摘要") {
            KeyValueRow("设备总数", pairedDevices?.optString("total") ?: devices.size.toString())
            KeyValueRow("已批准", pairedDevices?.optString("approved") ?: "0")
            KeyValueRow("待处理", pairedDevices?.optString("pending") ?: "0")
            KeyValueRow("近期活跃", pairedDevices?.optString("recent") ?: "0")
        }

        SectionCard(title = "Pairing Center") {
            KeyValueRow("Approval mode", pairingCenter?.optString("approvalMode") ?: "--")
            KeyValueRow("Transport", pairingCenter?.optString("transport") ?: "--")
            KeyValueRow("Runtime ready", pairingCenter?.optString("runtimeReady") ?: "--")
            KeyValueRow("Relay ready", pairingCenter?.optString("relayReady") ?: "--")
            BulletList(pairingCenter?.stringList("nextSteps").orEmpty())
        }

        if (devices.isEmpty()) {
            EmptyStateCard("设备列表为空", "当前还没有已配对设备，后续可通过桌面端 Pairing Center 接入。")
        } else {
            SectionCard(title = "设备列表", subtitle = "移动端先以只读方式同步桌面端的多设备状态。") {
                androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    devices.take(6).forEach { device ->
                        androidx.compose.material3.Card(modifier = Modifier.fillMaxWidth()) {
                            androidx.compose.foundation.layout.Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(device.optString("deviceId") ?: "--")
                                Text("平台：${device.optString("platform") ?: "--"}")
                                Text("客户端：${device.optString("clientId") ?: "--"}")
                                Text("模式：${device.optString("clientMode") ?: "--"}")
                                Text("最近使用：${formatIsoTime(device.optString("lastUsedAt"))}")
                            }
                        }
                    }
                }
            }
        }

        if (pairingAudit.isNotEmpty()) {
            SectionCard(title = "最近配对审计") {
                androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    pairingAudit.take(5).forEach { item ->
                        androidx.compose.material3.Card(modifier = Modifier.fillMaxWidth()) {
                            androidx.compose.foundation.layout.Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(item.optString("summary") ?: item.optString("kind") ?: "--")
                                Text("Actor：${item.optString("actor") ?: "--"}")
                                Text("时间：${formatIsoTime(item.optString("timestamp"))}")
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
