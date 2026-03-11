package com.clawdesk.mobile.ui.screens.more

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard

@Composable
fun MoreRoute(
    contentPadding: PaddingValues = PaddingValues(),
    onOpenCapabilities: () -> Unit,
    onOpenPermissions: () -> Unit,
    onOpenDevices: () -> Unit,
    onOpenPairing: () -> Unit,
    onOpenSettings: () -> Unit
) {
    MobileScreenColumn(contentPadding = contentPadding) {
        Text("更多模块", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里集中承接桌面端已经具备、但不适合全部放进底部导航的能力模块。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "能力与安全") {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onOpenCapabilities, modifier = Modifier.fillMaxWidth()) { Text("Capabilities") }
                Button(onClick = onOpenPermissions, modifier = Modifier.fillMaxWidth()) { Text("Permissions") }
            }
        }

        SectionCard(title = "设备与连接") {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onOpenDevices, modifier = Modifier.fillMaxWidth()) { Text("Devices") }
                Button(onClick = onOpenPairing, modifier = Modifier.fillMaxWidth()) { Text("Pairing") }
            }
        }

        SectionCard(title = "配置") {
            OutlinedButton(onClick = onOpenSettings, modifier = Modifier.fillMaxWidth()) { Text("Settings") }
        }
    }
}
