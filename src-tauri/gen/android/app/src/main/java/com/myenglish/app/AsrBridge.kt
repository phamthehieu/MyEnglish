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
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.zip.ZipInputStream

/** The one Vosk call the Java wrapper lacks: is a word in the model's dictionary? (-1 when it is not) */
interface VoskDictionary : Library {
  fun vosk_model_find_word(model: Pointer, word: String): Int
}

/**
 * Tells when the learner has stopped talking: speech began, then a stretch of quiet. The level of the room is
 * measured over the first moments of the recording, so a noisy room does not count as speech and a quiet one
 * does not need a loud voice.
 */
class SpeechEndpoint(
  /** The quiet that ends it: short for one word, longer for a sentence (a beginner pauses between words) */
  private val silenceMs: Int = 800,
) {
  private val calibrationMs = 300
  private val minSpeechMs = 200

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
 * shows it: "heard tree instead of three". Everything stays on the phone; only the model is downloaded, once.
 *
 * Results come back as DOM events, because a call from the page blocks the page until it returns:
 *   myenglish-asr-permission  detail: "true" | "false"
 *   myenglish-asr-ready       detail: JSON { ok, missing?, error? }
 *   myenglish-asr-download    while the model downloads: JSON { received, total }
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
    private const val MODEL_DIR = "vosk-model-en-0.15"
    private const val READY_MARKER = ".complete"

    // The model is not in the APK (it would add 41 MB to every download and update): it is fetched once, the
    // first time the learner speaks. Builds up to 0.4.1 carried it and already copied it to MODEL_DIR.
    private val MODEL_URLS = listOf("https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip")
    private const val MODEL_SHA256 = "30f26242c4eb449f948e42cb302dd7a686cb29a3423a8367f99ff41780942498"
    private const val MODEL_ZIP_ROOT = "vosk-model-small-en-us-0.15/"
    private const val MODEL_ZIP_BYTES = 41_205_931L
    // The zip and the unpacked model (71 MB) are both on disk for a moment
    private const val SPACE_NEEDED = 130L * 1024 * 1024
  }

  @Volatile private var model: Model? = null
  @Volatile private var loading = false
  @Volatile private var downloading = false
  @Volatile private var cancelDownload = false

  private val modelDir get() = File(activity.filesDir, MODEL_DIR)
  private fun modelOnPhone() = File(modelDir, READY_MARKER).exists()

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
    JSONObject()
      .put("permission", hasMic())
      .put("modelReady", model != null)
      .put("loading", loading)
      .put("modelOnPhone", modelOnPhone())
      .put("downloading", downloading)
      .put("downloadBytes", MODEL_ZIP_BYTES)
      .toString()

  @JavascriptInterface
  fun requestPermission() {
    if (hasMic()) emit("myenglish-asr-permission", "true") else activity.requestMic()
  }

  /**
   * Load the model that is on the phone, then fire myenglish-asr-ready. When it was never downloaded the event
   * says { ok: false, missing: true } and the page offers downloadModel().
   */
  @JavascriptInterface
  fun prepare() {
    if (model != null) {
      emit("myenglish-asr-ready", JSONObject().put("ok", true).toString())
      return
    }
    if (!modelOnPhone()) {
      emit("myenglish-asr-ready", JSONObject().put("ok", false).put("missing", true).put("error", "missing").toString())
      return
    }
    if (loading) return
    loading = true
    Thread { emit("myenglish-asr-ready", loadModel().toString()) }.start()
  }

  private fun loadModel(): JSONObject {
    val out = JSONObject()
    try {
      LibVosk.setLogLevel(LogLevel.WARNINGS)
      model = Model(modelDir.absolutePath)
      out.put("ok", true)
    } catch (e: Throwable) {
      out.put("ok", false).put("error", e.message ?: e.javaClass.simpleName)
    } finally {
      loading = false
    }
    return out
  }

  /**
   * Download the model (41 MB, once), check it, unpack it and load it. Progress comes as
   * myenglish-asr-download { received, total }; the end as myenglish-asr-ready, with
   * error "cancelled" | "space" | "network" | "corrupt" when it failed.
   */
  @JavascriptInterface
  fun downloadModel() {
    if (downloading || model != null) return
    downloading = true
    cancelDownload = false
    loading = true
    Thread {
      val zip = File(activity.cacheDir, "vosk-model.zip")
      val out = try {
        if (activity.filesDir.usableSpace < SPACE_NEEDED) throw ModelDownloadError("space")
        fetchModel(zip)
        unpackModel(zip)
        loadModel()
      } catch (e: Throwable) {
        loading = false
        val reason = when {
          cancelDownload -> "cancelled"
          e is ModelDownloadError -> e.message
          else -> "network"
        }
        JSONObject().put("ok", false).put("error", reason).put("detail", e.message ?: e.javaClass.simpleName)
      } finally {
        zip.delete()
        downloading = false
      }
      emit("myenglish-asr-ready", out.toString())
    }.start()
  }

  @JavascriptInterface
  fun cancelDownload() {
    cancelDownload = true
  }

  private class ModelDownloadError(reason: String) : Exception(reason)

  /** Try each address in turn; the file must match MODEL_SHA256 */
  private fun fetchModel(zip: File) {
    var last: Throwable = ModelDownloadError("network")
    for (address in MODEL_URLS) {
      try {
        val digest = MessageDigest.getInstance("SHA-256")
        val connection = URL(address).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 30_000
        try {
          if (connection.responseCode != 200) throw ModelDownloadError("network")
          val total = connection.contentLengthLong.takeIf { it > 0 } ?: MODEL_ZIP_BYTES
          var received = 0L
          var lastReport = 0L
          connection.inputStream.use { input ->
            FileOutputStream(zip).use { file ->
              val buffer = ByteArray(64 * 1024)
              while (true) {
                if (cancelDownload) throw ModelDownloadError("cancelled")
                val n = input.read(buffer)
                if (n < 0) break
                file.write(buffer, 0, n)
                digest.update(buffer, 0, n)
                received += n
                val now = System.currentTimeMillis()
                if (now - lastReport > 250) {
                  lastReport = now
                  emit("myenglish-asr-download", JSONObject().put("received", received).put("total", total).toString())
                }
              }
            }
          }
        } finally {
          connection.disconnect()
        }
        val hash = digest.digest().joinToString("") { "%02x".format(it) }
        if (hash != MODEL_SHA256) throw ModelDownloadError("corrupt")
        return
      } catch (e: Throwable) {
        if (cancelDownload) throw ModelDownloadError("cancelled")
        last = e
      }
    }
    throw last
  }

  /** Unpack next to the final folder, then swap it in: a half-unpacked model is never taken for a whole one */
  private fun unpackModel(zip: File) {
    val staging = File(activity.filesDir, "$MODEL_DIR.part")
    staging.deleteRecursively()
    staging.mkdirs()
    val root = staging.canonicalPath + File.separator
    ZipInputStream(zip.inputStream().buffered()).use { entries ->
      while (true) {
        if (cancelDownload) throw ModelDownloadError("cancelled")
        val entry = entries.nextEntry ?: break
        if (!entry.name.startsWith(MODEL_ZIP_ROOT)) continue
        val target = File(staging, entry.name.removePrefix(MODEL_ZIP_ROOT))
        if (!target.canonicalPath.startsWith(root) && target.canonicalPath != staging.canonicalPath) continue
        if (entry.isDirectory) {
          target.mkdirs()
        } else {
          target.parentFile?.mkdirs()
          FileOutputStream(target).use { entries.copyTo(it) }
        }
      }
    }
    if (!File(staging, "am/final.mdl").exists()) throw ModelDownloadError("corrupt")
    File(staging, READY_MARKER).writeText("ok")
    modelDir.deleteRecursively()
    if (!staging.renameTo(modelDir)) throw ModelDownloadError("space")
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
  fun start(): Boolean = startFor(800)

  /** Record until the learner has been quiet for `silenceMs` after speaking (myenglish-asr-endpoint), at most 15 s */
  @JavascriptInterface
  fun startFor(silenceMs: Int): Boolean {
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
      val endpoint = SpeechEndpoint(silenceMs.coerceIn(400, 4000))
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
    cancelDownload = true
    cancel()
    track?.release()
    track = null
    model?.close()
    model = null
  }
}
