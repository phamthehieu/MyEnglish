package com.myenglish.app

import android.app.ActivityOptions
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.widget.Toast
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar
import java.util.concurrent.TimeUnit

/**
 * Study reminders that fire with the app closed, exposed to the page as `window.AndroidReminders`.
 * Supports both rich floating popups over external apps (SYSTEM_ALERT_WINDOW) and interactive notifications.
 */
class RemindersBridge(private val context: Context) {
  @JavascriptInterface
  fun setPlan(planJson: String, ruleJson: String): Boolean = try {
    ReminderScheduler.replace(context, planJson, ruleJson)
    true
  } catch (e: Exception) {
    false
  }

  @JavascriptInterface
  fun clear() = ReminderScheduler.clear(context)

  /** Notifications are allowed for the app */
  @JavascriptInterface
  fun canNotify(): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()

  /** Whether the app has permission to display floating popups over other apps */
  @JavascriptInterface
  fun canDrawOverlays(): Boolean =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) Settings.canDrawOverlays(context) else true

  /** Opens the system setting so user can enable "Display over other apps" */
  @JavascriptInterface
  fun requestOverlayPermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
      try {
        val intent = Intent(
          Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
          Uri.parse("package:" + context.packageName)
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
        true
      } catch (_: Exception) {
        try {
          val fallback = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          context.startActivity(fallback)
          true
        } catch (_: Exception) {
          try {
            val appDetails = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS)
              .setData(Uri.parse("package:" + context.packageName))
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(appDetails)
            true
          } catch (_: Exception) {
            false
          }
        }
      }
    } else {
      false
    }
  }

  /** Trigger floating nudge dialog immediately for testing */
  @JavascriptInterface
  fun testFloatingNudge(title: String, body: String, dueCount: Int, quizJson: String): Boolean {
    return try {
      val intent = Intent(context, FloatingNudgeActivity::class.java).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
        putExtra("title", title)
        putExtra("body", body)
        putExtra("dueCount", dueCount)
        putExtra("quiz", quizJson)
      }
      context.startActivity(intent)
      true
    } catch (e: Exception) {
      false
    }
  }

  /** Trigger floating nudge dialog after N seconds so user can switch away to home screen or other apps to test */
  @JavascriptInterface
  fun testFloatingNudgeIn(seconds: Int, title: String, body: String, dueCount: Int, quizJson: String): Boolean {
    return try {
      val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      val at = System.currentTimeMillis() + (if (seconds > 0) seconds else 5) * 1000L
      val intent = Intent(context, ReminderReceiver::class.java).apply {
        action = "com.myenglish.app.REMINDER"
        putExtra("id", 9998)
        putExtra("test", true)
        putExtra("at", at)
        putExtra("title", title)
        putExtra("body", body)
        putExtra("dueCount", dueCount)
        putExtra("quiz", quizJson)
      }
      val pi = PendingIntent.getBroadcast(
        context,
        ReminderScheduler.REQUEST_BASE + 9998,
        intent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
      } else {
        alarms.setExact(AlarmManager.RTC_WAKEUP, at, pi)
      }
      true
    } catch (e: Exception) {
      false
    }
  }

  @JavascriptInterface
  fun getPendingQuizAnswers(): String = ReminderScheduler.getPendingQuizAnswers(context)

  @JavascriptInterface
  fun clearPendingQuizAnswers() = ReminderScheduler.clearPendingQuizAnswers(context)
}

object ReminderScheduler {
  private const val PREFS = "myenglish_reminders"
  private const val KEY_PLAN = "plan"
  private const val KEY_RULE = "rule"
  private const val KEY_DELIVERED = "deliveredUpTo"
  private const val KEY_PENDING_QUIZ = "pending_quiz_results"
  const val CHANNEL_ID = "myenglish-study"
  const val CHANNEL_ID_STATUS = "myenglish-study-status"
  private const val WATCHDOG = "myenglish-reminder-watchdog"
  const val REQUEST_BASE = 710_000
  private const val MAX_ENTRIES = 60
  private const val MIN_AHEAD = 8
  private const val HORIZON_DAYS = 3
  private const val MIN_SPACING_MS = 3 * 60_000L
  private const val OVERDUE_AFTER_MS = 5 * 60_000L
  private const val CATCH_UP_WINDOW_MS = 3 * 60 * 60_000L

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private fun plan(context: Context): JSONArray =
    try {
      JSONArray(prefs(context).getString(KEY_PLAN, "[]"))
    } catch (e: Exception) {
      JSONArray()
    }

  private fun rule(context: Context): JSONObject? =
    try {
      prefs(context).getString(KEY_RULE, "")?.takeIf { it.isNotBlank() }?.let { JSONObject(it) }
    } catch (e: Exception) {
      null
    }

  fun canScheduleExact(context: Context): Boolean {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.S || alarms.canScheduleExactAlarms()
  }

  private fun intentFor(
    context: Context,
    index: Int,
    at: Long,
    title: String,
    body: String,
    dueCount: Int = 0,
    quiz: String = ""
  ): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .setAction("com.myenglish.app.REMINDER")
      .putExtra("id", index)
      .putExtra("at", at)
      .putExtra("title", title)
      .putExtra("body", body)
      .putExtra("dueCount", dueCount)
      .putExtra("quiz", quiz)
    return PendingIntent.getBroadcast(
      context,
      REQUEST_BASE + index,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  private fun cancelAlarms(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val stored = plan(context)
    for (i in 0 until stored.length()) {
      val entry = stored.optJSONObject(i) ?: continue
      alarms.cancel(
        intentFor(
          context,
          i,
          entry.optLong("at"),
          entry.optString("title"),
          entry.optString("body"),
          entry.optInt("dueCount", 0),
          entry.optString("quiz", "")
        )
      )
    }
  }

  fun clear(context: Context) {
    cancelAlarms(context)
    prefs(context).edit().remove(KEY_PLAN).remove(KEY_RULE).apply()
    WorkManager.getInstance(context).cancelUniqueWork(WATCHDOG)
  }

  fun replace(context: Context, planJson: String, ruleJson: String) {
    cancelAlarms(context)
    prefs(context).edit().putString(KEY_PLAN, JSONArray(planJson).toString()).putString(KEY_RULE, ruleJson).apply()
    topUp(context)
  }

  private fun ensureWatchdog(context: Context) {
    try {
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WATCHDOG,
        ExistingPeriodicWorkPolicy.KEEP,
        PeriodicWorkRequestBuilder<ReminderCatchUpWorker>(15, TimeUnit.MINUTES).build()
      )
    } catch (_: Exception) {}
  }

  fun topUp(context: Context) {
    cancelAlarms(context)
    val now = System.currentTimeMillis()
    val delivered = prefs(context).getLong(KEY_DELIVERED, 0L)
    val keep = ArrayList<JSONObject>()
    val stored = plan(context)
    for (i in 0 until stored.length()) {
      val entry = stored.optJSONObject(i) ?: continue
      val at = entry.optLong("at")
      if (at > now || (at > delivered && now - at <= OVERDUE_AFTER_MS)) keep.add(entry)
    }
    val rule = rule(context)
    if (rule != null && keep.count { it.optLong("at") > now } < MIN_AHEAD) {
      val after = keep.maxOfOrNull { it.optLong("at") }?.coerceAtLeast(now) ?: now
      for (at in expand(rule, after, keep)) {
        if (keep.size >= MAX_ENTRIES) break
        keep.add(
          JSONObject()
            .put("at", at)
            .put("title", rule.optString("title", "MyEnglish • Đến giờ ôn từ 🦉"))
            .put("body", pickBody(rule, keep.size))
        )
      }
    }
    val saved = JSONArray()
    keep.forEach { saved.put(it) }
    prefs(context).edit().putString(KEY_PLAN, saved.toString()).apply()
    setAlarms(context, keep)
    if (keep.isNotEmpty()) ensureWatchdog(context)
  }

  fun rebuild(context: Context) {
    cancelAlarms(context)
    prefs(context).edit().putString(KEY_PLAN, "[]").apply()
    topUp(context)
  }

  fun catchUp(context: Context) {
    val now = System.currentTimeMillis()
    val delivered = prefs(context).getLong(KEY_DELIVERED, 0L)
    var latest: JSONObject? = null
    val stored = plan(context)
    for (i in 0 until stored.length()) {
      val entry = stored.optJSONObject(i) ?: continue
      val at = entry.optLong("at")
      if (at > delivered && now - at > OVERDUE_AFTER_MS && now - at <= CATCH_UP_WINDOW_MS) {
        if (latest == null || at > latest.optLong("at")) latest = entry
      }
    }
    if (latest != null) {
      markDelivered(context, latest.optLong("at"))
      showNotification(
        context,
        REQUEST_BASE,
        latest.optString("title"),
        latest.optString("body"),
        latest.optString("quiz", "")
      )
    }
    topUp(context)
  }

  fun markDelivered(context: Context, at: Long) {
    val p = prefs(context)
    p.edit().putLong(KEY_DELIVERED, maxOf(at, p.getLong(KEY_DELIVERED, 0L))).apply()
  }

  private fun setAlarm(alarms: AlarmManager, exact: Boolean, at: Long, pending: PendingIntent) {
    try {
      if (exact) {
        alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
      } else {
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
      }
    } catch (_: SecurityException) {
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
    }
  }

  private fun setAlarms(context: Context, entries: List<JSONObject>) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val exact = canScheduleExact(context)
    for ((i, entry) in entries.withIndex()) {
      val at = entry.optLong("at")
      setAlarm(
        alarms,
        exact,
        at,
        intentFor(
          context,
          i,
          at,
          entry.optString("title"),
          entry.optString("body"),
          entry.optInt("dueCount", 0),
          entry.optString("quiz", "")
        )
      )
    }
  }

  fun snooze(context: Context, minutes: Int = 10) {
    val now = System.currentTimeMillis()
    val snoozeAt = now + minutes * 60_000L
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val exact = canScheduleExact(context)
    val snoozePending = intentFor(
      context,
      9999,
      snoozeAt,
      "MyEnglish • Nhắc lại 🦉",
      "Đã hết thời gian hoãn. Cùng ôn nhanh vài câu nào!"
    )
    setAlarm(alarms, exact, snoozeAt, snoozePending)
  }

  /**
   * Take every study reminder out of the notification shade: the learner did the quiz (or snoozed, or opened the
   * app), so none of them, including earlier ones that were missed, has anything left to say.
   */
  fun dismissAll(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    try {
      for (n in manager.activeNotifications) {
        val channel = n.notification.channelId
        if (channel == CHANNEL_ID || channel == CHANNEL_ID_STATUS) manager.cancel(n.tag, n.id)
      }
    } catch (_: Exception) {
      manager.cancel(REQUEST_BASE)
    }
  }

  fun showNotification(
    context: Context,
    id: Int,
    title: String,
    body: String,
    quizJson: String? = null,
    dueCount: Int = 0
  ) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val hasOverlay = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)
    val channelId = if (hasOverlay) CHANNEL_ID_STATUS else CHANNEL_ID

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      if (hasOverlay) {
        // Quiet status-bar channel: shows icon on status bar and notification in drawer,
        // but DOES NOT drop down heads-up banner since floating popup is already visible
        val quietChannel = NotificationChannel(
          CHANNEL_ID_STATUS,
          "Nhắc học (Thanh trạng thái)",
          NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
          description = "Hiển thị trên thanh trạng thái khi thẻ popup nổi xuất hiện"
          enableVibration(false)
          lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(quietChannel)
      } else {
        val alertChannel = NotificationChannel(
          CHANNEL_ID,
          "Nhắc học",
          NotificationManager.IMPORTANCE_HIGH
        ).apply {
          description = "Nhắc bạn ôn từ vựng đúng giờ"
          enableVibration(true)
          enableLights(true)
          lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(alertChannel)
      }
    }
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return

    // 1. Floating Flash-Quiz Intent: shown directly over external apps without launching the full webview app
    val floatingQuizIntent = Intent(context, FloatingNudgeActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
      putExtra("id", id)
      putExtra("title", title)
      putExtra("body", body)
      putExtra("dueCount", dueCount)
      putExtra("quiz", quizJson)
    }
    val floatingQuizPending = PendingIntent.getActivity(
      context,
      REQUEST_BASE + 2,
      floatingQuizIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // Full-screen heads-up pending intent: forces Android to pop up over whatever app is running
    val fullScreenPending = PendingIntent.getActivity(
      context,
      REQUEST_BASE + 10,
      floatingQuizIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // 2. Open full app intent (MainActivity)
    val open = Intent(context, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra("action", "start_review")
      putExtra("openReview", true)
    }
    val openAppPending = PendingIntent.getActivity(
      context,
      0,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    // "▶ Học ngay" does what the same button of the floating card does: the Flash-Quiz starts right there, on
    // the card, without opening the app. Only when there is no quiz to run does it open the app.
    val learnNowPending = if (!quizJson.isNullOrBlank()) {
      val learnNowIntent = Intent(floatingQuizIntent).apply { putExtra("autoStart", true) }
      PendingIntent.getActivity(
        context,
        REQUEST_BASE + 1,
        learnNowIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    } else {
      PendingIntent.getActivity(
        context,
        REQUEST_BASE + 1,
        open,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      )
    }

    // 3. Snooze 10m intent
    val snoozeIntent = Intent(context, ReminderActionReceiver::class.java).apply {
      action = "com.myenglish.app.SNOOZE_10"
      putExtra("id", id)
    }
    val snoozePending = PendingIntent.getBroadcast(
      context,
      REQUEST_BASE + 3,
      snoozeIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val notifBuilder = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title.ifEmpty { "MyEnglish • Đến giờ ôn từ 🦉" })
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      // If user has overlay permission & quiz is ready, tap directly opens floating quiz without loading full app!
      .setContentIntent(if (hasOverlay && !quizJson.isNullOrBlank()) floatingQuizPending else openAppPending)
      .setAutoCancel(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

    if (hasOverlay) {
      // When popup is displayed, do NOT drop down heads-up notification.
      // Only keep notification in status bar so user can tap it if they missed the popup.
      notifBuilder.setPriority(NotificationCompat.PRIORITY_DEFAULT)
      notifBuilder.setCategory(NotificationCompat.CATEGORY_REMINDER)
      notifBuilder.addAction(0, "⚡ Flash-Quiz", floatingQuizPending)
    } else {
      // Fallback: when popup is disabled / not granted, drop down heads-up banner
      notifBuilder.setPriority(NotificationCompat.PRIORITY_MAX)
      notifBuilder.setCategory(NotificationCompat.CATEGORY_ALARM)
      notifBuilder.setDefaults(NotificationCompat.DEFAULT_ALL)
      notifBuilder.setFullScreenIntent(fullScreenPending, true)
      notifBuilder.addAction(0, "⚡ 1 câu", openAppPending)
    }
    notifBuilder.addAction(0, "▶ Học ngay", learnNowPending)
    notifBuilder.addAction(0, "⏱ Hoãn 10p", snoozePending)

    try {
      manager.notify(id, notifBuilder.build())
    } catch (_: SecurityException) {}
  }

  fun savePendingQuizAnswer(
    context: Context,
    wordId: String,
    isCorrect: Boolean,
    responseTimeMs: Long
  ) {
    try {
      val p = prefs(context)
      val existing = JSONArray(p.getString(KEY_PENDING_QUIZ, "[]"))
      val item = JSONObject().apply {
        put("wordId", wordId)
        put("isCorrect", isCorrect)
        put("responseTimeMs", responseTimeMs)
        put("answeredAt", System.currentTimeMillis())
      }
      existing.put(item)
      p.edit().putString(KEY_PENDING_QUIZ, existing.toString()).apply()
    } catch (_: Exception) {}
  }

  fun getPendingQuizAnswers(context: Context): String =
    prefs(context).getString(KEY_PENDING_QUIZ, "[]") ?: "[]"

  fun clearPendingQuizAnswers(context: Context) {
    prefs(context).edit().remove(KEY_PENDING_QUIZ).apply()
  }

  private fun pickBody(rule: JSONObject, n: Int): String {
    val bodies = rule.optJSONArray("bodies")
    return if (bodies == null || bodies.length() == 0) "" else bodies.optString(n % bodies.length())
  }

  private fun expand(rule: JSONObject, after: Long, existing: List<JSONObject>): List<Long> {
    val gapMs = rule.optLong("gapMin", 0L) * 60_000L
    val startHour = rule.optInt("startHour", 7)
    val endHour = rule.optInt("endHour", 22)
    val cap = rule.optInt("cap", 0)
    val anchors = rule.optJSONArray("anchors") ?: JSONArray()
    // No reminder before this (today's goal met, nothing due, a snooze): a plan rebuilt after a clock or time zone
    // change must not bring back what the app had dropped
    val quietUntil = rule.optLong("quietUntil", 0L)
    if (gapMs <= 0L && anchors.length() == 0) return emptyList()

    val cal = Calendar.getInstance()
    fun midnight(t: Long): Long {
      cal.timeInMillis = t
      cal.set(Calendar.HOUR_OF_DAY, 0)
      cal.set(Calendar.MINUTE, 0)
      cal.set(Calendar.SECOND, 0)
      cal.set(Calendar.MILLISECOND, 0)
      return cal.timeInMillis
    }

    val perDay = HashMap<Long, Int>()
    for (e in existing) perDay[midnight(e.optLong("at"))] = (perDay[midnight(e.optLong("at"))] ?: 0) + 1
    val firstDay = midnight(after)
    var previous = if (existing.isEmpty()) 0L else after
    val out = ArrayList<Long>()

    for (d in 0..HORIZON_DAYS) {
      cal.timeInMillis = firstDay
      cal.add(Calendar.DAY_OF_YEAR, d)
      val day = cal.timeInMillis
      fun at(hour: Int, minute: Int): Long {
        cal.timeInMillis = day
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, minute)
        return cal.timeInMillis
      }
      val dayStart = at(startHour, 0)
      val dayEnd = at(endHour, 0)
      val times = ArrayList<Long>()
      if (gapMs > 0L) {
        var t = if (d == 0) maxOf(dayStart, after + gapMs) else dayStart
        while (t < dayEnd) {
          times.add(t)
          t += gapMs
        }
      }
      for (k in 0 until anchors.length()) {
        val pair = anchors.optJSONArray(k) ?: continue
        times.add(at(pair.optInt(0), pair.optInt(1)))
      }
      times.sort()
      var room = if (cap > 0) cap - (perDay[day] ?: 0) else Int.MAX_VALUE
      for (t in times) {
        if (room <= 0) break
        if (t <= after || t < dayStart || t >= dayEnd || t < quietUntil) continue
        if (previous != 0L && t - previous < MIN_SPACING_MS) continue
        out.add(t)
        previous = t
        room--
      }
    }
    return out
  }
}

class ReminderReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val at = intent.getLongExtra("at", 0L)
    if (at > 0L) ReminderScheduler.markDelivered(context, at)

    val isAppForeground = MainActivity.inForeground || try {
      androidx.lifecycle.ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(androidx.lifecycle.Lifecycle.State.STARTED)
    } catch (_: Exception) {
      MainActivity.inForeground
    }

    if (isAppForeground && !intent.getBooleanExtra("test", false)) {
      ReminderScheduler.topUp(context)
      return
    }

    val id = intent.getIntExtra("id", 0)
    val title = intent.getStringExtra("title") ?: "MyEnglish • Đến giờ ôn từ 🦉"
    val body = intent.getStringExtra("body") ?: ""
    val quizJson = intent.getStringExtra("quiz")
    val dueCount = intent.getIntExtra("dueCount", 0)

    // 1. If overlay permission is granted, pop up the floating dialog card over other apps!
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
      try {
        val popupIntent = Intent(context, FloatingNudgeActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
          putExtra("id", id)
          putExtra("title", title)
          putExtra("body", body)
          putExtra("dueCount", dueCount)
          putExtra("quiz", quizJson)
        }

        // On Android 14+ (API 34+), Background Activity Launch (BAL) requires opt-in via PendingIntent
        val pi = PendingIntent.getActivity(
          context,
          ReminderScheduler.REQUEST_BASE + 99,
          popupIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val bundle = if (Build.VERSION.SDK_INT >= 34) {
          try {
            val opts = ActivityOptions.makeBasic()
            val method = ActivityOptions::class.java.getMethod(
              "setPendingIntentBackgroundActivityStartMode",
              Int::class.javaPrimitiveType
            )
            method.invoke(opts, 1 /* MODE_BACKGROUND_ACTIVITY_START_ALLOWED */)
            opts.toBundle()
          } catch (_: Exception) {
            null
          }
        } else {
          null
        }

        if (bundle != null) {
          pi.send(context, 0, null, null, null, null, bundle)
        } else {
          context.startActivity(popupIntent)
        }
      } catch (e: Exception) {
        android.util.Log.e("MyEnglish", "Failed to start FloatingNudgeActivity from receiver", e)
      }
    }

    // 2. Also show interactive notification in the shade
    ReminderScheduler.showNotification(context, id, title, body, quizJson, dueCount)

    // Whatever happened above, keep the chain going: this is what makes the plan last without the app
    ReminderScheduler.topUp(context)
  }
}

/** Broadcast receiver for notification quick action "⏱ Hoãn 10p" */
class ReminderActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == "com.myenglish.app.SNOOZE_10") {
      ReminderScheduler.snooze(context, 10)
      ReminderScheduler.dismissAll(context)
      Toast.makeText(context, "Đã hoãn nhắc ôn tập 10 phút", Toast.LENGTH_SHORT).show()
    }
  }
}

/** The periodic safety net: delivers a reminder that was due and never arrived, and sets the alarms again */
class ReminderCatchUpWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    ReminderScheduler.catchUp(applicationContext)
    return Result.success()
  }
}

/** Android forgets the alarms on a reboot, an app update, and a change of the clock or the time zone */
class ReminderBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_MY_PACKAGE_REPLACED -> ReminderScheduler.catchUp(context)
      Intent.ACTION_TIME_CHANGED, Intent.ACTION_TIMEZONE_CHANGED -> ReminderScheduler.rebuild(context)
    }
  }
}
