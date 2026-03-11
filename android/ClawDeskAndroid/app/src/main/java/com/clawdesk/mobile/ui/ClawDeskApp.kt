package com.clawdesk.mobile.ui

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.clawdesk.mobile.data.config.BaseUrlStore
import com.clawdesk.mobile.ui.navigation.ClawDeskDestination
import com.clawdesk.mobile.ui.navigation.ClawDeskNavHost

private data class NavItem(
    val destination: ClawDeskDestination,
    val label: String
)

@Composable
fun ClawDeskApp() {
    val context = LocalContext.current
    val baseUrlStore = remember { BaseUrlStore(context) }
    var baseUrl by remember { mutableStateOf(baseUrlStore.load()) }
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()

    val primaryItems = listOf(
        NavItem(ClawDeskDestination.Home, "首页"),
        NavItem(ClawDeskDestination.Chat, "聊天"),
        NavItem(ClawDeskDestination.Tasks, "任务"),
        NavItem(ClawDeskDestination.Activity, "活动"),
        NavItem(ClawDeskDestination.More, "更多")
    )

    Surface(modifier = Modifier.fillMaxSize()) {
        Scaffold(
            bottomBar = {
                NavigationBar {
                    primaryItems.forEach { item ->
                        val selected = backStackEntry?.destination?.hierarchy?.any {
                            it.route == item.destination.name
                        } == true

                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                navController.navigate(item.destination.name) {
                                    launchSingleTop = true
                                    restoreState = true
                                    popUpTo(ClawDeskDestination.Home.name) {
                                        saveState = true
                                    }
                                }
                            },
                            icon = { Text(item.label.take(1)) },
                            label = { Text(item.label) }
                        )
                    }
                }
            }
        ) { paddingValues ->
            ClawDeskNavHost(
                navController = navController,
                modifier = Modifier.fillMaxSize(),
                contentPadding = paddingValues,
                baseUrl = baseUrl,
                onSaveBaseUrl = {
                    baseUrlStore.save(it)
                    baseUrl = baseUrlStore.load()
                },
                onResetBaseUrl = {
                    baseUrlStore.reset()
                    baseUrl = baseUrlStore.load()
                }
            )
        }
    }
}
