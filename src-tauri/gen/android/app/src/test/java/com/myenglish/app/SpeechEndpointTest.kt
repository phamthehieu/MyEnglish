package com.myenglish.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SpeechEndpointTest {
  /** 20 ms of 16 kHz mono 16-bit PCM whose level (rms) is `level` (0 to 1): a square wave of that height */
  private fun chunk(level: Double): ByteArray {
    val samples = 320
    val out = ByteArray(samples * 2)
    val amp = (level * 32767).toInt()
    for (i in 0 until samples) {
      val v = if (i % 2 == 0) amp else -amp
      out[i * 2] = (v and 0xff).toByte()
      out[i * 2 + 1] = ((v shr 8) and 0xff).toByte()
    }
    return out
  }

  /** Feed `ms` of audio at `level`; the number of times the endpoint fired */
  private fun SpeechEndpoint.play(level: Double, ms: Int): Int {
    var fired = 0
    repeat(ms / 20) { if (feed(chunk(level), 640)) fired++ }
    return fired
  }

  @Test
  fun silenceAloneNeverEnds() {
    val e = SpeechEndpoint()
    assertEquals(0, e.play(0.002, 5000))
  }

  @Test
  fun endsAfterSpeechThenQuiet() {
    val e = SpeechEndpoint()
    assertEquals(0, e.play(0.002, 400)) // the room
    assertEquals(0, e.play(0.3, 600)) // speaking
    assertEquals(0, e.play(0.002, 700)) // not quiet for long enough yet
    assertEquals(1, e.play(0.002, 300)) // 800 ms of quiet reached
  }

  @Test
  fun aShortPauseBetweenWordsDoesNotEnd() {
    val e = SpeechEndpoint()
    e.play(0.002, 400)
    assertEquals(0, e.play(0.3, 500))
    assertEquals(0, e.play(0.002, 500)) // a breath
    assertEquals(0, e.play(0.3, 500)) // keeps talking: the quiet count starts over
    assertEquals(0, e.play(0.002, 700))
    assertEquals(1, e.play(0.002, 200))
  }

  @Test
  fun aBlipTooShortToBeSpeechDoesNotStartIt() {
    val e = SpeechEndpoint()
    e.play(0.002, 400)
    assertEquals(0, e.play(0.3, 100)) // a click, not a word
    assertEquals(0, e.play(0.002, 3000))
  }

  @Test
  fun aNoisyRoomIsNotSpeech() {
    val e = SpeechEndpoint()
    assertEquals(0, e.play(0.03, 400)) // the room is already at 0.03
    assertEquals(0, e.play(0.03, 4000)) // and stays there: nobody spoke
  }

  @Test
  fun speechOverANoisyRoomIsHeardAndEnds() {
    val e = SpeechEndpoint()
    e.play(0.03, 400)
    assertEquals(0, e.play(0.4, 600))
    assertEquals(1, e.play(0.03, 1000))
  }

  @Test
  fun anEmptyChunkChangesNothing() {
    val e = SpeechEndpoint()
    assertFalse(e.feed(ByteArray(0), 0))
    assertTrue(e.play(0.002, 400) == 0)
  }
}
