package com.myenglish.app

import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.RippleDrawable
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.speech.tts.TextToSpeech
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.LinearInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.Locale
import org.json.JSONArray
import org.json.JSONObject

class FloatingNudgeActivity : Activity() {

  private var isPaused = false
  private var totalMs = 20_000L
  private var remainingMs = 20_000L
  private var countdownAnimator: ValueAnimator? = null

  private var quizJsonStr: String? = null
  private var quizListJsonStr: String? = null
  private var titleText: String = "Đến giờ ôn tập rồi bạn ơi! 🦉"
  private var bodyText: String = "Vài phút ôn từ giúp bạn nhớ lâu hơn."
  private var dueCount: Int = 0

  private lateinit var cardContainer: LinearLayout
  private lateinit var contentBox: LinearLayout
  private lateinit var countdownTrack: FrameLayout
  private lateinit var countdownIndicator: View
  private lateinit var timerBadge: TextView

  // Multi-question session state for floating Flash-Quiz dialog
  private var currentQuizIndex = 0
  private var totalQuestionsInSession = 1
  private val sessionQuizList = ArrayList<JSONObject>()
  private var correctCountInSession = 0

  // Text-To-Speech for pronouncing vocabulary words
  private var tts: TextToSpeech? = null
  private var ttsReady = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }

    // Configure dialog window to sit comfortably near top of screen
    window.setBackgroundDrawableResource(android.R.color.transparent)
    window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
    window.setDimAmount(0.35f)

    val lp = window.attributes
    lp.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
    lp.width = WindowManager.LayoutParams.MATCH_PARENT
    lp.height = WindowManager.LayoutParams.WRAP_CONTENT
    lp.y = dpToPx(36)
    window.attributes = lp

    titleText = intent.getStringExtra("title") ?: titleText
    bodyText = intent.getStringExtra("body") ?: bodyText
    dueCount = intent.getIntExtra("dueCount", 0)
    quizJsonStr = intent.getStringExtra("quiz")
    quizListJsonStr = intent.getStringExtra("quizList")

    initTts()
    buildUi()
    startCountdown(remainingMs)
    // Opened by the notification's "▶ Học ngay": go straight to the quiz, as that button does on the card
    if (intent.getBooleanExtra("autoStart", false)) startQuizSession(maxQuestions = 10)
  }

  /** The card is a single instance: a second launch (the notification's button while the card is up) arrives here */
  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    // A session already running is left alone; a card still waiting for a tap starts its quiz
    if (intent.getBooleanExtra("autoStart", false) && sessionQuizList.isEmpty()) {
      quizJsonStr = intent.getStringExtra("quiz") ?: quizJsonStr
      quizListJsonStr = intent.getStringExtra("quizList") ?: quizListJsonStr
      startQuizSession(maxQuestions = 10)
    }
  }

  private fun initTts() {
    try {
      tts = TextToSpeech(this) { status ->
        if (status == TextToSpeech.SUCCESS) {
          val result = tts?.setLanguage(Locale.US)
          ttsReady = (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED)
        }
      }
    } catch (_: Exception) {}
  }

  private fun speakWord(word: String) {
    if (!ttsReady || word.isBlank()) return
    try {
      tts?.speak(word, TextToSpeech.QUEUE_FLUSH, null, "flash_quiz_speech")
    } catch (_: Exception) {}
  }

  private fun dpToPx(dp: Int): Int =
    TypedValue.applyDimension(
      TypedValue.COMPLEX_UNIT_DIP,
      dp.toFloat(),
      resources.displayMetrics
    ).toInt()

  private fun buildUi() {
    // Root container with horizontal padding for margins
    val root = FrameLayout(this).apply {
      layoutParams = ViewGroup.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      )
      setPadding(dpToPx(14), 0, dpToPx(14), dpToPx(16))
    }

    // Floating Card with deep zinc dark background, 22dp corners, 1dp subtle border
    val cardBg = GradientDrawable().apply {
      setColor(Color.parseColor("#18181b"))
      cornerRadius = dpToPx(22).toFloat()
      setStroke(dpToPx(1), Color.parseColor("#3f3f46"))
    }

    cardContainer = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.WRAP_CONTENT
      )
      background = cardBg
      elevation = dpToPx(12).toFloat()
      clipToOutline = true
    }

    // Pause countdown when touching the card; resume on touch release
    cardContainer.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> pauseCountdown()
        MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> resumeCountdown()
      }
      false
    }

    contentBox = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
      setPadding(dpToPx(16), dpToPx(14), dpToPx(16), dpToPx(12))
    }
    cardContainer.addView(contentBox)

    // Bottom Countdown Progress Bar:
    // FrameLayout track (dark zinc background), containing the emerald green indicator shrinking from right to left
    countdownTrack = FrameLayout(this).apply {
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        dpToPx(4)
      )
      setBackgroundColor(Color.parseColor("#27272a"))
    }

    countdownIndicator = View(this).apply {
      layoutParams = FrameLayout.LayoutParams(
        FrameLayout.LayoutParams.MATCH_PARENT,
        FrameLayout.LayoutParams.MATCH_PARENT
      )
      background = GradientDrawable(
        GradientDrawable.Orientation.LEFT_RIGHT,
        intArrayOf(Color.parseColor("#0f766e"), Color.parseColor("#0f766e"))
      )
      pivotX = 0f
    }
    countdownTrack.addView(countdownIndicator)
    cardContainer.addView(countdownTrack)

    root.addView(cardContainer)
    setContentView(root)

    // Default: Always show the floating Nudge card (Owl icon, title, buttons, countdown bar)
    renderNudgeMode()
  }

  private fun switchToNudgeWindowLayout() {
    val lp = window.attributes
    lp.gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
    lp.y = dpToPx(36)
    window.setDimAmount(0.35f)
    window.attributes = lp
  }

  private fun switchToQuizWindowLayout() {
    val lp = window.attributes
    lp.gravity = Gravity.CENTER
    lp.y = 0
    window.setDimAmount(0.60f)
    window.attributes = lp
  }

  /** Mode 1: Floating Nudge prompt (Owl icon, title, subtitle, Play button, 1-quiz button, footer links) */
  private fun renderNudgeMode() {
    switchToNudgeWindowLayout()
    contentBox.removeAllViews()
    countdownTrack.visibility = View.VISIBLE

    // 1. Header Row
    val headerRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    }

    // Mascot badge (emerald gradient rounded box with owl)
    val mascotBadge = TextView(this).apply {
      text = "🦉"
      textSize = 20f
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(dpToPx(38), dpToPx(38)).apply {
        marginEnd = dpToPx(10)
      }
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor("#0f766e"), Color.parseColor("#115e59"))
      ).apply {
        cornerRadius = dpToPx(12).toFloat()
      }
    }
    headerRow.addView(mascotBadge)

    // Title & subtitle column
    val textCol = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
    }

    val titleView = TextView(this).apply {
      text = titleText
      setTextColor(Color.WHITE)
      textSize = 13.5f
      setTypeface(typeface, Typeface.BOLD)
      maxLines = 1
    }
    textCol.addView(titleView)

    val subtitleView = TextView(this).apply {
      text = if (dueCount > 0) "Có $dueCount từ cần điểm danh · khoảng 4 phút" else bodyText
      setTextColor(Color.parseColor("#a1a1aa"))
      textSize = 11.5f
      maxLines = 2
      setPadding(0, dpToPx(2), 0, 0)
    }
    textCol.addView(subtitleView)
    headerRow.addView(textCol)

    // Countdown timer badge (e.g. "20s")
    timerBadge = TextView(this).apply {
      val secs = Math.ceil(remainingMs / 1000.0).toInt().coerceAtLeast(0)
      text = "${secs}s"
      setTextColor(Color.parseColor("#5eead4"))
      textSize = 11.5f
      setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        marginEnd = dpToPx(6)
      }
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#134e4a"))
        cornerRadius = dpToPx(6).toFloat()
        setStroke(dpToPx(1), Color.parseColor("#0f766e"))
      }
      setPadding(dpToPx(6), dpToPx(2), dpToPx(6), dpToPx(2))
    }
    headerRow.addView(timerBadge)

    // Close button "✕"
    val closeBtn = TextView(this).apply {
      text = "✕"
      setTextColor(Color.parseColor("#71717a"))
      textSize = 14f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(dpToPx(28), dpToPx(28))
      setOnClickListener { finish() }
    }
    headerRow.addView(closeBtn)
    contentBox.addView(headerRow)

    // 2. Action Buttons Row: "▶ Học ngay" (opens 3-question Flash-Quiz dialog) & "⚡ 1 câu" (opens 1-question quiz dialog)
    val actionsRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dpToPx(12)
      }
    }

    // Primary Button: "▶ Học ngay" -> Opens Flash-Quiz dialog session right on this floating card over the screen!
    val primaryBg = RippleDrawable(
      ColorStateList.valueOf(Color.parseColor("#5eead4")),
      GradientDrawable().apply {
        setColor(Color.parseColor("#0f766e"))
        cornerRadius = dpToPx(12).toFloat()
      },
      null
    )
    val playBtn = TextView(this).apply {
      text = "▶ Học ngay"
      setTextColor(Color.WHITE)
      textSize = 12.5f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      background = primaryBg
      layoutParams = LinearLayout.LayoutParams(0, dpToPx(38), 1f)
      setOnClickListener {
        startQuizSession(maxQuestions = 10)
      }
    }
    actionsRow.addView(playBtn)

    // Secondary Button: "⚡ 1 câu" -> Opens single question quiz dialog
    val quizBtnBg = RippleDrawable(
      ColorStateList.valueOf(Color.parseColor("#115e59")),
      GradientDrawable().apply {
        setColor(Color.parseColor("#27272a"))
        cornerRadius = dpToPx(12).toFloat()
        setStroke(dpToPx(1), Color.parseColor("#3f3f46"))
      },
      null
    )
    val quizBtn = TextView(this).apply {
      text = "⚡ 10 câu"
      setTextColor(Color.parseColor("#99f6e4"))
      textSize = 12f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      background = quizBtnBg
      layoutParams = LinearLayout.LayoutParams(dpToPx(84), dpToPx(38)).apply {
        marginStart = dpToPx(8)
      }
      setOnClickListener {
        startQuizSession(maxQuestions = 10)
      }
    }
    actionsRow.addView(quizBtn)
    contentBox.addView(actionsRow)

    // 3. Footer Links Row: "🎯 Tập trung 10 phút" (opens main app) & "⏱ Hoãn 10 phút"
    val footerRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dpToPx(10)
      }
    }

    val focusLink = TextView(this).apply {
      text = "🎯 Tập trung 10 phút"
      setTextColor(Color.parseColor("#5eead4"))
      textSize = 11f
      setTypeface(typeface, Typeface.BOLD)
      setOnClickListener {
        openMainActivity("focus", 10)
      }
    }
    footerRow.addView(focusLink)

    val spacer = View(this).apply {
      layoutParams = LinearLayout.LayoutParams(0, 0, 1f)
    }
    footerRow.addView(spacer)

    val snoozeLink = TextView(this).apply {
      text = "⏱ Hoãn 10 phút"
      setTextColor(Color.parseColor("#71717a"))
      textSize = 11f
      setTypeface(typeface, Typeface.NORMAL)
      setOnClickListener {
        ReminderScheduler.snooze(this@FloatingNudgeActivity, 10)
        ReminderScheduler.dismissAll(this@FloatingNudgeActivity)
        Toast.makeText(this@FloatingNudgeActivity, "Đã hoãn nhắc ôn tập 10 phút", Toast.LENGTH_SHORT).show()
        finish()
      }
    }
    footerRow.addView(snoozeLink)
    contentBox.addView(footerRow)
  }

  /** Mode 2: Flash-Quiz Dialog Session (Runs directly on centered floating dialog like FocusReviewModal without opening full app) */
  private fun startQuizSession(maxQuestions: Int) {
    pauseCountdown()
    countdownTrack.visibility = View.GONE
    switchToQuizWindowLayout()

    sessionQuizList.clear()
    currentQuizIndex = 0
    correctCountInSession = 0

    // Parse questions from quizList or single quiz, with fallback
    val listRaw = quizListJsonStr ?: intent.getStringExtra("quizList")
    if (!listRaw.isNullOrBlank()) {
      try {
        val arr = JSONArray(listRaw)
        for (i in 0 until arr.length()) {
          val obj = arr.optJSONObject(i) ?: continue
          if ((obj.optJSONArray("options")?.length() ?: 0) > 0) {
            sessionQuizList.add(obj)
          }
        }
      } catch (_: Exception) {}
    }

    if (sessionQuizList.isEmpty()) {
      // "quiz" is one question (object) or a whole session of today's / forgotten words (array)
      val singleRaw = (quizJsonStr ?: intent.getStringExtra("quiz"))?.trim()
      if (!singleRaw.isNullOrBlank()) {
        try {
          val items = if (singleRaw.startsWith("[")) {
            val arr = JSONArray(singleRaw)
            (0 until arr.length()).mapNotNull { arr.optJSONObject(it) }
          } else {
            listOf(JSONObject(singleRaw))
          }
          for (obj in items) {
            if ((obj.optJSONArray("options")?.length() ?: 0) > 0) sessionQuizList.add(obj)
          }
        } catch (_: Exception) {}
      }
    }

    if (sessionQuizList.isEmpty()) {
      sessionQuizList.addAll(getFallbackQuizList())
    }

    totalQuestionsInSession = minOf(maxQuestions, sessionQuizList.size).coerceAtLeast(1)
    renderCurrentQuizQuestion()
  }

  /** Renders the current Flash-Quiz question within the floating dialog card, styled just like FocusReviewModal ("Toàn màn hình") */
  private fun renderCurrentQuizQuestion() {
    contentBox.removeAllViews()

    if (currentQuizIndex >= sessionQuizList.size || currentQuizIndex >= totalQuestionsInSession) {
      renderQuizSummary()
      return
    }

    val quizObj = sessionQuizList[currentQuizIndex]
    val word = quizObj.optString("word", "")
    val promptTitle = quizObj.optString("promptTitle", "")
    val phonetic = quizObj.optString("phonetic", "")
    val direction = quizObj.optString("direction", "recognition")
    val optionsArray = quizObj.optJSONArray("options") ?: JSONArray()
    val wordId = quizObj.optString("wordId", "")
    val example = quizObj.optString("example", quizObj.optString("sentence", ""))

    // 1. Top Header Bar (matches FocusReviewModal header with Zap gradient squircle)
    val topRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
    }

    // ⚡ Zap gradient squircle
    val zapIcon = TextView(this).apply {
      text = "⚡"
      textSize = 13f
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(dpToPx(28), dpToPx(28)).apply {
        marginEnd = dpToPx(8)
      }
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor("#0f766e"), Color.parseColor("#115e59"))
      ).apply {
        cornerRadius = dpToPx(8).toFloat()
      }
    }
    topRow.addView(zapIcon)

    val quizTitle = TextView(this).apply {
      text = "FLASH-QUIZ"
      setTextColor(Color.WHITE)
      textSize = 12f
      setTypeface(typeface, Typeface.BOLD)
    }
    topRow.addView(quizTitle)

    val counterBadge = TextView(this).apply {
      text = "Câu ${currentQuizIndex + 1} / $totalQuestionsInSession"
      setTextColor(Color.parseColor("#5eead4"))
      textSize = 10.5f
      setTypeface(Typeface.MONOSPACE, Typeface.BOLD)
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#1e293b"))
        cornerRadius = dpToPx(6).toFloat()
        setStroke(dpToPx(1), Color.parseColor("#334155"))
      }
      setPadding(dpToPx(7), dpToPx(2), dpToPx(7), dpToPx(2))
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        marginStart = dpToPx(8)
      }
    }
    topRow.addView(counterBadge)

    val tagPill = TextView(this).apply {
      text = if (direction == "production") "Nhớ lại" else "Nhận diện"
      setTextColor(Color.parseColor("#a1a1aa"))
      textSize = 10f
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#27272a"))
        cornerRadius = dpToPx(6).toFloat()
      }
      setPadding(dpToPx(6), dpToPx(2), dpToPx(6), dpToPx(2))
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        marginStart = dpToPx(6)
      }
    }
    topRow.addView(tagPill)

    val spacer = View(this).apply { layoutParams = LinearLayout.LayoutParams(0, 0, 1f) }
    topRow.addView(spacer)

    // Speaker pronunciation button
    val targetPronounceWord = if (word.isNotBlank()) word else promptTitle
    val speakBtn = TextView(this).apply {
      text = "🔊"
      textSize = 14f
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(dpToPx(28), dpToPx(28)).apply {
        marginEnd = dpToPx(6)
      }
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#27272a"))
        cornerRadius = dpToPx(8).toFloat()
      }
      setOnClickListener {
        speakWord(targetPronounceWord)
      }
    }
    topRow.addView(speakBtn)

    // Button to return to Nudge card
    val backNudgeBtn = TextView(this).apply {
      text = "🦉 Nhắc"
      setTextColor(Color.parseColor("#5eead4"))
      textSize = 11f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#134e4a"))
        cornerRadius = dpToPx(8).toFloat()
        setStroke(dpToPx(1), Color.parseColor("#0f766e"))
      }
      setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4))
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.WRAP_CONTENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        marginEnd = dpToPx(6)
      }
      setOnClickListener {
        switchToNudgeWindowLayout()
        countdownTrack.visibility = View.VISIBLE
        renderNudgeMode()
        resumeCountdown()
      }
    }
    topRow.addView(backNudgeBtn)

    val closeBtn = TextView(this).apply {
      text = "✕"
      setTextColor(Color.parseColor("#71717a"))
      textSize = 14f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(dpToPx(28), dpToPx(28))
      setOnClickListener { finish() }
    }
    topRow.addView(closeBtn)
    contentBox.addView(topRow)

    // 2. Word Card (exact styling of FocusReviewModal question box)
    val wordCard = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dpToPx(12)
        bottomMargin = dpToPx(6)
      }
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#09090b"))
        cornerRadius = dpToPx(16).toFloat()
        setStroke(dpToPx(1), Color.parseColor("#27272a"))
      }
      setPadding(dpToPx(16), dpToPx(12), dpToPx(16), dpToPx(12))
    }

    val wordRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    val wordView = TextView(this).apply {
      text = if (promptTitle.isNotBlank()) promptTitle else word
      setTextColor(Color.WHITE)
      textSize = 21f
      setTypeface(typeface, Typeface.BOLD)
      setOnClickListener { speakWord(targetPronounceWord) }
    }
    wordRow.addView(wordView)

    if (phonetic.isNotBlank() && direction != "production") {
      val phoneticView = TextView(this).apply {
        text = phonetic
        setTextColor(Color.parseColor("#5eead4"))
        textSize = 12f
        setTypeface(Typeface.MONOSPACE, Typeface.NORMAL)
        setPadding(dpToPx(8), 0, 0, 0)
      }
      wordRow.addView(phoneticView)
    }
    wordCard.addView(wordRow)

    if (example.isNotBlank()) {
      val exampleView = TextView(this).apply {
        text = "\"$example\""
        setTextColor(Color.parseColor("#a1a1aa"))
        textSize = 11.5f
        setTypeface(typeface, Typeface.ITALIC)
        setPadding(0, dpToPx(6), 0, 0)
      }
      wordCard.addView(exampleView)
    }
    contentBox.addView(wordCard)

    // Prompt Label
    val promptLabel = TextView(this).apply {
      text = if (direction == "production") "Chọn từ tiếng Anh chính xác:" else "Chọn nghĩa đúng:"
      setTextColor(Color.parseColor("#71717a"))
      textSize = 11f
      setTypeface(typeface, Typeface.BOLD)
      setPadding(0, dpToPx(6), 0, dpToPx(4))
    }
    contentBox.addView(promptLabel)

    // 3. 4 Multiple Choice Option Cards
    val optionButtons = ArrayList<LinearLayout>()
    var answered = false
    val quizStartTime = System.currentTimeMillis()

    for (i in 0 until optionsArray.length()) {
      val opt = optionsArray.optJSONObject(i) ?: continue
      val optText = opt.optString("text", "")
      val isCorrect = opt.optBoolean("isCorrect", false)

      val optRow = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = Gravity.CENTER_VERTICAL
        layoutParams = LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
          topMargin = dpToPx(6)
        }
        background = GradientDrawable().apply {
          setColor(Color.parseColor("#27272a"))
          cornerRadius = dpToPx(12).toFloat()
          setStroke(dpToPx(1), Color.parseColor("#3f3f46"))
        }
        setPadding(dpToPx(12), dpToPx(10), dpToPx(12), dpToPx(10))
      }

      // Number badge [1], [2], [3], [4]
      val numBadge = TextView(this).apply {
        text = "${i + 1}"
        setTextColor(Color.parseColor("#71717a"))
        textSize = 11f
        setTypeface(typeface, Typeface.BOLD)
        gravity = Gravity.CENTER
        layoutParams = LinearLayout.LayoutParams(dpToPx(22), dpToPx(22)).apply {
          marginEnd = dpToPx(10)
        }
        background = GradientDrawable().apply {
          setColor(Color.parseColor("#18181b"))
          cornerRadius = dpToPx(6).toFloat()
        }
      }
      optRow.addView(numBadge)

      val optLabel = TextView(this).apply {
        text = optText
        setTextColor(Color.parseColor("#e4e4e7"))
        textSize = 12.5f
        setTypeface(typeface, Typeface.BOLD)
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
      }
      optRow.addView(optLabel)

      val checkIcon = TextView(this).apply {
        text = ""
        textSize = 13f
        setTypeface(typeface, Typeface.BOLD)
        gravity = Gravity.CENTER
        layoutParams = LinearLayout.LayoutParams(dpToPx(24), dpToPx(24))
      }
      optRow.addView(checkIcon)

      optRow.setOnClickListener {
        if (answered) return@setOnClickListener
        answered = true

        vibrateFeedback(isCorrect)
        if (isCorrect) correctCountInSession++

        val responseTime = System.currentTimeMillis() - quizStartTime
        ReminderScheduler.savePendingQuizAnswer(
          this@FloatingNudgeActivity,
          wordId,
          isCorrect,
          responseTime
        )

        for ((idx, btn) in optionButtons.withIndex()) {
          val optObj = optionsArray.optJSONObject(idx) ?: continue
          val thisIsCorrect = optObj.optBoolean("isCorrect", false)
          val icon = btn.getChildAt(2) as? TextView
          val num = btn.getChildAt(0) as? TextView
          val lbl = btn.getChildAt(1) as? TextView

          if (thisIsCorrect) {
            btn.background = GradientDrawable().apply {
              setColor(Color.parseColor("#134e4a"))
              cornerRadius = dpToPx(12).toFloat()
              setStroke(dpToPx(2), Color.parseColor("#0f766e"))
            }
            lbl?.setTextColor(Color.WHITE)
            num?.setTextColor(Color.WHITE)
            num?.background = GradientDrawable().apply {
              setColor(Color.parseColor("#0f766e"))
              cornerRadius = dpToPx(6).toFloat()
            }
            icon?.text = "✓"
            icon?.setTextColor(Color.parseColor("#5eead4"))
          } else if (btn == optRow && !isCorrect) {
            btn.background = GradientDrawable().apply {
              setColor(Color.parseColor("#450a0a"))
              cornerRadius = dpToPx(12).toFloat()
              setStroke(dpToPx(2), Color.parseColor("#ef4444"))
            }
            lbl?.setTextColor(Color.WHITE)
            num?.setTextColor(Color.WHITE)
            num?.background = GradientDrawable().apply {
              setColor(Color.parseColor("#dc2626"))
              cornerRadius = dpToPx(6).toFloat()
            }
            icon?.text = "✕"
            icon?.setTextColor(Color.parseColor("#f87171"))
          }
        }

        contentBox.postDelayed({
          if (isFinishing || isDestroyed) return@postDelayed
          if (currentQuizIndex + 1 < totalQuestionsInSession) {
            currentQuizIndex++
            renderCurrentQuizQuestion()
          } else {
            renderQuizSummary()
          }
        }, 1100L)
      }

      optionButtons.add(optRow)
      contentBox.addView(optRow)
    }
  }

  /** Summary view when finishing the Flash-Quiz session */
  private fun renderQuizSummary() {
    // The quiz is done: the reminder in the notification shade has nothing left to say
    ReminderScheduler.dismissAll(this)
    contentBox.removeAllViews()

    val rootSummary = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      layoutParams = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      )
      setPadding(0, dpToPx(8), 0, dpToPx(8))
    }

    val trophyView = TextView(this).apply {
      text = if (correctCountInSession == totalQuestionsInSession) "🏆" else "🎉"
      textSize = 34f
      gravity = Gravity.CENTER
    }
    rootSummary.addView(trophyView)

    val titleView = TextView(this).apply {
      text = "Hoàn thành phiên Flash-Quiz!"
      setTextColor(Color.parseColor("#5eead4"))
      textSize = 15f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(0, dpToPx(6), 0, 0)
    }
    rootSummary.addView(titleView)

    val xpGained = correctCountInSession * 10
    val scoreView = TextView(this).apply {
      text = "Đúng $correctCountInSession / $totalQuestionsInSession câu · +$xpGained XP"
      setTextColor(Color.WHITE)
      textSize = 13.5f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      setPadding(0, dpToPx(3), 0, 0)
    }
    rootSummary.addView(scoreView)

    val noteView = TextView(this).apply {
      text = "Đã lưu kết quả vào tiến trình ôn tập của bạn 🦉"
      setTextColor(Color.parseColor("#a1a1aa"))
      textSize = 11.5f
      gravity = Gravity.CENTER
      setPadding(0, dpToPx(4), 0, dpToPx(14))
    }
    rootSummary.addView(noteView)

    val doneBtn = TextView(this).apply {
      text = "Hoàn tất"
      setTextColor(Color.WHITE)
      textSize = 13f
      setTypeface(typeface, Typeface.BOLD)
      gravity = Gravity.CENTER
      layoutParams = LinearLayout.LayoutParams(dpToPx(140), dpToPx(40))
      background = GradientDrawable().apply {
        setColor(Color.parseColor("#0f766e"))
        cornerRadius = dpToPx(12).toFloat()
      }
      setOnClickListener { finish() }
    }
    rootSummary.addView(doneBtn)

    contentBox.addView(rootSummary)

    // Auto-close after 3s if learner does not tap
    contentBox.postDelayed({
      if (!isFinishing && !isDestroyed) {
        finish()
      }
    }, 3000L)
  }

  private fun vibrateFeedback(correct: Boolean) {
    try {
      val v = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator ?: return
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val effect = if (correct) {
          VibrationEffect.createOneShot(40, VibrationEffect.DEFAULT_AMPLITUDE)
        } else {
          VibrationEffect.createWaveform(longArrayOf(0, 50, 50, 50), -1)
        }
        v.vibrate(effect)
      } else {
        @Suppress("DEPRECATION")
        v.vibrate(if (correct) 40L else 100L)
      }
    } catch (_: Exception) {}
  }

  private fun openMainActivity(action: String, focusMinutes: Int = 10) {
    countdownAnimator?.cancel()
    ReminderScheduler.dismissAll(this)
    val intent = Intent(this, MainActivity::class.java).apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra("action", action)
      putExtra("openReview", action == "start_review")
      putExtra("focusMinutes", focusMinutes)
    }
    startActivity(intent)
    finish()
  }

  private fun startCountdown(fromMs: Long) {
    countdownAnimator?.cancel()
    val startFraction = (fromMs.toFloat() / totalMs.toFloat()).coerceIn(0f, 1f)

    countdownAnimator = ValueAnimator.ofFloat(startFraction, 0f).apply {
      duration = fromMs
      interpolator = LinearInterpolator()
      addUpdateListener { anim ->
        val fraction = anim.animatedValue as Float
        countdownIndicator.scaleX = fraction
        val currentMs = (fraction * totalMs).toLong()
        remainingMs = currentMs
        val secs = Math.ceil(currentMs / 1000.0).toInt().coerceAtLeast(0)
        if (::timerBadge.isInitialized) {
          timerBadge.text = "${secs}s"
        }
      }
      addListener(object : AnimatorListenerAdapter() {
        override fun onAnimationEnd(animation: Animator) {
          if (!isFinishing && !isDestroyed && remainingMs <= 150) {
            finish()
          }
        }
      })
      start()
    }
  }

  private fun pauseCountdown() {
    isPaused = true
    countdownAnimator?.pause()
    if (::timerBadge.isInitialized) {
      timerBadge.text = "Tạm dừng"
      timerBadge.setTextColor(Color.parseColor("#fbbf24"))
      (timerBadge.background as? GradientDrawable)?.setColor(Color.parseColor("#451a03"))
    }
  }

  private fun resumeCountdown() {
    if (isPaused && remainingMs > 0) {
      isPaused = false
      countdownAnimator?.resume()
      if (::timerBadge.isInitialized) {
        timerBadge.setTextColor(Color.parseColor("#5eead4"))
        (timerBadge.background as? GradientDrawable)?.setColor(Color.parseColor("#134e4a"))
      }
    }
  }

  private fun getFallbackQuizList(): List<JSONObject> {
    return listOf(
      JSONObject("""
        {
          "wordId": "fb_1",
          "word": "company",
          "phonetic": "/ˈkʌmpəni/",
          "targetMeaning": "công ty; sự bầu bạn",
          "promptTitle": "company",
          "example": "She stayed to keep me company.",
          "direction": "recognition",
          "options": [
            {"id": "o1", "text": "Công ty; sự bầu bạn", "isCorrect": true},
            {"id": "o2", "text": "Tháng Bảy", "isCorrect": false},
            {"id": "o3", "text": "Tuần lễ", "isCorrect": false},
            {"id": "o4", "text": "Phương tiện", "isCorrect": false}
          ]
        }
      """.trimIndent()),
      JSONObject("""
        {
          "wordId": "fb_2",
          "word": "persistent",
          "phonetic": "/pərˈsɪstənt/",
          "targetMeaning": "kiên trì, bền bỉ",
          "promptTitle": "persistent",
          "example": "Success takes persistent effort.",
          "direction": "recognition",
          "options": [
            {"id": "o1", "text": "Kiên trì, bền bỉ", "isCorrect": true},
            {"id": "o2", "text": "Do dự, ngập ngừng", "isCorrect": false},
            {"id": "o3", "text": "Thất vọng, chán nản", "isCorrect": false},
            {"id": "o4", "text": "Nhanh chóng", "isCorrect": false}
          ]
        }
      """.trimIndent()),
      JSONObject("""
        {
          "wordId": "fb_3",
          "word": "discourse",
          "phonetic": "/dɪsˈkɔːrs/",
          "targetMeaning": "cuộc đàm luận, diễn ngôn",
          "promptTitle": "discourse",
          "example": "He was engaged in political discourse.",
          "direction": "recognition",
          "options": [
            {"id": "o1", "text": "Cuộc đàm luận, diễn ngôn", "isCorrect": true},
            {"id": "o2", "text": "Sự phá hủy, tàn phá", "isCorrect": false},
            {"id": "o3", "text": "Lòng trung thành", "isCorrect": false},
            {"id": "o4", "text": "Tai nạn bất ngờ", "isCorrect": false}
          ]
        }
      """.trimIndent())
    )
  }

  override fun onDestroy() {
    countdownAnimator?.cancel()
    countdownAnimator = null
    try {
      tts?.stop()
      tts?.shutdown()
      tts = null
    } catch (_: Exception) {}
    super.onDestroy()
  }
}
