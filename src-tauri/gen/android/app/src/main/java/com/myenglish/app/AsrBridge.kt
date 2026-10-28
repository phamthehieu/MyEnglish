package com.myenglish.app

import android.Manifest
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioTrack
import android.media.MediaRecorder
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import com.sun.jna.Library
import com.sun.jna.Native
import com.sun.jna.Pointer
import org.json.JSONArray
import org.json.JSONObject
import org.vosk.LibVosk
import org.vosk.LogLevel
import org.vosk.Model
import org.vosk.Recognizer
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream

/** The one Vosk call the Java wrapper lacks: is a word in the model's dictionary? (-1 when it is not) */
interface VoskDictionary : Library {
  fun vosk_model_find_word(model: Pointer, word: String): Int
}

/**
 * Tells when the learner has stopped talking: speech began, then a stretch of quiet. The level of the room is
 * measured over the first moments of the recording, so a noisy room does not count as speech and a quiet one
 * does not need a loud voice.
 */
class SpeechEndpoint {
  private val calibrationMs = 300
  private val minSpeechMs = 200
  private val silenceMs = 800

  private var elapsedMs = 0.0
  private var noiseSum = 0.0
  private var noiseCount = 0
  private var speechMs = 0.0
  private var quietMs = 0.0
  private var started = false
  private var ended = false

  /** Feed one chunk of 16-bit little-endian mono PCM; true once, when the speech has ended */
  fun feed(data: ByteArray, length: Int): Boolean {
    val samples = length / 2
    if (ended || samples == 0) return false
    var sum = 0.0
    var i = 0
    while (i + 1 < length) {
      val s = ((data[i + 1].toInt() shl 8) or (data[i].toInt() and 0xff)).toShort().toInt() / 32768.0
      sum += s * s
      i += 2
    }
    val rms = Math.sqrt(sum / samples)
    val chunkMs = samples * 1000.0 / 16000

    if (elapsedMs < calibrationMs) {
      elapsedMs += chunkMs
      noiseSum += rms
      noiseCount++
      return false
    }
    elapsedMs += chunkMs

    val floor = if (noiseCount > 0) noiseSum / noiseCount else 0.0
    val loud = rms > maxOf(0.02, floor * 3)
    val quiet = rms < maxOf(0.012, floor * 1.8)
    if (loud) {
      speechMs += chunkMs
      quietMs = 0.0
      if (speechMs >= minSpeechMs) started = true
    } else if (started && quiet) {
      quietMs += chunkMs
      if (quietMs >= silenceMs) {
        ended = true
        return true
      }
    }
    return false
  }
}

/**
 * Offline word recognition for the pronunciation lessons, exposed to the page as `window.AndroidASR`.
 *
 * It records the learner (16 kHz mono) and runs Vosk with a grammar made of the target word, the words it is
 * easily mistaken for (the lesson's minimal pairs) and [unk]. The page learns what the machine heard and
 * shows it: "heard tree instead of three". Everything stays on the phone.
 *
 * Results come back as DOM events, because a call from the page blocks the page until it returns:
 *   myenglish-asr-permission  detail: "true" | "false"
 *   myenglish-asr-ready       detail: JSON { ok, error? }
 *   myenglish-asr-result      detail: JSON { ok, text, words: [{ word, conf }], peak, error? }
 *   myenglish-asr-endpoint    while recording: the learner spoke, then went quiet (the page may call stop)
 */
class AsrBridge(
  private val activity: MainActivity,
  private val webView: WebView,
) {
  companion object {
    private const val SAMPLE_RATE = 16000
    private const val MAX_SECONDS = 15
    private const val MODEL_ASSET_DIR = "vosk-model-en"
    private const val MODEL_DIR = "vosk-model-en-0.15"
    private const val READY_MARKER = ".complete"
  }

  @Volatile private var model: Model? = null
  @Volatile private var loading = false

  @Volatile private var recording = false
  private var recorder: AudioRecord? = null
  private var recordThread: Thread? = null
  private val pcm = ByteArrayOutputStream()

  @Volatile private var lastPcm: ByteArray = ByteArray(0)
  private var track: AudioTrack? = null

  private fun emit(event: String, detail: String) {
    webView.post {
      webView.evaluateJavascript(
        "window.dispatchEvent(new CustomEvent('$event',{detail:${JSONObject.quote(detail)}}))",
        null
      )
    }
  }

  private fun hasMic(): Boolean =
    ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

  fun onPermissionResult(granted: Boolean) = emit("myenglish-asr-permission", granted.toString())

  @JavascriptInterface
  fun status(): String =
    JSONObject().put("permission", hasMic()).put("modelReady", model != null).put("loading", loading).toString()

  @JavascriptInterface
  fun requestPermission() {
    if (hasMic()) emit("myenglish-asr-permission", "true") else activity.requestMic()
  }

  /** Load the model (copied out of the APK the first time: a few seconds), then fire myenglish-asr-ready */
  @JavascriptInterface
  fun prepare() {
    if (model != null) {
      emit("myenglish-asr-ready", JSONObject().put("ok", true).toString())
      return
    }
    if (loading) return
    loading = true
    Thread {
      val out = JSONObject()
      try {
        val dir = File(activity.filesDir, MODEL_DIR)
        if (!File(dir, READY_MARKER).exists()) {
          dir.deleteRecursively()
          copyAssetDir(MODEL_ASSET_DIR, dir)
          File(dir, READY_MARKER).writeText("ok")
        }
        LibVosk.setLogLevel(LogLevel.WARNINGS)
        model = Model(dir.absolutePath)
        out.put("ok", true)
      } catch (e: Throwable) {
        out.put("ok", false).put("error", e.message ?: e.javaClass.simpleName)
      } finally {
        loading = false
      }
      emit("myenglish-asr-ready", out.toString())
    }.start()
  }

  private fun copyAssetDir(assetPath: String, target: File) {
    val children = activity.assets.list(assetPath) ?: emptyArray()
    if (children.isEmpty()) {
      // A file
      target.parentFile?.mkdirs()
      activity.assets.open(assetPath).use { input -> FileOutputStream(target).use { input.copyTo(it) } }
      return
    }
    target.mkdirs()
    for (name in children) copyAssetDir("$assetPath/$name", File(target, name))
  }

  private val dictionary: VoskDictionary? by lazy {
    try {
      Native.load("vosk", VoskDictionary::class.java)
    } catch (t: Throwable) {
      null
    }
  }

  /**
   * The words of `wordsJson` (a JSON array) that the model can recognize. A grammar silently ignores a word
   * outside the model's dictionary, so the page must know. If the lookup cannot be made, every word is kept.
   */
  @JavascriptInterface
  fun knownWords(wordsJson: String): String {
    val words = JSONArray(wordsJson)
    val m = model
    val lookup = dictionary
    val out = JSONArray()
    for (i in 0 until words.length()) {
      val word = words.getString(i)
      val known = if (m == null || lookup == null || word == "[unk]") {
        true
      } else {
        try {
          lookup.vosk_model_find_word(m.pointer, word) >= 0
        } catch (t: Throwable) {
          true
        }
      }
      if (known) out.put(word)
    }
    return out.toString()
  }

  @JavascriptInterface
  fun start(): Boolean {
    if (recording || !hasMic()) return false
    val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    if (minBuffer <= 0) return false
    val rec = try {
      AudioRecord(
        MediaRecorder.AudioSource.VOICE_RECOGNITION,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        minBuffer * 2
      )
    } catch (e: Exception) {
      return false
    }
    if (rec.state != AudioRecord.STATE_INITIALIZED) {
      rec.release()
      return false
    }
    pcm.reset()
    recorder = rec
    recording = true
    rec.startRecording()
    recordThread = Thread {
      val buffer = ByteArray(minBuffer)
      val limit = SAMPLE_RATE * 2 * MAX_SECONDS
      val endpoint = SpeechEndpoint()
      var announced = false
      while (recording && pcm.size() < limit) {
        val n = rec.read(buffer, 0, buffer.size)
        if (n > 0) {
          synchronized(pcm) { pcm.write(buffer, 0, n) }
          if (!announced && endpoint.feed(buffer, n)) {
            announced = true
            emit("myenglish-asr-endpoint", "")
          }
        } else if (n < 0) break
      }
    }.also { it.start() }
    return true
  }

  /** Stop recording and recognize what was said against the grammar (a JSON array of words); result by event */
  @JavascriptInterface
  fun stop(grammarJson: String) {
    if (!recording) {
      emit("myenglish-asr-result", JSONObject().put("ok", false).put("error", "not recording").toString())
      return
    }
    recording = false
    try {
      recordThread?.join(1500)
    } catch (e: InterruptedException) {
    }
    try {
      recorder?.stop()
    } catch (e: Exception) {
    }
    recorder?.release()
    recorder = null
    val data = synchronized(pcm) { pcm.toByteArray() }
    lastPcm = data

    Thread {
      emit("myenglish-asr-result", recognize(data, grammarJson).toString())
    }.start()
  }

  private fun recognize(data: ByteArray, grammarJson: String): JSONObject {
    val out = JSONObject()
    var peak = 0
    var i = 0
    while (i + 1 < data.size) {
      val sample = ((data[i + 1].toInt() shl 8) or (data[i].toInt() and 0xff)).toShort().toInt()
      val abs = if (sample < 0) -sample else sample
      if (abs > peak) peak = abs
      i += 2
    }
    out.put("peak", peak / 32768.0)
    val m = model
    if (m == null) return out.put("ok", false).put("error", "model not loaded")
    return try {
      // An empty list means free recognition (a whole sentence); otherwise only the words of the list can be heard
      val free = grammarJson.isBlank() || grammarJson.trim() == "[]"
      (if (free) Recognizer(m, SAMPLE_RATE.toFloat()) else Recognizer(m, SAMPLE_RATE.toFloat(), grammarJson)).use { rec ->
        rec.setWords(true)
        var offset = 0
        while (offset < data.size) {
          val len = minOf(4000, data.size - offset)
          rec.acceptWaveForm(data.copyOfRange(offset, offset + len), len)
          offset += len
        }
        val result = JSONObject(rec.finalResult)
        val words = JSONArray()
        val list = result.optJSONArray("result")
        if (list != null) {
          for (k in 0 until list.length()) {
            val w = list.getJSONObject(k)
            words.put(JSONObject().put("word", w.optString("word")).put("conf", w.optDouble("conf", 0.0)))
          }
        }
        out.put("ok", true).put("text", result.optString("text")).put("words", words)
      }
    } catch (e: Throwable) {
      out.put("ok", false).put("error", e.message ?: e.javaClass.simpleName)
    }
  }

  @JavascriptInterface
  fun cancel() {
    recording = false
    try {
      recorder?.stop()
    } catch (e: Exception) {
    }
    recorder?.release()
    recorder = null
  }

  /** Play back the last recording */
  @JavascriptInterface
  fun playLast() {
    val data = lastPcm
    if (data.isEmpty()) return
    try {
      track?.release()
      val t = AudioTrack(
        AudioManager.STREAM_MUSIC,
        SAMPLE_RATE,
        AudioFormat.CHANNEL_OUT_MONO,
        AudioFormat.ENCODING_PCM_16BIT,
        data.size,
        AudioTrack.MODE_STATIC
      )
      t.write(data, 0, data.size)
      track = t
      t.play()
    } catch (e: Exception) {
    }
  }

  fun shutdown() {
    cancel()
    track?.release()
    track = null
    model?.close()
    model = null
  }
}
