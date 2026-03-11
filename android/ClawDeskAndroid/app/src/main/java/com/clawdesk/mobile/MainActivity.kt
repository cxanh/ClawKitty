package com.clawdesk.mobile

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.clawdesk.mobile.ui.ClawDeskApp
import com.clawdesk.mobile.ui.theme.ClawDeskTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ClawDeskTheme {
                ClawDeskApp()
            }
        }
    }
}
