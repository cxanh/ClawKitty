package com.clawdesk.mobile.ui.screens.capabilities

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
import com.clawdesk.mobile.data.model.optObject
import com.clawdesk.mobile.data.model.optString
import com.clawdesk.mobile.data.repository.MobileRepository
import com.clawdesk.mobile.ui.components.EmptyStateCard
import com.clawdesk.mobile.ui.components.ErrorCard
import com.clawdesk.mobile.ui.components.KeyValueRow
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard
import kotlinx.serialization.json.JsonObject

@Composable
fun CapabilitiesRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues()
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    var payload by remember { mutableStateOf<JsonObject?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(baseUrl) {
        repository.getCapabilities().onSuccess { payload = it }.onFailure { error = it.message }
    }

    val counts = payload?.optObject("counts")
    val models = payload?.optArray("models")?.objectList().orEmpty()
    val skills = payload?.optArray("skills")?.objectList().orEmpty()
    val tools = payload?.optArray("tools")?.objectList().orEmpty()

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("Capabilities", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里同步桌面端当前模型、Skill、Tool 的可用情况，并明确哪些是可用、部分可用或规划中。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "能力摘要") {
            KeyValueRow("模型数", (counts?.optInt("models") ?: 0).toString())
            KeyValueRow("可用 Skills", (counts?.optInt("availableSkills") ?: 0).toString())
            KeyValueRow("可用 Tools", (counts?.optInt("availableTools") ?: 0).toString())
        }

        renderCapabilitiesSection(
            title = "Models",
            items = models,
            emptySummary = "当前没有可用模型配置。"
        ) { item ->
            listOf(
                "名称：${item.optString("displayName") ?: item.optString("id") ?: "--"}",
                "Provider：${item.optString("providerId") ?: "--"}",
                "可用性：${item.optString("availability") ?: "--"}",
                "模型数：${item.optInt("modelCount") ?: 0}"
            )
        }

        renderCapabilitiesSection(
            title = "Skills",
            items = skills,
            emptySummary = "当前没有 Skill 数据。"
        ) { item ->
            listOf(
                "名称：${item.optString("displayName") ?: "--"}",
                "分类：${item.optString("category") ?: "--"}",
                "可用性：${item.optString("availability") ?: "--"}",
                "说明：${item.optString("summary") ?: "--"}"
            )
        }

        renderCapabilitiesSection(
            title = "Tools",
            items = tools,
            emptySummary = "当前没有 Tool 数据。"
        ) { item ->
            listOf(
                "名称：${item.optString("displayName") ?: "--"}",
                "可用性：${item.optString("availability") ?: "--"}",
                "风险：${item.optString("riskLevel") ?: "--"}",
                "当前策略：${item.optString("currentPolicy") ?: "--"}"
            )
        }

        if (!error.isNullOrBlank()) {
            ErrorCard(error ?: "")
        }
    }
}

@Composable
private fun renderCapabilitiesSection(
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
            items.take(5).forEach { item ->
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
