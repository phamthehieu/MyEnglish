package com.myenglish.app

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.speech.tts.TextToSpeech
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

private object WidgetTtsSpeaker {
  private var tts: TextToSpeech? = null
  private var ready = false
  private var pendingWord: String? = null

  fun speak(context: Context, rawWord: String, onDone: (() -> Unit)? = null) {
    val clean = rawWord
      .replace("❌", "")
      .replace("✅", "")
      .replace("→", "")
      .trim()
    if (clean.isEmpty()) {
      onDone?.invoke()
      return
    }
    val appCtx = context.applicationContext
    if (tts != null && ready) {
      tts?.speak(clean, TextToSpeech.QUEUE_FLUSH, null, "widget_tts")
      Handler(Looper.getMainLooper()).postDelayed({ onDone?.invoke() }, 900)
      return
    }
    pendingWord = clean
    if (tts == null) {
      tts = TextToSpeech(appCtx) { status ->
        if (status == TextToSpeech.SUCCESS) {
          tts?.language = Locale.US
          tts?.setSpeechRate(0.95f)
          ready = true
          pendingWord?.let { w ->
            pendingWord = null
            tts?.speak(w, TextToSpeech.QUEUE_FLUSH, null, "widget_tts")
          }
        }
        Handler(Looper.getMainLooper()).postDelayed({ onDone?.invoke() }, 1200)
      }
    } else {
      Handler(Looper.getMainLooper()).postDelayed({ onDone?.invoke() }, 1200)
    }
  }
}

class VocabWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
    refreshAllWidgets(context, advance = false)
    scheduleNextRotation(context)
  }

  override fun onAppWidgetOptionsChanged(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetId: Int,
    newOptions: Bundle
  ) {
    super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions)
    refreshAllWidgets(context, advance = false)
  }

  override fun onEnabled(context: Context) {
    super.onEnabled(context)
    refreshAllWidgets(context, advance = false)
    scheduleNextRotation(context)
  }

  override fun onDisabled(context: Context) {
    super.onDisabled(context)
    cancelRotation(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    super.onReceive(context, intent)
    when (intent.action) {
      ACTION_SPEAK_WORD -> {
        val word = intent.getStringExtra("word") ?: currentCard(context).word
        val pendingResult = goAsync()
        WidgetTtsSpeaker.speak(context, word) {
          try {
            pendingResult.finish()
          } catch (_: Exception) {}
        }
      }
      ACTION_NEXT_WORD, ACTION_AUTO_ROTATE, Intent.ACTION_USER_PRESENT, Intent.ACTION_CONFIGURATION_CHANGED -> {
        val advance = intent.action != Intent.ACTION_CONFIGURATION_CHANGED
        refreshAllWidgets(context, advance = advance)
        scheduleNextRotation(context)
      }
    }
  }

  companion object {
    const val ACTION_NEXT_WORD = "com.myenglish.app.WIDGET_NEXT_WORD"
    const val ACTION_AUTO_ROTATE = "com.myenglish.app.WIDGET_AUTO_ROTATE"
    const val ACTION_SPEAK_WORD = "com.myenglish.app.WIDGET_SPEAK_WORD"
    private const val PREFS_NAME = "myenglish_widget_prefs"
    private const val KEY_CARDS = "widget_cards_json"
    private const val KEY_QUIZ = "widget_quiz_json"
    private const val KEY_INDEX = "widget_card_index"
    private const val KEY_THEME = "widget_theme_mode"
    /** Rotate word automatically every 4 minutes (within the 3-5 minute window) */
    private const val ROTATE_INTERVAL_MS = 4 * 60 * 1000L
    private const val ROTATE_REQUEST_CODE = 88410

    data class WidgetCard(
      val tag: String,
      val word: String,
      val pos: String,
      val ipa: String,
      val meaning: String,
      val example: String,
      val exampleVn: String
    )

    private val FALLBACK_CARDS = listOf(
      WidgetCard("Từ công sở", "schedule", "(n./v.)", "/ˈskedʒuːl/", "lịch trình, sắp xếp lịch", "Let me check my schedule for tomorrow.", "Để tôi kiểm tra lịch trình ngày mai."),
      WidgetCard("Từ hay nhầm", "colleague", "(n.)", "/ˈkɒliːɡ/", "đồng nghiệp", "I had lunch with two colleagues today.", "Hôm nay tôi ăn trưa cùng hai đồng nghiệp."),
      WidgetCard("Từ công sở", "deadline", "(n.)", "/ˈdedlaɪn/", "hạn chót hoàn thành", "We need to meet the deadline on Friday.", "Chúng ta cần kịp hạn chót vào thứ Sáu."),
      WidgetCard("Từ thông dụng", "available", "(adj.)", "/əˈveɪləbl/", "có sẵn, đang rảnh", "Are you available for a quick call at 3 PM?", "Bạn có rảnh để gọi nhanh lúc 3 giờ chiều không?"),
      WidgetCard("Từ công sở", "confirm", "(v.)", "/kənˈfɜːm/", "xác nhận", "Please confirm your attendance by email.", "Vui lòng xác nhận việc tham dự qua email."),
      WidgetCard("Lỗi hay mắc", "I am agree", "→ Sửa lỗi", "→ I agree", "Không dùng 'am' trước động từ thường 'agree'", "I completely agree with your point.", "Tôi hoàn toàn đồng ý với ý kiến của bạn."),
      WidgetCard("Từ thông dụng", "prepare", "(v.)", "/prɪˈpeə(r)/", "chuẩn bị", "I need time to prepare for the meeting.", "Tôi cần thời gian chuẩn bị cho cuộc họp."),
      WidgetCard("Từ hay nhầm", "experience", "(n.)", "/ɪkˈspɪəriəns/", "kinh nghiệm, trải nghiệm", "She has five years of experience in this field.", "Cô ấy có 5 năm kinh nghiệm trong lĩnh vực này.")
    )

    /** Built-in collocations & examples for frequent words so the right-side context panel is never empty */
    private val BUILTIN_CONTEXT = mapOf(
      "run" to Pair("run a project · run out of time", "điều hành dự án · hết thời gian"),
      "make" to Pair("make a decision · make progress", "đưa ra quyết định · tiến bộ"),
      "take" to Pair("take responsibility · take notes", "chịu trách nhiệm · ghi chú"),
      "get" to Pair("get back to you · get things done", "phản hồi lại bạn · hoàn thành việc"),
      "work" to Pair("work closely with · work overtime", "làm việc sát sao với · tăng ca"),
      "time" to Pair("on time · save time for important tasks", "đúng giờ · tiết kiệm thời gian"),
      "keep" to Pair("keep in touch · keep track of progress", "giữ liên lạc · theo dõi tiến độ"),
      "give" to Pair("give feedback · give a presentation", "đưa phản hồi · thuyết trình"),
      "call" to Pair("schedule a call · return a call", "lên lịch cuộc gọi · gọi lại"),
      "check" to Pair("double-check the report · check in", "kiểm tra kỹ báo cáo · điểm danh"),
      "plan" to Pair("action plan · plan ahead for next week", "kế hoạch hành động · tính trước tuần sau"),
      "help" to Pair("Thank you for your help today.", "Cảm ơn sự giúp đỡ của bạn hôm nay."),
      "need" to Pair("Let me know if you need any support.", "Báo tôi nếu bạn cần hỗ trợ nhé."),
      "update" to Pair("Could you send me a quick update?", "Bạn gửi giúp tôi cập nhật nhanh nhé?")
    )

    private fun ensureContext(
      word: String,
      meaning: String,
      rawExample: String,
      rawExampleVn: String
    ): Pair<String, String> {
      if (rawExample.isNotBlank()) {
        val vn = rawExampleVn.ifBlank { "Nghĩa từ: $meaning" }
        return Pair(rawExample, vn)
      }
      val key = word.lowercase(Locale.ROOT).trim()
      BUILTIN_CONTEXT[key]?.let { return it }
      if (word.startsWith("❌")) {
        return Pair("Hãy chú ý tránh lỗi diễn đạt này khi nói & viết.", meaning)
      }
      return Pair(
        "Use \"$word\" in a short sentence today.",
        "Đặt 1 câu ngắn với \"$word\" ($meaning) để nhớ lâu."
      )
    }

    fun saveWidgetData(context: Context, cardsJson: String, quizJson: String) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_CARDS, cardsJson)
        .apply {
          if (quizJson.isNotBlank()) putString(KEY_QUIZ, quizJson)
        }
        .apply()
      refreshAllWidgets(context, advance = false)
      scheduleNextRotation(context)
    }

    fun saveThemeMode(context: Context, mode: String) {
      context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        .edit()
        .putString(KEY_THEME, mode)
        .apply()
      refreshAllWidgets(context, advance = false)
    }

    private fun isDarkTheme(context: Context): Boolean {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      return when (prefs.getString(KEY_THEME, "dark")) {
        "light" -> false
        "dark" -> true
        else -> {
          val nightMask = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
          nightMask == Configuration.UI_MODE_NIGHT_YES
        }
      }
    }

    fun isWidgetPinned(context: Context): Boolean {
      return try {
        val mgr = AppWidgetManager.getInstance(context)
        val ids = mgr.getAppWidgetIds(ComponentName(context, VocabWidgetProvider::class.java))
        ids != null && ids.isNotEmpty()
      } catch (_: Exception) {
        false
      }
    }

    fun requestPin(context: Context): Boolean {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
      return try {
        val mgr = AppWidgetManager.getInstance(context)
        if (!mgr.isRequestPinAppWidgetSupported) return false
        val provider = ComponentName(context, VocabWidgetProvider::class.java)
        mgr.requestPinAppWidget(provider, null, null)
      } catch (_: Exception) {
        false
      }
    }

    private fun loadCards(context: Context): List<WidgetCard> {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val raw = prefs.getString(KEY_CARDS, null)
      if (!raw.isNullOrBlank()) {
        try {
          val arr = JSONArray(raw)
          val list = ArrayList<WidgetCard>(arr.length())
          for (i in 0 until arr.length()) {
            val o = arr.optJSONObject(i) ?: continue
            val word = o.optString("word").trim()
            val meaning = o.optString("meaning").trim()
            if (word.isEmpty() || meaning.isEmpty()) continue
            val (exEn, exVn) = ensureContext(
              word = word,
              meaning = meaning,
              rawExample = o.optString("example", "").trim(),
              rawExampleVn = o.optString("exampleVn", "").trim()
            )
            list.add(
              WidgetCard(
                tag = o.optString("tag", "Từ cần ôn").ifBlank { "Từ cần ôn" },
                word = word,
                pos = o.optString("pos", "").trim(),
                ipa = o.optString("ipa", "").trim(),
                meaning = meaning,
                example = exEn,
                exampleVn = exVn
              )
            )
          }
          if (list.isNotEmpty()) return list
        } catch (_: Exception) {}
      }
      return FALLBACK_CARDS
    }

    private fun currentCard(context: Context): WidgetCard {
      val cards = loadCards(context)
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val idx = prefs.getInt(KEY_INDEX, 0).coerceIn(0, (cards.size - 1).coerceAtLeast(0))
      return cards[idx]
    }

    private fun buildQuizJson(context: Context, cards: List<WidgetCard>): String {
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      val savedQuiz = prefs.getString(KEY_QUIZ, null)
      if (!savedQuiz.isNullOrBlank() && savedQuiz != "[]") return savedQuiz

      val wordCards = cards.filter { !it.word.startsWith("❌") && !it.ipa.startsWith("→") }
      val source = if (wordCards.size >= 4) wordCards else FALLBACK_CARDS.filter { !it.ipa.startsWith("→") }
      val quizArr = JSONArray()
      for (i in source.indices.take(6)) {
        val target = source[i]
        val distractors = source.filter { it.word != target.word }.shuffled().take(3)
        val options = (listOf(target) + distractors).shuffled()
        val optsArr = JSONArray()
        for ((idx, opt) in options.withIndex()) {
          optsArr.put(
            JSONObject()
              .put("id", "opt_$idx")
              .put("text", opt.meaning)
              .put("isCorrect", opt.word == target.word)
          )
        }
        quizArr.put(
          JSONObject()
            .put("wordId", target.word)
            .put("word", target.word)
            .put("phonetic", target.ipa)
            .put("options", optsArr)
        )
      }
      return quizArr.toString()
    }

    fun refreshAllWidgets(context: Context, advance: Boolean) {
      val mgr = AppWidgetManager.getInstance(context)
      val ids = mgr.getAppWidgetIds(ComponentName(context, VocabWidgetProvider::class.java))
      if (ids == null || ids.isEmpty()) return

      val cards = loadCards(context)
      val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
      var idx = prefs.getInt(KEY_INDEX, 0)
      if (advance) {
        idx = (idx + 1) % cards.size
        prefs.edit().putInt(KEY_INDEX, idx).apply()
      } else if (idx >= cards.size || idx < 0) {
        idx = 0
      }
      val card = cards[idx]
      val quizJson = buildQuizJson(context, cards)
      val dark = isDarkTheme(context)

      for (widgetId in ids) {
        val opts = mgr.getAppWidgetOptions(widgetId)
        val minW = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250)
        val minH = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 80)

        // Responsive layout:
        // - showHeader: shown whenever height >= 68dp or width >= 210dp (carries tag, counter, 🔊, ➕, ⚡, ↻)
        // - showRightContextCol: shown whenever width >= 210dp (fills the horizontal space in 3x1, 4x1, 4x2!)
        // - showBottomActions: only when dragged tall (minH >= 155dp)
        val showHeader = minH >= 68 || minW >= 210
        val showRightContextCol = minW >= 210
        val showBottomActions = minH >= 155 && minW >= 200
        val showIpa = minW >= 145 && card.ipa.isNotBlank()
        val showPos = card.pos.isNotBlank()

        val views = RemoteViews(context.packageName, R.layout.vocab_widget)

        // Theme colors & backgrounds
        views.setInt(
          R.id.widget_root,
          "setBackgroundResource",
          if (dark) R.drawable.widget_bg_dark else R.drawable.widget_bg
        )
        views.setInt(
          R.id.widget_tag,
          "setBackgroundResource",
          if (dark) R.drawable.widget_badge_bg_dark else R.drawable.widget_badge_bg
        )
        views.setInt(
          R.id.widget_right_col,
          "setBackgroundResource",
          if (dark) R.drawable.widget_context_box_dark else R.drawable.widget_context_box_light
        )

        views.setTextColor(R.id.widget_tag, Color.parseColor(if (dark) "#99F6E4" else "#115E59"))
        views.setTextColor(R.id.widget_counter, Color.parseColor(if (dark) "#A1A1AA" else "#64748B"))
        views.setTextColor(R.id.widget_word, Color.parseColor(if (dark) "#F4F4F5" else "#0F172A"))
        views.setTextColor(R.id.widget_pos, Color.parseColor(if (dark) "#94A3B8" else "#64748B"))
        views.setTextColor(R.id.widget_ipa, Color.parseColor(if (dark) "#A1A1AA" else "#64748B"))
        views.setTextColor(R.id.widget_meaning, Color.parseColor(if (dark) "#5EEAD4" else "#0F766E"))
        views.setTextColor(R.id.widget_context_label, Color.parseColor(if (dark) "#5EEAD4" else "#0F766E"))
        views.setTextColor(R.id.widget_example, Color.parseColor(if (dark) "#E4E4E7" else "#1E293B"))
        views.setTextColor(R.id.widget_example_vn, Color.parseColor(if (dark) "#A1A1AA" else "#64748B"))

        val secBtnBg = if (dark) R.drawable.widget_btn_secondary_dark else R.drawable.widget_btn_secondary
        val secBtnColor = Color.parseColor(if (dark) "#5EEAD4" else "#0F766E")
        for (btnId in intArrayOf(
          R.id.widget_btn_speak,
          R.id.widget_btn_add_top,
          R.id.widget_btn_quiz_top,
          R.id.widget_btn_next,
          R.id.widget_btn_speak_compact,
          R.id.widget_btn_next_compact,
          R.id.widget_btn_add
        )) {
          views.setInt(btnId, "setBackgroundResource", secBtnBg)
          views.setTextColor(btnId, secBtnColor)
        }

        // Visibility by size tier
        views.setViewVisibility(R.id.widget_header_row, if (showHeader) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_btn_speak_compact, if (!showHeader) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_btn_next_compact, if (!showHeader) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_btn_add_top, if (minW >= 185) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_btn_quiz_top, if (minW >= 185) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_pos, if (showPos) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_ipa, if (showIpa) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_right_col, if (showRightContextCol) View.VISIBLE else View.GONE)
        views.setViewVisibility(R.id.widget_actions_row, if (showBottomActions) View.VISIBLE else View.GONE)

        // Populate content
        views.setTextViewText(R.id.widget_tag, card.tag)
        views.setTextViewText(
          R.id.widget_counter,
          if (minW >= 260) "${idx + 1}/${cards.size} · tự đổi 4p" else "${idx + 1}/${cards.size}"
        )
        views.setTextViewText(R.id.widget_btn_speak, if (minW >= 270) "🔊 Nghe" else "🔊")
        views.setTextViewText(R.id.widget_btn_next, if (minW >= 290) "↻ Đổi" else "↻")
        views.setTextViewText(R.id.widget_word, card.word)
        views.setTextViewText(R.id.widget_pos, card.pos)
        views.setTextViewText(R.id.widget_ipa, card.ipa)
        views.setTextViewText(R.id.widget_meaning, card.meaning)
        views.setTextViewText(R.id.widget_example, card.example)
        views.setTextViewText(R.id.widget_example_vn, card.exampleVn)

        // 1. "↻" Next word intent
        val nextIntent = Intent(context, VocabWidgetProvider::class.java).apply {
          action = ACTION_NEXT_WORD
        }
        val nextPending = PendingIntent.getBroadcast(
          context,
          ROTATE_REQUEST_CODE + 1,
          nextIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_btn_next, nextPending)
        views.setOnClickPendingIntent(R.id.widget_btn_next_compact, nextPending)

        // 2. "🔊" Speak word intent (direct TTS on home screen)
        val speakIntent = Intent(context, VocabWidgetProvider::class.java).apply {
          action = ACTION_SPEAK_WORD
          putExtra("word", card.word)
        }
        val speakPending = PendingIntent.getBroadcast(
          context,
          ROTATE_REQUEST_CODE + 5,
          speakIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_btn_speak, speakPending)
        views.setOnClickPendingIntent(R.id.widget_btn_speak_compact, speakPending)

        // 3. "➕" Quick Add Word intent
        val addIntent = Intent(context, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          putExtra("action", "quick_add_word")
        }
        val addPending = PendingIntent.getActivity(
          context,
          ROTATE_REQUEST_CODE + 2,
          addIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_btn_add_top, addPending)
        views.setOnClickPendingIntent(R.id.widget_btn_add, addPending)

        // 4. "⚡" Quick Flash-Quiz overlay intent
        val quizIntent = Intent(context, FloatingNudgeActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_EXCLUDE_FROM_RECENTS)
          putExtra("title", "Ôn nhanh từ hay sai ⚡")
          putExtra("body", "Làm nhanh vài câu ngay trên màn hình chính.")
          putExtra("dueCount", cards.size)
          putExtra("quiz", quizJson)
          putExtra("autoStart", true)
        }
        val quizPending = PendingIntent.getActivity(
          context,
          ROTATE_REQUEST_CODE + 3,
          quizIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_btn_quiz_top, quizPending)
        views.setOnClickPendingIntent(R.id.widget_btn_quiz, quizPending)

        // 5. Tap left column or right context box -> open MainActivity
        val openAppIntent = Intent(context, MainActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        val openAppPending = PendingIntent.getActivity(
          context,
          ROTATE_REQUEST_CODE + 4,
          openAppIntent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        views.setOnClickPendingIntent(R.id.widget_card_body, openAppPending)

        mgr.updateAppWidget(widgetId, views)
      }
    }

    fun scheduleNextRotation(context: Context) {
      if (!isWidgetPinned(context)) return
      try {
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, VocabWidgetProvider::class.java).apply {
          action = ACTION_AUTO_ROTATE
        }
        val pi = PendingIntent.getBroadcast(
          context,
          ROTATE_REQUEST_CODE,
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val triggerAt = SystemClock.elapsedRealtime() + ROTATE_INTERVAL_MS
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          alarms.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME, triggerAt, pi)
        } else {
          alarms.set(AlarmManager.ELAPSED_REALTIME, triggerAt, pi)
        }
      } catch (_: Exception) {}
    }

    fun cancelRotation(context: Context) {
      try {
        val alarms = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, VocabWidgetProvider::class.java).apply {
          action = ACTION_AUTO_ROTATE
        }
        val pi = PendingIntent.getBroadcast(
          context,
          ROTATE_REQUEST_CODE,
          intent,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        alarms.cancel(pi)
      } catch (_: Exception) {}
    }
  }
}
