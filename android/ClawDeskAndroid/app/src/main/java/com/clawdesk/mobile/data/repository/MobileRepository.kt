package com.clawdesk.mobile.data.repository

import com.clawdesk.mobile.BuildConfig
import com.clawdesk.mobile.data.api.MobileApi
import com.clawdesk.mobile.data.model.ChatSendMessageInput
import com.clawdesk.mobile.data.model.MobileAlertsSummaryDto
import com.clawdesk.mobile.data.model.MobileAuthBoundaryDto
import com.clawdesk.mobile.data.model.MobileBootstrapDto
import com.clawdesk.mobile.data.model.MobileOverviewDto
import com.clawdesk.mobile.data.model.MobilePairingFlowDto
import com.clawdesk.mobile.data.model.MobilePairingStatusDto
import com.clawdesk.mobile.data.model.PairingPendingApprovalDto
import com.clawdesk.mobile.data.model.PairingRequestInput
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

class MobileRepository(
    baseUrl: String = BuildConfig.DEFAULT_BASE_URL,
    private val api: MobileApi = MobileApi.create(baseUrl)
) {
    private fun resolveMessage(message: String?, fallback: String, apiMessage: String?, errorMessage: String?): String {
        return message ?: apiMessage ?: errorMessage ?: fallback
    }

    suspend fun getBootstrap(): Result<MobileBootstrapDto> {
        return runCatching {
            api.getBootstrap().data ?: error("Missing bootstrap payload")
        }
    }

    suspend fun getOverview(): Result<MobileOverviewDto> {
        return runCatching {
            api.getOverview().data ?: error("Missing overview payload")
        }
    }

    suspend fun getAlertsSummary(): Result<MobileAlertsSummaryDto> {
        return runCatching {
            api.getAlertsSummary().data ?: error("Missing alerts summary payload")
        }
    }

    suspend fun getAuthBoundary(): Result<MobileAuthBoundaryDto> {
        return runCatching {
            api.getAuthBoundary().data ?: error("Missing auth boundary payload")
        }
    }

    suspend fun getPairingFlow(): Result<MobilePairingFlowDto> {
        return runCatching {
            api.getPairingFlow().data ?: error("Missing pairing flow payload")
        }
    }

    suspend fun getPairingStatus(): Result<MobilePairingStatusDto> {
        return runCatching {
            api.getPairingStatus().data ?: error("Missing pairing status payload")
        }
    }

    suspend fun submitPairingRequest(body: PairingRequestInput): Result<PairingPendingApprovalDto> {
        return runCatching {
            val response = api.submitPairingRequest(body)
            check(response.success) {
                resolveMessage(
                    response.error?.message,
                    "Pairing request failed",
                    response.message,
                    null
                )
            }
            response.data ?: error("Missing pairing request payload")
        }
    }

    suspend fun getChatBootstrap(): Result<JsonObject> = runCatching {
        val response = api.getChatBootstrap()
        check(response.success) { resolveMessage(response.error?.message, "Missing chat bootstrap payload", response.message, null) }
        response.data ?: error("Missing chat bootstrap payload")
    }

    suspend fun getChatConversations(): Result<JsonArray> = runCatching {
        val response = api.getChatConversations()
        check(response.success) { resolveMessage(response.error?.message, "Missing chat conversations payload", response.message, null) }
        response.data ?: error("Missing chat conversations payload")
    }

    suspend fun getChatConversation(conversationId: String): Result<JsonObject> = runCatching {
        val response = api.getChatConversation(conversationId)
        check(response.success) { resolveMessage(response.error?.message, "Missing chat conversation payload", response.message, null) }
        response.data ?: error("Missing chat conversation payload")
    }

    suspend fun sendChatMessage(conversationId: String?, content: String): Result<JsonObject> = runCatching {
        val response = api.sendChatMessage(ChatSendMessageInput(conversationId = conversationId, content = content))
        check(response.success) { resolveMessage(response.error?.message, "Chat send failed", response.message, null) }
        response.data ?: error("Missing chat send payload")
    }

    suspend fun getAgentTasks(): Result<JsonObject> = runCatching {
        val response = api.getAgentTasks()
        check(response.success) { resolveMessage(response.error?.message, "Missing agent tasks payload", response.message, null) }
        response.data ?: error("Missing agent tasks payload")
    }

    suspend fun getAgentSafeActions(): Result<JsonObject> = runCatching {
        val response = api.getAgentSafeActions()
        check(response.success) { resolveMessage(response.error?.message, "Missing safe actions payload", response.message, null) }
        response.data ?: error("Missing safe actions payload")
    }

    suspend fun getReminderPlans(): Result<JsonObject> = runCatching {
        val response = api.getReminderPlans()
        check(response.success) { resolveMessage(response.error?.message, "Missing reminder plans payload", response.message, null) }
        response.data ?: error("Missing reminder plans payload")
    }

    suspend fun getStudyRoadmaps(): Result<JsonObject> = runCatching {
        val response = api.getStudyRoadmaps()
        check(response.success) { resolveMessage(response.error?.message, "Missing study roadmaps payload", response.message, null) }
        response.data ?: error("Missing study roadmaps payload")
    }

    suspend fun getFileWorkspaces(): Result<JsonObject> = runCatching {
        val response = api.getFileWorkspaces()
        check(response.success) { resolveMessage(response.error?.message, "Missing file workspaces payload", response.message, null) }
        response.data ?: error("Missing file workspaces payload")
    }

    suspend fun getCourseSchedule(): Result<JsonObject> = runCatching {
        val response = api.getCourseSchedule()
        check(response.success) { resolveMessage(response.error?.message, "Missing course schedule payload", response.message, null) }
        response.data ?: error("Missing course schedule payload")
    }

    suspend fun getActivity(limit: Int = 40): Result<JsonObject> = runCatching {
        val response = api.getActivity(limit)
        check(response.success) { resolveMessage(response.error?.message, "Missing activity payload", response.message, null) }
        response.data ?: error("Missing activity payload")
    }

    suspend fun getCapabilities(): Result<JsonObject> = runCatching {
        val response = api.getCapabilities()
        check(response.success) { resolveMessage(response.error?.message, "Missing capabilities payload", response.message, null) }
        response.data ?: error("Missing capabilities payload")
    }

    suspend fun getPermissions(): Result<JsonObject> = runCatching {
        val response = api.getPermissions()
        check(response.success) { resolveMessage(response.error?.message, "Missing permissions payload", response.message, null) }
        response.data ?: error("Missing permissions payload")
    }

    suspend fun getDevices(): Result<JsonArray> = runCatching {
        val response = api.getDevices()
        check(response.success) { resolveMessage(response.error?.message, "Missing devices payload", response.message, null) }
        response.data ?: error("Missing devices payload")
    }

    suspend fun getPairingCenter(): Result<JsonObject> = runCatching {
        val response = api.getPairingCenter()
        check(response.success) { resolveMessage(response.error?.message, "Missing pairing center payload", response.message, null) }
        response.data ?: error("Missing pairing center payload")
    }

    suspend fun getPairingAudit(limit: Int = 10): Result<JsonArray> = runCatching {
        val response = api.getPairingAudit(limit)
        check(response.success) { resolveMessage(response.error?.message, "Missing pairing audit payload", response.message, null) }
        response.data ?: error("Missing pairing audit payload")
    }
}
