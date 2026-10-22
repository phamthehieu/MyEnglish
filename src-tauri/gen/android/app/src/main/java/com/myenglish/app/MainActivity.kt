package com.myenglish.app

import android.Manifest
import android.os.Bundle
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts

class MainActivity : TauriActivity() {
  private var tts: TtsBridge? = null
  private var asr: AsrBridge? = null

  // Must be registered before the activity starts: a property is created with the activity
  private val micPermission =
    registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
      asr?.onPermissionResult(granted)
    }

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
  }

  // Speech out goes through Android's TextToSpeech (TtsBridge), speech in through Vosk (AsrBridge)
  override fun onWebViewCreate(webView: WebView) {
    super.onWebViewCreate(webView)
    val speaker = TtsBridge(this, webView)
    tts = speaker
    webView.addJavascriptInterface(speaker, "AndroidTTS")
    val listener = AsrBridge(this, webView)
    asr = listener
    webView.addJavascriptInterface(listener, "AndroidASR")
    webView.addJavascriptInterface(RemindersBridge(this), "AndroidReminders")
  }

  fun requestMic() {
    runOnUiThread { micPermission.launch(Manifest.permission.RECORD_AUDIO) }
  }

  override fun onDestroy() {
    tts?.shutdown()
    tts = null
    asr?.shutdown()
    asr = null
    super.onDestroy()
  }
}
