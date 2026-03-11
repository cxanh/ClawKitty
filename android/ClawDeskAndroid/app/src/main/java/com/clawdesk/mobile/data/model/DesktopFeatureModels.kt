package com.clawdesk.mobile.data.model

import kotlinx.serialization.Serializable

@Serializable
data class ApiErrorPayload(
    val code: String? = null,
    val message: String? = null
)

@Serializable
data class ChatSendMessageInput(
    val conversationId: String? = null,
    val content: String
)
