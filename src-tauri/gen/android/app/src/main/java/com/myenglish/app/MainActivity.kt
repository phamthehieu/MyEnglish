package com.myenglish.app

import android.Manifest
import android.content.Intent
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import android.webkit.JavascriptInterface
import androidx.core.view.WindowInsetsCompat

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
  private var imeHeight = -1
  @Volatile private var waitingText: String? = null

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

  override fun onStart() {
    super.onStart()
    inForeground = true
  }

  override fun onResume() {
    super.onResume()
    inForeground = true
  }

  override fun onPause() {
    super.onPause()
  }

  override fun onStop() {
    inForeground = false
    super.onStop()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    handleIncomingIntent(intent)
  }

  private fun handleIncomingIntent(intent: Intent?) {
    incomingText(intent)?.let { deliverIncomingText(it) }
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

  /** Text shared to the app (Share → MyEnglish) or chosen in another app's selection menu ("Lưu vào MyEnglish") */
  private fun incomingText(intent: Intent?): String? {
    val text = when (intent?.action) {
      Intent.ACTION_SEND -> intent.getCharSequenceExtra(Intent.EXTRA_TEXT)
      Intent.ACTION_PROCESS_TEXT -> intent.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT)
      else -> null
    }?.toString()?.trim()
    // Handled once: the same intent comes back when the activity is recreated (a turn of the phone)
    intent?.action = null
    return text?.takeIf { it.isNotEmpty() }?.take(4000)
  }

  /**
   * For the page's capture sheet (src/services/incomingText.ts): the text waits here until the page takes it
   * (window.AndroidIncoming.take()), when it starts or when told by the event. On a cold start the page is not loaded
   * yet when the intent arrives, so pushing the text into it could land nowhere.
   */
  private fun deliverIncomingText(text: String) {
    waitingText = text
    appWebView?.let { wv ->
      wv.post { wv.evaluateJavascript("window.dispatchEvent(new Event('myenglish-incoming-text'))", null) }
    }
  }

  inner class IncomingBridge {
    @JavascriptInterface
    fun take(): String {
      val text = waitingText ?: ""
      waitingText = null
      return text
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
    webView.addJavascriptInterface(SituationsBridge(this), "AndroidSituations")
    // A new version of the app, downloaded and installed from inside it
    webView.addJavascriptInterface(UpdateBridge(this, webView), "AndroidUpdater")

    // Edge to edge, the keyboard no longer shrinks the page, so the page cannot see it. Tell it: the keyboard's
    // height above the navigation bar, in CSS px, as --ime-height on <html> and a myenglish-ime event (0 = closed).
    // Read on every layout of the window rather than with an insets listener: the WebView has its own, which
    // gives the page env(safe-area-inset-*), and must not be replaced.
    val decor = window.decorView
    decor.viewTreeObserver.addOnGlobalLayoutListener {
      val insets = ViewCompat.getRootWindowInsets(decor) ?: return@addOnGlobalLayoutListener
      val ime = if (insets.isVisible(WindowInsetsCompat.Type.ime())) {
        val keyboard = insets.getInsets(WindowInsetsCompat.Type.ime()).bottom
        val navBar = insets.getInsets(WindowInsetsCompat.Type.navigationBars()).bottom
        (keyboard - navBar).coerceAtLeast(0)
      } else {
        0
      }
      if (ime != imeHeight) {
        imeHeight = ime
        val css = Math.round(ime / resources.displayMetrics.density)
        webView.evaluateJavascript(
          "document.documentElement.style.setProperty('--ime-height','${css}px');" +
            "window.dispatchEvent(new CustomEvent('myenglish-ime',{detail:$css}))",
          null
        )
      }
    }

    // Text shared to the app (Share → MyEnglish, "Lưu vào MyEnglish"): taken by the page when it is ready
    webView.addJavascriptInterface(IncomingBridge(), "AndroidIncoming")

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
