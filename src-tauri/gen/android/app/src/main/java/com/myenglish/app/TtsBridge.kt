package com.myenglish.app

import android.content.Context
import android.speech.tts.TextToSpeech
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

/**
 * Text-to-speech through the phone's own engine (Samsung TTS, Google TTS...), exposed to the page as
 * `window.AndroidTTS`. The WebView's speechSynthesis is silent or lists no voices on many phones, so
 * src/components/review/speech.ts uses this bridge when it exists.
 *
 * Methods run on the WebView's background thread; TextToSpeech accepts calls from any thread.
 */
class TtsBridge(context: Context, private val webView: WebView) : TextToSpeech.OnInitListener {
  private val engine: TextToSpeech = TextToSpeech(context.applicationContext, this)

  @Volatile
  private var ready = false

  override fun onInit(status: Int) {
    ready = status == TextToSpeech.SUCCESS
    // The voice list is only known now: tell the page, which may already have asked for it
    webView.post {
      webView.evaluateJavascript("window.dispatchEvent(new Event('myenglish-tts-ready'))", null)
    }
  }

  @JavascriptInterface
  fun isReady(): Boolean = ready

  /** English voices as JSON: [{ "voiceURI": id, "name": label, "lang": "en-US" }] */
  @JavascriptInterface
  fun voices(): String {
    val out = JSONArray()
    if (!ready) return out.toString()
    val english = try {
      engine.voices?.filter { it.locale.language == "en" } ?: emptyList()
    } catch (e: Exception) {
      emptyList()
    }
    // Several voices per accent: number them so the learner can tell them apart (the ids are technical)
    val countByLocale = HashMap<String, Int>()
    for (voice in english.sortedWith(compareBy({ it.locale.toLanguageTag() }, { it.name }))) {
      val tag = voice.locale.toLanguageTag()
      val n = (countByLocale[tag] ?: 0) + 1
      countByLocale[tag] = n
      val online = if (voice.isNetworkConnectionRequired) " · cần mạng" else ""
      out.put(
        JSONObject()
          .put("voiceURI", voice.name)
          .put("name", "${voice.locale.getDisplayName(Locale("vi"))} · giọng $n$online")
          .put("lang", tag)
      )
    }
    return out.toString()
  }

  @JavascriptInterface
  fun speak(text: String, lang: String, voiceId: String, rate: Float) {
    if (!ready || text.isBlank()) return
    val chosen = if (voiceId.isNotEmpty()) {
      try {
        engine.voices?.firstOrNull { it.name == voiceId }
      } catch (e: Exception) {
        null
      }
    } else {
      null
    }
    if (chosen != null) {
      engine.voice = chosen
    } else {
      val result = engine.setLanguage(Locale.forLanguageTag(lang))
      if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
        engine.setLanguage(Locale.US)
      }
    }
    engine.setSpeechRate(rate.coerceIn(0.1f, 2.0f))
    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "myenglish-tts")
  }

  @JavascriptInterface
  fun stop() {
    if (ready) engine.stop()
  }

  fun shutdown() {
    engine.stop()
    engine.shutdown()
  }
}
