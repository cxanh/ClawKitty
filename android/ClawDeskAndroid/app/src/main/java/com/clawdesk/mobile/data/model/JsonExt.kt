package com.clawdesk.mobile.data.model

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.longOrNull

fun JsonObject.optString(key: String): String? {
    return (this[key] as? JsonPrimitive)?.contentOrNull
}

fun JsonObject.optInt(key: String): Int? {
    return (this[key] as? JsonPrimitive)?.intOrNull
}

fun JsonObject.optLong(key: String): Long? {
    return (this[key] as? JsonPrimitive)?.longOrNull
}

fun JsonObject.optBoolean(key: String): Boolean? {
    return (this[key] as? JsonPrimitive)?.booleanOrNull
}

fun JsonObject.optObject(key: String): JsonObject? {
    return this[key] as? JsonObject
}

fun JsonObject.optArray(key: String): JsonArray? {
    return this[key] as? JsonArray
}

fun JsonObject.stringList(key: String): List<String> {
    return (this[key] as? JsonArray)
        ?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
        .orEmpty()
}

fun JsonArray.objectList(): List<JsonObject> {
    return mapNotNull { it as? JsonObject }
}

fun JsonObject.summaryOrFallback(summaryKey: String = "summary", titleKey: String = "title"): String {
    return optString(summaryKey)
        ?: optString(titleKey)
        ?: "-"
}

fun JsonElement?.isJsonNull(): Boolean = this == null || this is JsonNull
