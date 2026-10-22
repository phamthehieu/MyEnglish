package com.myenglish.app

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : TauriActivity() {
  companion object {
    /**
     * True while the app is on the screen in front of the learner. A planned reminder that fires then
     * (ReminderReceiver) shows nothing: its card and notification would only repeat what they are looking at.
     */
    @Volatile
    var inForeground: Boolean = false
  }

  private var tts: TtsBridge? = null
  private var asr: AsrBridge? = null
  private var appWebView: WebView? = null
  private var pendingAction: String? = null
  private var pendingFocusMinutes: Int = 10

  // Must be registered before the activity starts: a property is created with the activity
  private val micPermission =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      asr?.onPermissionResult(granted)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    handleIncomingIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    inForeground = true
  }

  override fun onPause() {
    inForeground = false
    super.onPause()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIncomingIntent(intent)
  }

  private fun handleIncomingIntent(intent: Intent?) {
    val action = intent?.getStringExtra("action")
      ?: if (intent?.getBooleanExtra("openReview", false) == true) "start_review" else null
    val focusMinutes = intent?.getIntExtra("focusMinutes", 10) ?: 10

    if (action != null) {
      val wv = appWebView
      if (wv != null) {
        wv.post {
          dispatchActionToJs(wv, action, focusMinutes)
        }
      } else {
        pendingAction = action
        pendingFocusMinutes = focusMinutes
      }
    }
  }

  private fun dispatchActionToJs(wv: WebView, action: String, focusMinutes: Int) {
    when (action) {
      "start_review" -> wv.evaluateJavascript("window.dispatchEvent(new CustomEvent('open-review-popup-preview'));", null)
      "quick_quiz" -> wv.evaluateJavascript("window.dispatchEvent(new CustomEvent('open-quick-quiz'));", null)
      "focus" -> wv.evaluateJavascript("window.dispatchEvent(new CustomEvent('start-focus-session', { detail: { minutes: $focusMinutes } }));", null)
    }
  }

  // Speech out goes through Android's TextToSpeech (TtsBridge), speech in through Vosk (AsrBridge)
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    appWebView = webView

    val speaker = TtsBridge(this, webView)
    tts = speaker
    webView.addJavascriptInterface(speaker, "AndroidTTS")

    val listener = AsrBridge(this, webView)
    asr = listener
    webView.addJavascriptInterface(listener, "AndroidASR")

    webView.addJavascriptInterface(RemindersBridge(this), "AndroidReminders")

    // Deliver any action pending from activity cold start
    val act = pendingAction
    if (act != null) {
      val mins = pendingFocusMinutes
      pendingAction = null
      webView.postDelayed({
        dispatchActionToJs(webView, act, mins)
      }, 1500)
    }
  }

  fun requestMic() {
    runOnUiThread { micPermission.launch(Manifest.permission.RECORD_AUDIO) }
  }

  override fun onDestroy() {
    inForeground = false
    appWebView = null
    tts?.shutdown()
    tts = null
    asr?.shutdown()
    asr = null
    super.onDestroy()
  }
}
