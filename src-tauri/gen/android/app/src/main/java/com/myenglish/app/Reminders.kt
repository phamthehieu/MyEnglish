package com.myenglish.app

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.webkit.JavascriptInterface
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
 *
 * A page that is in the background is frozen by Android, so it cannot count down to anything. When the
 * learner leaves the app, the page hands over, in ONE call:
 *  - the plan for the next days: [{ at, title, body }] (epoch ms), worked out with what the page knows
 *    (goal reached today, words due, pause);
 *  - the rule behind it: { gapMin, startHour, endHour, cap, anchors, title, bodies }.
 *
 * Two independent ways make sure a reminder is not lost; being late is acceptable, being silent is not:
 *  1. Alarms (AlarmManager) fire each reminder on time, exact when Android allows it. Every time one fires the
 *     plan is topped up from the rule, so it never runs out even if the app is not opened for weeks.
 *  2. A periodic job (WorkManager, every 15 minutes, held by the system's job scheduler rather than by
 *     alarms) looks for a reminder that was due but never delivered (alarm dropped, delayed, cleared by the
 *     phone maker's cleaner) and delivers it late, within CATCH_UP_WINDOW. It also sets the alarms again.
 * Plan, rule and what was already delivered live in SharedPreferences; alarms are set again after a reboot,
 * an app update, and a change of the clock or the time zone (Android drops them then).
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

  /** Notifications are allowed for the app (Android 13+ asks; the switch in the system settings counts too) */
  @JavascriptInterface
  fun canNotify(): Boolean = NotificationManagerCompat.from(context).areNotificationsEnabled()
}

object ReminderScheduler {
  private const val PREFS = "myenglish_reminders"
  private const val KEY_PLAN = "plan"
  private const val KEY_RULE = "rule"
  private const val KEY_DELIVERED = "deliveredUpTo"
  const val CHANNEL_ID = "myenglish-study"
  private const val WATCHDOG = "myenglish-reminder-watchdog"
  private const val REQUEST_BASE = 710_000
  private const val MAX_ENTRIES = 60
  /** Fewer future reminders than this: plan more from the rule */
  private const val MIN_AHEAD = 8
  private const val HORIZON_DAYS = 3
  /** Two reminders closer than this are one too many */
  private const val MIN_SPACING_MS = 20 * 60_000L
  /** A reminder this overdue and still undelivered is delivered late by the watchdog */
  private const val OVERDUE_AFTER_MS = 5 * 60_000L
  /** ...but not when it is older than this: by then it would only be noise */
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

  private fun intentFor(context: Context, index: Int, at: Long, title: String, body: String): PendingIntent {
    val intent = Intent(context, ReminderReceiver::class.java)
      .setAction("com.myenglish.app.REMINDER")
      .putExtra("id", index)
      .putExtra("at", at)
      .putExtra("title", title)
      .putExtra("body", body)
    return PendingIntent.getBroadcast(
      context,
      REQUEST_BASE + index,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
  }

  /** Cancel the alarms of the stored plan */
  private fun cancelAlarms(context: Context) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val stored = plan(context)
    for (i in 0 until stored.length()) {
      val entry = stored.optJSONObject(i) ?: continue
      alarms.cancel(intentFor(context, i, entry.optLong("at"), entry.optString("title"), entry.optString("body")))
    }
  }

  fun clear(context: Context) {
    cancelAlarms(context)
    prefs(context).edit().remove(KEY_PLAN).remove(KEY_RULE).apply()
    WorkManager.getInstance(context).cancelUniqueWork(WATCHDOG)
  }

  /** Store a plan and its rule (from the page), then set the alarms */
  fun replace(context: Context, planJson: String, ruleJson: String) {
    cancelAlarms(context)
    prefs(context).edit().putString(KEY_PLAN, JSONArray(planJson).toString()).putString(KEY_RULE, ruleJson).apply()
    topUp(context)
  }

  /** Make sure the periodic job that delivers a missed reminder late is queued (the system keeps it across reboots) */
  private fun ensureWatchdog(context: Context) {
    try {
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        WATCHDOG,
        ExistingPeriodicWorkPolicy.KEEP,
        PeriodicWorkRequestBuilder<ReminderCatchUpWorker>(15, TimeUnit.MINUTES).build()
      )
    } catch (e: Exception) {
      // The alarms still work without it
    }
  }

  /**
   * Drop what is delivered or too old, plan more from the rule when few reminders are left, and set the alarms.
   * A reminder only minutes overdue and not yet delivered is kept: its alarm fires at once.
   */
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
            .put("title", rule.optString("title", "MyEnglish"))
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

  /** The clock or the time zone changed: "7:00" is another moment now, so plan again from the rule */
  fun rebuild(context: Context) {
    cancelAlarms(context)
    prefs(context).edit().putString(KEY_PLAN, "[]").apply()
    topUp(context)
  }

  /**
   * The safety net. A reminder that was due more than OVERDUE_AFTER_MS ago and was never delivered (its alarm was
   * dropped or never ran) is delivered now, late. Only the latest one: a missed morning is not worth five
   * notifications. Then the alarms are set again.
   */
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
      showNotification(context, REQUEST_BASE, latest.optString("title"), latest.optString("body"))
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
    } catch (e: SecurityException) {
      // The exact-alarm permission was withdrawn meanwhile
      alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
    }
  }

  private fun setAlarms(context: Context, entries: List<JSONObject>) {
    val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
    val exact = canScheduleExact(context)
    for ((i, entry) in entries.withIndex()) {
      val at = entry.optLong("at")
      setAlarm(alarms, exact, at, intentFor(context, i, at, entry.optString("title"), entry.optString("body")))
    }
  }

  fun showNotification(context: Context, id: Int, title: String, body: String) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Nhắc học", NotificationManager.IMPORTANCE_DEFAULT).apply {
          description = "Nhắc bạn ôn từ vựng đúng giờ"
        }
      )
    }
    if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return
    val open = Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    val tap = PendingIntent.getActivity(context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title.ifEmpty { "MyEnglish" })
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(tap)
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .build()
    try {
      manager.notify(id, notification)
    } catch (e: SecurityException) {
      // Notifications turned off between the check and here: nothing to show
    }
  }

  private fun pickBody(rule: JSONObject, n: Int): String {
    val bodies = rule.optJSONArray("bodies")
    return if (bodies == null || bodies.length() == 0) "" else bodies.optString(n % bodies.length())
  }

  /**
   * Reminder times after `after` for the next days, the same way the page plans them (see planReminders in
   * mobileReminders.ts) but without what only the page knows: the daily limit counts the entries already
   * planned for the same day.
   */
  private fun expand(rule: JSONObject, after: Long, existing: List<JSONObject>): List<Long> {
    val gapMs = rule.optLong("gapMin", 0L) * 60_000L
    val startHour = rule.optInt("startHour", 7)
    val endHour = rule.optInt("endHour", 22)
    val cap = rule.optInt("cap", 0)
    val anchors = rule.optJSONArray("anchors") ?: JSONArray()
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
        if (t <= after || t < dayStart || t >= dayEnd) continue
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
    ReminderScheduler.showNotification(
      context,
      intent.getIntExtra("id", 0),
      intent.getStringExtra("title") ?: "MyEnglish",
      intent.getStringExtra("body") ?: ""
    )
    // Whatever happened above, keep the chain going: this is what makes the plan last without the app
    ReminderScheduler.topUp(context)
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
