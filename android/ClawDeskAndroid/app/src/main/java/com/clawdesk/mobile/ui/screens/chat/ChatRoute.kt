package com.clawdesk.mobile.ui.screens.chat

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import com.clawdesk.mobile.data.model.objectList
import com.clawdesk.mobile.data.model.optArray
import com.clawdesk.mobile.data.model.optInt
import com.clawdesk.mobile.data.model.optObject
import com.clawdesk.mobile.data.model.optString
import com.clawdesk.mobile.data.model.summaryOrFallback
import com.clawdesk.mobile.data.repository.MobileRepository
import com.clawdesk.mobile.ui.components.BulletList
import com.clawdesk.mobile.ui.components.EmptyStateCard
import com.clawdesk.mobile.ui.components.ErrorCard
import com.clawdesk.mobile.ui.components.KeyValueRow
import com.clawdesk.mobile.ui.components.MobileScreenColumn
import com.clawdesk.mobile.ui.components.SectionCard
import com.clawdesk.mobile.ui.components.formatIsoTime
import com.clawdesk.mobile.ui.components.shorten
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

@Composable
fun ChatRoute(
    baseUrl: String,
    contentPadding: PaddingValues = PaddingValues()
) {
    val repository = remember(baseUrl) { MobileRepository(baseUrl) }
    val scope = rememberCoroutineScope()
    var bootstrap by remember { mutableStateOf<JsonObject?>(null) }
    var conversations by remember { mutableStateOf<List<JsonObject>>(emptyList()) }
    var selectedConversationId by remember { mutableStateOf<String?>(null) }
    var selectedConversation by remember { mutableStateOf<JsonObject?>(null) }
    var draft by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    suspend fun loadConversationDetail(conversationId: String?) {
        if (conversationId.isNullOrBlank()) {
            selectedConversation = null
            return
        }

        repository.getChatConversation(conversationId).onSuccess {
            selectedConversation = it
            selectedConversationId = conversationId
        }.onFailure {
            error = it.message
        }
    }

    suspend fun refresh() {
        error = null
        repository.getChatBootstrap().onSuccess { bootstrap = it }.onFailure { error = it.message }
        repository.getChatConversations().onSuccess {
            conversations = it.objectList()
            if (selectedConversationId == null && conversations.isNotEmpty()) {
                loadConversationDetail(conversations.first().optString("conversationId"))
            } else if (selectedConversationId != null) {
                loadConversationDetail(selectedConversationId)
            }
        }.onFailure {
            if (error == null) error = it.message
        }
    }

    LaunchedEffect(baseUrl) {
        refresh()
    }

    val starterPrompts = bootstrap?.optArray("starterPrompts")?.objectList().orEmpty()
    val capabilitySnapshot = bootstrap?.optObject("capabilities")
    val conversationMessages = selectedConversation?.optArray("messages")?.objectList().orEmpty()

    MobileScreenColumn(contentPadding = contentPadding) {
        Text("聊天", style = MaterialTheme.typography.headlineSmall)
        Text(
            "这里对齐桌面端的 Agent Chat 主链路：查看会话、发送消息、接收回复，并理解当前能力与审批提示。",
            style = MaterialTheme.typography.bodyLarge
        )

        SectionCard(title = "Chat snapshot") {
            KeyValueRow("Agent", bootstrap?.optString("agentDisplayName") ?: "ClawDesk Agent")
            KeyValueRow("会话数", conversations.size.toString())
            KeyValueRow("Provider 数", (capabilitySnapshot?.optInt("providerCount") ?: 0).toString())
            KeyValueRow("Starter prompts", starterPrompts.size.toString())
        }

        if (starterPrompts.isNotEmpty()) {
            SectionCard(title = "建议开场问题") {
                androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    starterPrompts.take(3).forEach { prompt ->
                        Button(
                            onClick = { draft = prompt.optString("prompt") ?: "" },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(prompt.optString("title") ?: "使用这个提示词")
                        }
                    }
                }
            }
        }

        SectionCard(title = "会话列表", subtitle = "点击任意会话查看详情。") {
            if (conversations.isEmpty()) {
                Text("当前还没有会话，直接发一条消息就会自动创建。")
            } else {
                androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    conversations.take(6).forEach { conversation ->
                        androidx.compose.material3.Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable {
                                    scope.launch {
                                        loadConversationDetail(conversation.optString("conversationId"))
                                    }
                                }
                        ) {
                            androidx.compose.foundation.layout.Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text(conversation.optString("title") ?: "未命名会话")
                                Text(shorten(conversation.summaryOrFallback("preview", "title")))
                                Text("更新时间：${formatIsoTime(conversation.optString("updatedAt"))}")
                            }
                        }
                    }
                }
            }
        }

        SectionCard(title = "发送消息") {
            androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("输入你想交给 Agent 的内容") }
                )
                Button(
                    onClick = {
                        if (draft.isBlank()) {
                            message = "请先输入消息内容。"
                        } else {
                            scope.launch {
                                repository.sendChatMessage(selectedConversationId, draft).onSuccess { result ->
                                    val conversation = result.optObject("conversation")
                                    selectedConversation = conversation
                                    selectedConversationId = conversation?.optString("conversationId")
                                    draft = ""
                                    val orchestration = result.optObject("orchestration")
                                    message = buildString {
                                        append("已发送。")
                                        append(" 回复模式：${result.optString("replyMode") ?: "--"}")
                                        if (orchestration != null) {
                                            append(" / 来源：${orchestration.optString("source") ?: "--"}")
                                        }
                                    }
                                    refresh()
                                }.onFailure {
                                    error = it.message
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("发送给 Agent")
                }
            }
        }

        if (selectedConversation == null) {
            EmptyStateCard("当前未选中会话", "先从会话列表点开一条，或者直接发一条消息新建会话。")
        } else {
            SectionCard(title = selectedConversation?.optString("title") ?: "会话详情") {
                KeyValueRow("消息数", conversationMessages.size.toString())
                KeyValueRow("更新时间", formatIsoTime(selectedConversation?.optString("updatedAt")))
                androidx.compose.foundation.layout.Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    conversationMessages.takeLast(8).forEach { item ->
                        val orchestration = item.optObject("orchestration")
                        val approvalHints = item.optArray("approvalHints")?.objectList().orEmpty()
                        androidx.compose.material3.Card(modifier = Modifier.fillMaxWidth()) {
                            androidx.compose.foundation.layout.Column(
                                modifier = Modifier.padding(12.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Text("${item.optString("role") ?: "assistant"} · ${formatIsoTime(item.optString("createdAt"))}")
                                Text(shorten(item.optString("content"), 180))
                                if (orchestration != null) {
                                    Text(
                                        "回复来源：${orchestration.optString("source") ?: "--"} / fallback：${orchestration.optString("fallbackReason") ?: "无"}",
                                        color = MaterialTheme.colorScheme.onSurfaceVariant
                                    )
                                }
                                if (approvalHints.isNotEmpty()) {
                                    BulletList(
                                        approvalHints.mapNotNull { hint ->
                                            hint.optString("summary")
                                        }
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }

        if (!message.isNullOrBlank()) {
            SectionCard(title = "最近动作") {
                Text(message ?: "")
            }
        }

        if (!error.isNullOrBlank()) {
            ErrorCard(error ?: "")
        }
    }
}
