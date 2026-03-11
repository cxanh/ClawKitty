package com.clawdesk.mobile.data.model

import kotlinx.serialization.Serializable

@Serializable
data class ApiEnvelope<T>(
    val success: Boolean,
    val data: T? = null,
    val error: ApiErrorPayload? = null,
    val message: String? = null
)

@Serializable
data class MobileOverviewDto(
    val generatedAt: String,
    val runtime: MobileRuntimeSummary,
    val host: MobileHostSummary,
    val pairedDevices: MobileDeviceSummary,
    val tasks: MobileTaskSummary,
    val browserRelay: MobileRelaySummary,
    val alerts: MobileAlertsOverview
)

@Serializable
data class MobileBootstrapDto(
    val generatedAt: String,
    val runtime: MobileRuntimeSummary,
    val system: MobileSystemSummary,
    val openclaw: MobileOpenClawSummary,
    val pairedDevices: MobileBootstrapDevicesSummary,
    val tasks: MobileBootstrapTasksSummary,
    val browserRelay: MobileBootstrapRelaySummary,
    val authBoundary: MobileAuthBoundaryDto
)

@Serializable
data class MobileRuntimeSummary(
    val status: String,
    val collectorStatus: String,
    val openclawCoreStatus: String,
    val browserRelayStatus: String,
    val uptimeSec: Long
)

@Serializable
data class MobileHostSummary(
    val hostname: String,
    val deviceId: String,
    val platform: String,
    val lastHeartbeatAt: String
)

@Serializable
data class MobileSystemSummary(
    val hostname: String,
    val deviceId: String,
    val platform: String,
    val cpu: Map<String, String> = emptyMap(),
    val memory: Map<String, String> = emptyMap()
)

@Serializable
data class MobileOpenClawSummary(
    val bridgeStatus: String,
    val providers: Int,
    val authProfiles: Int,
    val sessions: Int,
    val tasks: Int
)

@Serializable
data class MobileDeviceSummary(
    val total: Int,
    val approved: Int,
    val pending: Int,
    val recent: Int,
    val stale: Int
)

@Serializable
data class MobileTaskSummary(
    val total: Int,
    val enabled: Int,
    val error: Int,
    val running: Int
)

@Serializable
data class MobileRelaySummary(
    val relayStatus: String,
    val relayAuthStatus: String,
    val extensionConnected: Boolean,
    val targetCount: Int
)

@Serializable
data class MobileAlertsOverview(
    val total: Int,
    val error: Int,
    val warn: Int,
    val latestMessage: String? = null,
    val latestTimestamp: String? = null
)

@Serializable
data class MobileAlertsSummaryDto(
    val generatedAt: String,
    val total: Int,
    val warnCount: Int,
    val errorCount: Int,
    val latest: List<MobileAlertEntryDto>
)

@Serializable
data class MobileAlertEntryDto(
    val level: String,
    val timestamp: String,
    val message: String
)

@Serializable
data class MobilePairingFlowDto(
    val generatedAt: String,
    val supportedClients: List<String>,
    val approvalMode: String,
    val pairingTransport: String,
    val requiredDesktopActions: List<String>,
    val requiredMobileActions: List<String>,
    val defaultScopes: List<String>,
    val optionalScopes: List<String>,
    val writeScopesPlanned: List<String>,
    val restrictedActions: List<String>,
    val steps: List<PairingFlowStep>,
    val notes: List<String>
)

@Serializable
data class PairingFlowStep(
    val id: String,
    val title: String,
    val owner: String,
    val status: String,
    val summary: String
)

@Serializable
data class MobilePairingStatusDto(
    val generatedAt: String,
    val approvalMode: String,
    val pairingTransport: String,
    val runtimeReady: Boolean,
    val relayReady: Boolean,
    val desktopReady: Boolean,
    val hasActivePairingSession: Boolean,
    val activePairingSession: PairingSessionDto? = null,
    val pendingApprovalCount: Int,
    val recentAudit: List<PairingAuditEntryDto>,
    val supportedClients: List<String>,
    val supportedScopes: List<String>,
    val plannedWriteScopes: List<String>,
    val notes: List<String>
)

@Serializable
data class MobileAuthBoundaryDto(
    val pairingRequired: Boolean,
    val supportedClients: List<String>,
    val recommendedPollIntervalSec: Int,
    val supportedScopes: List<String>,
    val plannedWriteScopes: List<String>,
    val restrictedActions: List<String>,
    val notes: List<String>
)

@Serializable
data class PairingSessionDto(
    val id: String,
    val token: String,
    val expiresAt: String,
    val qrPayload: String,
    val transport: String,
    val supportedClients: List<String>,
    val requestedScopes: List<String>
)

@Serializable
data class PairingAuditEntryDto(
    val id: String,
    val kind: String,
    val actor: String,
    val timestamp: String,
    val summary: String,
    val requestId: String? = null,
    val deviceId: String? = null
)

@Serializable
data class PairingRequestInput(
    val sessionToken: String,
    val clientType: String,
    val deviceName: String,
    val requestedScopes: List<String>
)

@Serializable
data class PairingPendingApprovalDto(
    val id: String,
    val clientType: String,
    val deviceName: String,
    val requestedScopes: List<String>,
    val status: String,
    val createdAt: String
)

@Serializable
data class MobileBootstrapDevicesSummary(
    val total: Int,
    val approved: Int,
    val pending: Int,
    val recentCount: Int,
    val staleCount: Int,
    val recent: List<Map<String, String>> = emptyList()
)

@Serializable
data class MobileBootstrapTasksSummary(
    val total: Int,
    val enabled: Int,
    val error: Int,
    val running: Int,
    val recent: List<Map<String, String>> = emptyList()
)

@Serializable
data class MobileBootstrapRelaySummary(
    val relayStatus: String,
    val relayAuthStatus: String,
    val extensionConnected: Boolean,
    val targetCount: Int,
    val checkedAt: String
)
