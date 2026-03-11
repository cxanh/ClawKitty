package com.clawdesk.mobile.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = Ink,
    secondary = Coral,
    tertiary = Sky,
    surface = Sand,
    background = Paper
)

private val DarkColors = darkColorScheme(
    primary = Sky,
    secondary = Coral,
    tertiary = Sand
)

@Composable
fun ClawDeskTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = Typography,
        content = content
    )
}
