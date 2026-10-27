package com.myenglish.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Updating the app from inside it, exposed to the page as `window.AndroidUpdater` (src/services/androidUpdater.ts):
 * the new APK is downloaded to the cache, checked against the SHA-256 the update notice gives, and handed to Android's
 * installer, which asks the learner to confirm and installs it over the app (data kept: same signing key, higher
 * version). Android never lets an app install silently, so that one confirmation stays.
 *
 * Progress and the end come back to the page as events: app-update-progress {percent}, app-update-downloaded {} and
 * app-update-error {message}. Methods run on the WebView's background thread; the download has its own thread.
 */
class UpdateBridge(private val context: Context, private val webView: WebView) {
  @Volatile
  private var downloading = false

  private val dir: File get() = File(context.cacheDir, "updates")
  private val apk: File get() = File(dir, "MyEnglish-update.apk")

  /** Whether Android lets this app install packages (a setting the learner turns on once, from Android 8) */
  @JavascriptInterface
  fun canInstall(): Boolean = Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

  /** Opens the Android setting "install unknown apps" of this app */
  @JavascriptInterface
  fun openInstallSettings() {
    val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  /** Downloads the APK of `url` (https); `sha256` (hex, may be empty) is what the file must hash to */
  @JavascriptInterface
  fun download(url: String, sha256: String) {
    if (downloading) return
    if (!url.startsWith("https://")) {
      emit("app-update-error", JSONObject().put("message", "Địa chỉ tải không an toàn."))
      return
    }
    downloading = true
    Thread({ run(url, sha256.trim()) }, "app-update-download").start()
  }

  /** Hands the downloaded APK to Android's installer */
  @JavascriptInterface
  fun install() {
    val file = apk
    if (!file.exists()) {
      emit("app-update-error", JSONObject().put("message", "Chưa có file cập nhật, hãy tải lại."))
      return
    }
    try {
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri, "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    } catch (e: Exception) {
      emit("app-update-error", JSONObject().put("message", "Không mở được trình cài đặt: ${e.message}"))
    }
  }

  private fun run(url: String, sha256: String) {
    var connection: HttpURLConnection? = null
    try {
      dir.mkdirs()
      apk.delete()
      val part = File(dir, "MyEnglish-update.apk.part")
      part.delete()

      // GitHub answers a download link with a redirect to its file store: HttpURLConnection follows it (https to https)
      connection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 15_000
        readTimeout = 30_000
        instanceFollowRedirects = true
      }
      if (connection.responseCode != HttpURLConnection.HTTP_OK) {
        fail("Máy chủ trả lời lỗi ${connection.responseCode}. Bản mới có thể chưa được đăng.")
        return
      }
      val total = connection.contentLengthLong
      val digest = MessageDigest.getInstance("SHA-256")
      var read = 0L
      var lastPercent = -1
      connection.inputStream.use { input ->
        part.outputStream().use { out ->
          val buffer = ByteArray(64 * 1024)
          while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            out.write(buffer, 0, n)
            digest.update(buffer, 0, n)
            read += n
            if (total > 0) {
              val percent = (read * 100 / total).toInt()
              if (percent != lastPercent) {
                lastPercent = percent
                emit("app-update-progress", JSONObject().put("percent", percent))
              }
            }
          }
        }
      }
      if (read < 1_000_000) {
        part.delete()
        fail("File tải về quá nhỏ, có thể bị lỗi.")
        return
      }
      val actual = digest.digest().joinToString("") { "%02x".format(it) }
      if (sha256.isNotEmpty() && !actual.equals(sha256, ignoreCase = true)) {
        part.delete()
        fail("File tải về không khớp với bản đã đăng (có thể bị hỏng). Hãy thử lại.")
        return
      }
      if (!part.renameTo(apk)) {
        fail("Không lưu được file cập nhật.")
        return
      }
      emit("app-update-downloaded", JSONObject())
    } catch (e: Exception) {
      fail("Không tải được: ${e.message ?: "lỗi mạng"}")
    } finally {
      connection?.disconnect()
      downloading = false
    }
  }

  private fun fail(message: String) = emit("app-update-error", JSONObject().put("message", message))

  private fun emit(name: String, detail: JSONObject) {
    webView.post { webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('$name',{detail:$detail}));", null) }
  }
}
