package com.clawdesk.mobile.ui.screens.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.clawdesk.mobile.BuildConfig
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard

@Composable
fun SettingsRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues(),
    onSaveBaseUrl: (String) -> Unit,
    onResetBaseUrl: () -> Unit
) {
    var input by remember(baseUrl) { mutableStateOf(baseUrl) }
    var message by remember { mutableStateOf<String?>(null) }

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("设置", style = MaterialTheme.typography.headlineSmall)
        Text(
            "先把移动端接到和桌面相同的 Runtime，再逐步同步各个模块能力。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "Runtime 连接") {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Base URL") }
                )
                Text("默认值：${BuildConfig.DEFAULT_BASE_URL}")
                Button(
                    onClick = {
                        onSaveBaseUrl(input)
                        message = "Base URL 已保存。"
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("保存 Base URL")
                }
                OutlinedButton(
                    onClick = {
                        onResetBaseUrl()
                        input = BuildConfig.DEFAULT_BASE_URL
                        message = "已恢复默认 Base URL。"
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("恢复默认值")
                }
            }
        }

        SectionCard(title = "连接建议") {
            Text("模拟器默认使用 10.0.2.2 连接本机桌面 Runtime。")
            Text("如果使用真机，请把 Base URL 改成电脑局域网 IP。")
        }

        if (!message.isNullOrBlank()) {
            SectionCard(title = "状态") {
                Text(message ?: "")
            }
        }
    }
}
