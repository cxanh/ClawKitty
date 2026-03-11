package com.clawdesk.mobile.ui.navigation

import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.clawdesk.mobile.ui.screens.activity.ActivityRoute
import com.clawdesk.mobile.ui.screens.capabilities.CapabilitiesRoute
import com.clawdesk.mobile.ui.screens.chat.ChatRoute
import com.clawdesk.mobile.ui.screens.devices.DevicesRoute
import com.clawdesk.mobile.ui.screens.home.HomeRoute
import com.clawdesk.mobile.ui.screens.more.MoreRoute
import com.clawdesk.mobile.ui.screens.pairing.PairingRoute
import com.clawdesk.mobile.ui.screens.permissions.PermissionsRoute
import com.clawdesk.mobile.ui.screens.settings.SettingsRoute
import com.clawdesk.mobile.ui.screens.tasks.TasksRoute

@Composable
fun ClawDeskNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    contentPadding: PaddingValues = PaddingValues(),
    baseUrl: String,
    onSaveBaseUrl: (String) -> Unit,
    onResetBaseUrl: () -> Unit
) {
    NavHost(
        navController = navController,
        startDestination = ClawDeskDestination.Home.name,
        modifier = modifier
    ) {
        composable(ClawDeskDestination.Home.name) {
            HomeRoute(
                baseUrl = baseUrl,
                contentPadding = contentPadding,
                onOpenChat = { navController.navigate(ClawDeskDestination.Chat.name) },
                onOpenTasks = { navController.navigate(ClawDeskDestination.Tasks.name) },
                onOpenActivity = { navController.navigate(ClawDeskDestination.Activity.name) },
                onOpenPairing = { navController.navigate(ClawDeskDestination.Pairing.name) },
                onOpenMore = { navController.navigate(ClawDeskDestination.More.name) }
            )
        }
        composable(ClawDeskDestination.Chat.name) {
            ChatRoute(baseUrl = baseUrl, contentPadding = contentPadding)
        }
        composable(ClawDeskDestination.Tasks.name) {
            TasksRoute(baseUrl = baseUrl, contentPadding = contentPadding)
        }
        composable(ClawDeskDestination.Activity.name) {
            ActivityRoute(baseUrl = baseUrl, contentPadding = contentPadding)
        }
        composable(ClawDeskDestination.More.name) {
            MoreRoute(
                contentPadding = contentPadding,
                onOpenCapabilities = { navController.navigate(ClawDeskDestination.Capabilities.name) },
                onOpenPermissions = { navController.navigate(ClawDeskDestination.Permissions.name) },
                onOpenDevices = { navController.navigate(ClawDeskDestination.Devices.name) },
                onOpenPairing = { navController.navigate(ClawDeskDestination.Pairing.name) },
                onOpenSettings = { navController.navigate(ClawDeskDestination.Settings.name) }
            )
        }
        composable(ClawDeskDestination.Capabilities.name) {
            CapabilitiesRoute(baseUrl = baseUrl, contentPadding = contentPadding)
        }
        composable(ClawDeskDestination.Permissions.name) {
            PermissionsRoute(baseUrl = baseUrl, contentPadding = contentPadding)
        }
        composable(ClawDeskDestination.Devices.name) {
            DevicesRoute(baseUrl = baseUrl, contentPadding = contentPadding)
        }
        composable(ClawDeskDestination.Pairing.name) {
            PairingRoute(
                baseUrl = baseUrl,
                contentPadding = contentPadding,
                onNavigateBack = { navController.popBackStack() }
            )
        }
        composable(ClawDeskDestination.Settings.name) {
            SettingsRoute(
                baseUrl = baseUrl,
                contentPadding = contentPadding,
                onSaveBaseUrl = onSaveBaseUrl,
                onResetBaseUrl = onResetBaseUrl
            )
        }
    }
}
