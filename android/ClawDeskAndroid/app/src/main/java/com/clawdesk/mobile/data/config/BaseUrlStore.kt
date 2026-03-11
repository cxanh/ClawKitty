package com.clawdesk.mobile.data.config

import android.content.Context
import com.clawdesk.mobile.BuildConfig

class BaseUrlStore(context: Context) {
    private val preferences = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun load(): String {
        return preferences.getString(KEY_BASE_URL, BuildConfig.DEFAULT_BASE_URL) ?: BuildConfig.DEFAULT_BASE_URL
    }

    fun save(baseUrl: String) {
        preferences.edit().putString(KEY_BASE_URL, sanitize(baseUrl)).apply()
    }

    fun reset() {
        preferences.edit().remove(KEY_BASE_URL).apply()
    }

    private fun sanitize(baseUrl: String): String {
        val trimmed = baseUrl.trim()
        if (trimmed.isEmpty()) {
            return BuildConfig.DEFAULT_BASE_URL
        }
        return if (trimmed.endsWith("/")) trimmed else "$trimmed/"
    }

    companion object {
        private const val PREFS_NAME = "clawdesk_mobile_prefs"
        private const val KEY_BASE_URL = "base_url"
    }
}
