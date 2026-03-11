package com.clawdesk.mobile.data.api

import com.clawdesk.mobile.data.model.ApiEnvelope
import com.clawdesk.mobile.data.model.ChatSendMessageInput
import com.clawdesk.mobile.data.model.MobileAlertsSummaryDto
import com.clawdesk.mobile.data.model.MobileAuthBoundaryDto
import com.clawdesk.mobile.data.model.MobileBootstrapDto
import com.clawdesk.mobile.data.model.MobileOverviewDto
import com.clawdesk.mobile.data.model.MobilePairingFlowDto
import com.clawdesk.mobile.data.model.MobilePairingStatusDto
import com.clawdesk.mobile.data.model.PairingPendingApprovalDto
import com.clawdesk.mobile.data.model.PairingRequestInput
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject

interface MobileApi {
    @GET("api/v1/mobile/bootstrap")
    suspend fun getBootstrap(): ApiEnvelope<MobileBootstrapDto>

    @GET("api/v1/mobile/overview")
    suspend fun getOverview(): ApiEnvelope<MobileOverviewDto>

    @GET("api/v1/mobile/alerts-summary")
    suspend fun getAlertsSummary(): ApiEnvelope<MobileAlertsSummaryDto>

    @GET("api/v1/mobile/auth-boundary")
    suspend fun getAuthBoundary(): ApiEnvelope<MobileAuthBoundaryDto>

    @GET("api/v1/mobile/pairing-flow")
    suspend fun getPairingFlow(): ApiEnvelope<MobilePairingFlowDto>

    @GET("api/v1/mobile/pairing-status")
    suspend fun getPairingStatus(): ApiEnvelope<MobilePairingStatusDto>

    @POST("api/v1/mobile/pairing-request")
    suspend fun submitPairingRequest(@Body body: PairingRequestInput): ApiEnvelope<PairingPendingApprovalDto>

    @GET("api/v1/chat/bootstrap")
    suspend fun getChatBootstrap(): ApiEnvelope<JsonObject>

    @GET("api/v1/chat/conversations")
    suspend fun getChatConversations(): ApiEnvelope<JsonArray>

    @GET("api/v1/chat/conversations/{conversationId}")
    suspend fun getChatConversation(@Path("conversationId") conversationId: String): ApiEnvelope<JsonObject>

    @POST("api/v1/chat/messages")
    suspend fun sendChatMessage(@Body body: ChatSendMessageInput): ApiEnvelope<JsonObject>

    @GET("api/v1/agent-tasks")
    suspend fun getAgentTasks(): ApiEnvelope<JsonObject>

    @GET("api/v1/agent-safe-actions")
    suspend fun getAgentSafeActions(): ApiEnvelope<JsonObject>

    @GET("api/v1/agent-reminder-plans")
    suspend fun getReminderPlans(): ApiEnvelope<JsonObject>

    @GET("api/v1/agent-study-roadmaps")
    suspend fun getStudyRoadmaps(): ApiEnvelope<JsonObject>

    @GET("api/v1/agent-file-workspaces")
    suspend fun getFileWorkspaces(): ApiEnvelope<JsonObject>

    @GET("api/v1/agent-course-schedule")
    suspend fun getCourseSchedule(): ApiEnvelope<JsonObject>

    @GET("api/v1/activity")
    suspend fun getActivity(@Query("limit") limit: Int = 40): ApiEnvelope<JsonObject>

    @GET("api/v1/capabilities")
    suspend fun getCapabilities(): ApiEnvelope<JsonObject>

    @GET("api/v1/permissions")
    suspend fun getPermissions(): ApiEnvelope<JsonObject>

    @GET("api/v1/devices")
    suspend fun getDevices(): ApiEnvelope<JsonArray>

    @GET("api/v1/devices/pairing-center")
    suspend fun getPairingCenter(): ApiEnvelope<JsonObject>

    @GET("api/v1/devices/pairing-audit")
    suspend fun getPairingAudit(@Query("limit") limit: Int = 10): ApiEnvelope<JsonArray>

    companion object {
        fun create(baseUrl: String): MobileApi {
            val json = Json {
                ignoreUnknownKeys = true
                explicitNulls = false
            }
            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BASIC
            }
            val client = OkHttpClient.Builder()
                .addInterceptor(logging)
                .build()

            return Retrofit.Builder()
                .baseUrl(baseUrl.ensureTrailingSlash())
                .client(client)
                .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
                .build()
                .create(MobileApi::class.java)
        }

        private fun String.ensureTrailingSlash(): String {
            return if (endsWith('/')) this else "$this/"
        }
    }
}
