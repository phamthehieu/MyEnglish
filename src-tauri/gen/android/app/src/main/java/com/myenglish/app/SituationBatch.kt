package com.myenglish.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import android.webkit.JavascriptInterface
import androidx.core.app.NotificationCompat
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * Writes several speaking conversations with Gemini while the app is in the background or closed.
 *
 * The page hands over the jobs (a prompt each, already built); this service calls the API one after another
 * under a foreground notification ("2/5") and appends each raw answer to a file. Nothing is checked here: the
 * page validates and adds them to the learner's list the next time it is open, so the rules stay in one place
 * (src/services/talk/generate.ts). When the last one is done a notification says so.
 */
class SituationBatchService : Service() {
  companion object {
    const val CHANNEL_PROGRESS = "myenglish-batch-progress"
    const val CHANNEL_DONE = "myenglish-batch-done"
    const val NOTIFICATION_PROGRESS = 7101
    const val NOTIFICATION_DONE = 7102
    const val JOBS_FILE = "situation_jobs.json"
    const val PENDING_FILE = "situation_pending.jsonl"
    private const val KEY_FILE = "gemini_api_key.secret"
    private const val MODEL_FILE = "gemini_model.secret"
    private const val DEFAULT_MODEL = "gemini-3.8-flash"
    private val FALLBACK_MODELS = listOf("gemini-3.6-flash", "gemini-3.5-flash", "gemini-flash-lite-latest")
    private const val API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
    private const val TIMEOUT_MS = 90_000

    /** The service is writing conversations */
    @Volatile var running = false
    /** Asked to start, not started yet (the page must not see "idle" in between) */
    @Volatile var starting = false
    @Volatile private var working = false
    @Volatile var total = 0
    @Volatile var done = 0
    @Volatile var failed = 0
    @Volatile var lastError = ""
    @Volatile var cancelled = false
    /** The API refused the key: trying again cannot help */
    @Volatile var abort = false
    /** Longest the whole batch keeps trying (the wake lock lasts a little longer) */
    @Volatile var deadline = 0L
    private val lock = Any()

    fun pendingFile(context: Context) = File(context.dataDir, PENDING_FILE)

    fun ensureChannels(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_PROGRESS, "Đang tạo hội thoại", NotificationManager.IMPORTANCE_LOW)
      )
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_DONE, "Hội thoại đã tạo xong", NotificationManager.IMPORTANCE_DEFAULT)
      )
    }

    fun appendPending(context: Context, line: JSONObject) {
      synchronized(lock) { pendingFile(context).appendText(line.toString() + "\n") }
    }

    fun takePending(context: Context): JSONArray {
      synchronized(lock) {
        val file = pendingFile(context)
        val out = JSONArray()
        if (!file.exists()) return out
        file.readLines().filter { it.isNotBlank() }.forEach {
          try {
            out.put(JSONObject(it))
          } catch (_: Exception) {
          }
        }
        file.delete()
        return out
      }
    }
  }

  private var wakeLock: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    // Android requires startForeground() after every startForegroundService(), whatever happens next
    ensureChannels(this)
    startAsForeground(progressNotification())
    if (working) return START_NOT_STICKY
    val jobs = try {
      JSONArray(File(dataDir, JOBS_FILE).readText())
    } catch (_: Exception) {
      starting = false
      stopForeground(true)
      stopSelf()
      return START_NOT_STICKY
    }
    working = true
    running = true
    starting = false
    cancelled = false
    abort = false
    deadline = System.currentTimeMillis() + 40 * 60 * 1000L
    total = jobs.length()
    done = 0
    failed = 0
    lastError = ""
    val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "myenglish:situation-batch").apply {
      setReferenceCounted(false)
      acquire(45 * 60 * 1000L)
    }
    Thread { runJobs(jobs) }.start()
    // The jobs are gone with the process: do not restart half-way
    return START_NOT_STICKY
  }

  private fun startAsForeground(notification: Notification) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_PROGRESS, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(NOTIFICATION_PROGRESS, notification)
    }
  }

  private fun openAppIntent(): PendingIntent {
    val launch = packageManager.getLaunchIntentForPackage(packageName) ?: Intent()
    return PendingIntent.getActivity(this, 0, launch, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun progressNotification(): Notification =
    NotificationCompat.Builder(this, CHANNEL_PROGRESS)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Đang tạo hội thoại mới")
      .setContentText(
        if (lastError.isEmpty()) "Đã xong $done/$total. Bạn có thể thoát app, máy vẫn tạo tiếp."
        else "Đã xong $done/$total. Mạng yếu hoặc Gemini đang bận, đang tự thử lại…"
      )
      .setProgress(total, done + failed, false)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setContentIntent(openAppIntent())
      .build()

  private fun runJobs(jobs: JSONArray) {
    try {
      val key = File(dataDir, KEY_FILE).takeIf { it.exists() }?.readText()?.trim().orEmpty()
      if (key.isEmpty()) {
        lastError = "Chưa có khóa Gemini trong Cài đặt."
        failed = total
        return
      }
      val model = File(dataDir, MODEL_FILE).takeIf { it.exists() }?.readText()?.trim().orEmpty().ifEmpty { DEFAULT_MODEL }
      for (i in 0 until jobs.length()) {
        if (cancelled || abort) break
        val job = jobs.getJSONObject(i)
        val raw = generate(key, model, job.getString("prompt"))
        if (raw != null) {
          appendPending(
            this,
            JSONObject()
              .put("topicId", job.optString("topicId"))
              .put("group", job.optString("group"))
              .put("level", job.optString("level"))
              .put("foundation", job.optBoolean("foundation", false))
              .put("raw", raw)
          )
          done++
        } else {
          failed++
        }
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_PROGRESS, progressNotification())
        // The free tier allows a few calls a minute
        if (i < jobs.length() - 1 && !cancelled) Thread.sleep(4500)
      }
    } catch (e: Exception) {
      lastError = e.message ?: e.javaClass.simpleName
    } finally {
      finish()
    }
  }

  /**
   * One conversation's JSON text. A weak network, an overloaded model (503) or a rate limit (429) is not the
   * end: the next model is tried, then it waits (5s, 10s ... up to a minute) and goes round again, until it
   * has an answer, the learner stops it, or the time is up. Only a key the API refuses stops the whole batch.
   */
  private fun generate(key: String, model: String, prompt: String): String? {
    val models = (listOf(model) + FALLBACK_MODELS.filter { it != model }).take(3)
    var wait = 5_000L
    while (!cancelled && !abort && System.currentTimeMillis() < deadline) {
      var rateLimited = false
      for (m in models) {
        if (cancelled) return null
        when (val r = callOnce(key, m, prompt)) {
          is Reply.Text -> {
            lastError = ""
            return r.text
          }
          is Reply.Retry -> {
            lastError = r.message
            if (r.rateLimited) rateLimited = true
            getSystemService(NotificationManager::class.java).notify(NOTIFICATION_PROGRESS, progressNotification())
          }
          is Reply.Fatal -> {
            lastError = r.message
            if (r.badKey) abort = true
            return null
          }
        }
      }
      sleepUnlessCancelled(if (rateLimited) maxOf(wait, 20_000L) else wait)
      wait = minOf(wait * 2, 60_000L)
    }
    return null
  }

  private fun sleepUnlessCancelled(ms: Long) {
    var left = ms
    while (left > 0 && !cancelled) {
      Thread.sleep(minOf(left, 1_000L))
      left -= 1_000L
    }
  }

  private sealed class Reply {
    class Text(val text: String) : Reply()
    class Retry(val message: String, val rateLimited: Boolean) : Reply()
    class Fatal(val message: String, val badKey: Boolean = false) : Reply()
  }

  private fun callOnce(key: String, model: String, prompt: String): Reply {
    val body = JSONObject()
      .put(
        "contents",
        JSONArray().put(
          JSONObject().put("role", "user").put("parts", JSONArray().put(JSONObject().put("text", prompt)))
        )
      )
      .put("generationConfig", JSONObject().put("responseMimeType", "application/json").put("temperature", 0.4))
    var conn: HttpURLConnection? = null
    return try {
      conn = (URL("$API_BASE/$model:generateContent").openConnection() as HttpURLConnection).apply {
        requestMethod = "POST"
        connectTimeout = 20_000
        readTimeout = TIMEOUT_MS
        doOutput = true
        setRequestProperty("Content-Type", "application/json")
        setRequestProperty("x-goog-api-key", key)
      }
      conn.outputStream.use { it.write(body.toString().toByteArray()) }
      val code = conn.responseCode
      if (code in 200..299) {
        val json = JSONObject(conn.inputStream.bufferedReader().readText())
        val parts = json.optJSONArray("candidates")?.optJSONObject(0)?.optJSONObject("content")?.optJSONArray("parts")
        val text = StringBuilder()
        if (parts != null) {
          for (k in 0 until parts.length()) {
            val p = parts.getJSONObject(k)
            if (!p.optBoolean("thought", false)) text.append(p.optString("text"))
          }
        }
        if (text.isBlank()) Reply.Retry("Gemini trả về nội dung rỗng.", false) else Reply.Text(text.toString())
      } else if (code == 429 || code in 500..599) {
        Reply.Retry("Gemini quá tải hoặc hết lượt (HTTP $code).", code == 429)
      } else {
        Reply.Fatal("Gemini từ chối yêu cầu (HTTP $code).", badKey = code == 401 || code == 403)
      }
    } catch (e: java.io.IOException) {
      Reply.Retry(e.message ?: "Mất kết nối.", false)
    } catch (e: Exception) {
      Reply.Fatal(e.message ?: e.javaClass.simpleName)
    } finally {
      conn?.disconnect()
    }
  }

  private fun finish() {
    try {
      wakeLock?.let { if (it.isHeld) it.release() }
    } catch (_: Exception) {
    }
    val made = done
    val manager = getSystemService(NotificationManager::class.java)
    if (!cancelled) {
      val text = when {
        made > 0 && failed == 0 -> "Đã tạo xong $made hội thoại. Mở app để luyện nói."
        made > 0 -> "Đã tạo $made hội thoại ($failed bài không tạo được). Mở app để xem."
        else -> "Không tạo được hội thoại nào. ${lastError.ifEmpty { "Thử lại sau." }}"
      }
      manager.notify(
        NOTIFICATION_DONE,
        NotificationCompat.Builder(this, CHANNEL_DONE)
          .setSmallIcon(applicationInfo.icon)
          .setContentTitle("Hội thoại mới")
          .setContentText(text)
          .setStyle(NotificationCompat.BigTextStyle().bigText(text))
          .setAutoCancel(true)
          .setContentIntent(openAppIntent())
          .build()
      )
    }
    running = false
    working = false
    stopForeground(true)
    stopSelf()
  }

  override fun onDestroy() {
    running = false
    working = false
    starting = false
    super.onDestroy()
  }
}

/** The page side: `window.AndroidSituations` */
class SituationsBridge(private val context: Context) {
  /** Start writing the conversations of `jobsJson` ([{topicId, group, level, foundation, prompt}]); false if one is already running */
  @JavascriptInterface
  fun start(jobsJson: String): Boolean {
    if (SituationBatchService.running || SituationBatchService.starting) return false
    return try {
      File(context.dataDir, SituationBatchService.JOBS_FILE).writeText(jobsJson)
      SituationBatchService.starting = true
      val intent = Intent(context, SituationBatchService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent) else context.startService(intent)
      true
    } catch (e: Exception) {
      SituationBatchService.starting = false
      false
    }
  }

  @JavascriptInterface
  fun status(): String =
    JSONObject()
      .put("running", SituationBatchService.running || SituationBatchService.starting)
      .put("total", SituationBatchService.total)
      .put("done", SituationBatchService.done)
      .put("failed", SituationBatchService.failed)
      .put("error", SituationBatchService.lastError)
      .toString()

  /** The answers written so far, as a JSON array; they are removed from the file once handed over */
  @JavascriptInterface
  fun takePending(): String = SituationBatchService.takePending(context).toString()

  @JavascriptInterface
  fun cancel() {
    SituationBatchService.cancelled = true
  }
}
