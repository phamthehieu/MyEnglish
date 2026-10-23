/**
 * The 44 sounds of English (the usual chart: 12 single vowels, 8 diphthongs, 24 consonants), one practice lesson
 * each, built from the compact specs below into the same PronunciationLesson shape as src/data/pronunciation.ts,
 * so a sound opens the same three steps: listen, say aloud, listening quiz.
 *
 * Transcriptions follow the standard chart (British-style symbols, so /əʊ/ not /oʊ/, /ɒ/ for "hot"); the text-to-
 * speech reads American English, and the lessons' tips say where the two differ. Each pair is a word with the
 * sound first, then a look-alike without it: the pair drives the quiz and the microphone check.
 */
import type { PronunciationItem, PronunciationLesson, PronunciationQuizItem } from "@/types/pronunciation";

export type PhonemeKind = "vowel" | "diphthong" | "consonant";

interface PhonemeSpec {
  sym: string;
  kind: PhonemeKind;
  /** The word that names the sound on the chart */
  key: string;
  /** How Vietnamese speakers meet this sound */
  vn: string;
  /** How to make it */
  how: string;
  /** "word|ipa" examples */
  words: string[];
  /** "word|ipa" with the sound, then "word|ipa" without it */
  pairs?: Array<[string, string]>;
  /** Extra questions: [say, question, right answer, wrong answer, explanation] */
  extra?: Array<[string, string, string, string, string]>;
}

const SPECS: PhonemeSpec[] = [
  // ---- Single vowels (12) ----
  {
    sym: "iː", kind: "vowel", key: "sheep",
    vn: "Giống âm 'i' kéo dài trong tiếng Việt, nhưng phải kéo thật dài và căng môi; nếu đọc ngắn sẽ thành /ɪ/ và 'sheep' nghe như 'ship'.",
    how: "Môi căng sang hai bên như đang cười, lưỡi đưa cao và ra trước, giữ âm dài (khoảng gấp đôi /ɪ/).",
    words: ["see|/siː/", "tea|/tiː/", "key|/kiː/", "eat|/iːt/", "week|/wiːk/", "green|/ɡriːn/"],
    pairs: [["sheep|/ʃiːp/", "ship|/ʃɪp/"], ["seat|/siːt/", "sit|/sɪt/"], ["leave|/liːv/", "live|/lɪv/"], ["feet|/fiːt/", "fit|/fɪt/"]],
  },
  {
    sym: "ɪ", kind: "vowel", key: "ship",
    vn: "Gần với 'i' ngắn trong 'thịt', nhưng lỏng hơn và không căng môi; người Việt hay đọc thành /iː/ nên 'ship' nghe như 'sheep'.",
    how: "Môi thả lỏng, lưỡi hơi thấp và lùi hơn /iː/, đọc ngắn và nhẹ.",
    words: ["sit|/sɪt/", "big|/bɪɡ/", "fish|/fɪʃ/", "give|/ɡɪv/", "win|/wɪn/", "six|/sɪks/"],
    pairs: [["ship|/ʃɪp/", "sheep|/ʃiːp/"], ["bit|/bɪt/", "beat|/biːt/"], ["hill|/hɪl/", "heel|/hiːl/"], ["chip|/tʃɪp/", "cheap|/tʃiːp/"]],
  },
  {
    sym: "ʊ", kind: "vowel", key: "book",
    vn: "Gần 'u' ngắn của tiếng Việt, nhưng môi chỉ tròn nhẹ; hay bị kéo dài thành /uː/ nên 'full' nghe như 'fool'.",
    how: "Môi tròn nhẹ và thả lỏng, lưỡi lùi về sau, đọc ngắn dứt khoát.",
    words: ["book|/bʊk/", "good|/ɡʊd/", "put|/pʊt/", "look|/lʊk/", "foot|/fʊt/", "woman|/ˈwʊmən/"],
    pairs: [["pull|/pʊl/", "pool|/puːl/"], ["full|/fʊl/", "fool|/fuːl/"], ["look|/lʊk/", "Luke|/luːk/"]],
  },
  {
    sym: "uː", kind: "vowel", key: "food",
    vn: "Giống 'u' trong tiếng Việt nhưng phải kéo dài và tròn môi rõ; đọc ngắn sẽ thành /ʊ/.",
    how: "Môi tròn và chu ra trước, lưỡi lùi và đưa cao, giữ âm dài.",
    words: ["food|/fuːd/", "blue|/bluː/", "school|/skuːl/", "true|/truː/", "moon|/muːn/", "group|/ɡruːp/"],
    pairs: [["pool|/puːl/", "pull|/pʊl/"], ["fool|/fuːl/", "full|/fʊl/"], ["Luke|/luːk/", "look|/lʊk/"]],
  },
  {
    sym: "e", kind: "vowel", key: "bed",
    vn: "Gần 'e' trong 'xe' nhưng miệng mở vừa phải; người Việt hay đọc thành /æ/ (mở quá) hoặc /eɪ/ (kéo thành đôi).",
    how: "Miệng mở vừa, môi hơi căng sang hai bên, lưỡi ở giữa-trước, đọc ngắn.",
    words: ["bed|/bed/", "red|/red/", "head|/hed/", "many|/ˈmeni/", "friend|/frend/", "said|/sed/"],
    pairs: [["bed|/bed/", "bad|/bæd/"], ["men|/men/", "man|/mæn/"], ["pen|/pen/", "pan|/pæn/"], ["set|/set/", "sat|/sæt/"]],
  },
  {
    sym: "ə", kind: "vowel", key: "about",
    vn: "Âm 'ơ' rất ngắn, nhẹ và lướt nhanh, chỉ có ở vần không nhấn. Tiếng Việt không có âm yếu như vậy nên người học hay đọc rõ mọi vần, nghe cứng và khó hiểu.",
    how: "Miệng gần như thả lỏng hoàn toàn, lưỡi ở giữa, đọc cực ngắn và nhẹ. Đây là âm hay gặp nhất trong tiếng Anh.",
    words: ["about|/əˈbaʊt/", "teacher|/ˈtiːtʃə/", "banana|/bəˈnɑːnə/", "today|/təˈdeɪ/", "family|/ˈfæməli/", "problem|/ˈprɒbləm/"],
    extra: [
      ["about", "Âm đầu của từ này là?", "/ə/ (yếu, lướt nhanh)", "/æ/ (rõ, miệng mở)", "'about' /əˈbaʊt/ bắt đầu bằng /ə/ nhẹ, nhấn ở vần sau."],
      ["teacher", "Âm cuối của từ này là?", "/ə/ (yếu, lướt nhanh)", "/ɜː/ (dài, rõ)", "'teacher' /ˈtiːtʃə/ nhấn vần đầu, vần cuối chỉ là /ə/ ngắn."],
      ["today", "Âm đầu của từ này là?", "/ə/ (yếu, lướt nhanh)", "/uː/ (tròn môi, dài)", "'today' /təˈdeɪ/: vần 'to' không nhấn nên đọc /tə/."],
      ["banana", "Từ này nhấn vần nào?", "Vần giữa (ba-NA-na)", "Vần đầu (BA-na-na)", "'banana' /bəˈnɑːnə/ nhấn vần giữa; hai vần còn lại đọc /ə/ rất nhẹ."],
      ["family", "Vần thứ hai của từ này là?", "/ə/ (yếu, lướt nhanh)", "/æ/ (rõ, miệng mở)", "'family' /ˈfæməli/: chỉ vần đầu đọc rõ, vần 'mi' nuốt thành /mə/."],
      ["problem", "Vần cuối của từ này là?", "/ləm/ (yếu, lướt nhanh)", "/lem/ (rõ ràng)", "'problem' /ˈprɒbləm/: vần cuối không nhấn nên nguyên âm thành /ə/."],
    ],
  },
  {
    sym: "ɜː", kind: "vowel", key: "bird",
    vn: "Gần 'ơ' kéo dài của tiếng Việt; người học hay đọc thành 'ê-r' hoặc 'ơ' ngắn, hoặc nhầm sang /ɔː/.",
    how: "Môi thả lỏng không tròn, lưỡi ở giữa, kéo dài. Không chu môi (khác /ɔː/).",
    words: ["bird|/bɜːd/", "word|/wɜːd/", "learn|/lɜːn/", "turn|/tɜːn/", "work|/wɜːk/", "girl|/ɡɜːl/"],
    pairs: [["work|/wɜːk/", "walk|/wɔːk/"], ["bird|/bɜːd/", "board|/bɔːd/"], ["turn|/tɜːn/", "torn|/tɔːn/"], ["learn|/lɜːn/", "lawn|/lɔːn/"]],
  },
  {
    sym: "ɔː", kind: "vowel", key: "door",
    vn: "Giống 'o' mở và tròn của tiếng Việt nhưng kéo dài; hay bị đọc ngắn thành /ɒ/ hoặc lẫn với /ɜː/.",
    how: "Môi tròn và chu ra, miệng mở vừa, lưỡi thấp và lùi, giữ âm dài.",
    words: ["more|/mɔː/", "four|/fɔː/", "call|/kɔːl/", "small|/smɔːl/", "water|/ˈwɔːtə/", "thought|/θɔːt/"],
    pairs: [["walk|/wɔːk/", "work|/wɜːk/"], ["board|/bɔːd/", "bird|/bɜːd/"], ["torn|/tɔːn/", "turn|/tɜːn/"], ["lawn|/lɔːn/", "learn|/lɜːn/"]],
  },
  {
    sym: "æ", kind: "vowel", key: "cat",
    vn: "Tiếng Việt không có âm này: nằm giữa 'e' và 'a'. Người học hay đọc thành 'e' nên 'bad' nghe như 'bed'.",
    how: "Mở miệng khá rộng như khi ngáp nhẹ, kéo hai khóe miệng sang ngang, lưỡi thấp và ở phía trước.",
    words: ["cat|/kæt/", "hand|/hænd/", "bad|/bæd/", "apple|/ˈæpəl/", "black|/blæk/", "happy|/ˈhæpi/"],
    pairs: [["bad|/bæd/", "bed|/bed/"], ["man|/mæn/", "men|/men/"], ["pan|/pæn/", "pen|/pen/"], ["sat|/sæt/", "set|/set/"]],
  },
  {
    sym: "ʌ", kind: "vowel", key: "cup",
    vn: "Gần 'â' ngắn trong tiếng Việt ('cân'); hay bị đọc thành 'a' dài hoặc 'ơ'.",
    how: "Miệng mở nhẹ, lưỡi ở giữa và thả lỏng, môi không tròn, đọc ngắn và gọn.",
    words: ["cup|/kʌp/", "bus|/bʌs/", "love|/lʌv/", "come|/kʌm/", "sun|/sʌn/", "money|/ˈmʌni/"],
    pairs: [["cut|/kʌt/", "cat|/kæt/"], ["cup|/kʌp/", "cap|/kæp/"], ["luck|/lʌk/", "lack|/læk/"], ["hut|/hʌt/", "hat|/hæt/"]],
  },
  {
    sym: "ɑː", kind: "vowel", key: "car",
    vn: "Giống 'a' kéo dài của tiếng Việt; hay bị đọc ngắn thành 'a' hoặc /ʌ/.",
    how: "Miệng mở rộng, lưỡi thấp và lùi, môi không tròn, kéo dài như khi bác sĩ bảo 'há miệng nói a'.",
    words: ["car|/kɑː/", "father|/ˈfɑːðə/", "start|/stɑːt/", "park|/pɑːk/", "large|/lɑːdʒ/", "heart|/hɑːt/"],
    pairs: [["cart|/kɑːt/", "cut|/kʌt/"], ["lark|/lɑːk/", "luck|/lʌk/"], ["march|/mɑːtʃ/", "much|/mʌtʃ/"], ["park|/pɑːk/", "puck|/pʌk/"]],
  },
  {
    sym: "ɒ", kind: "vowel", key: "hot",
    vn: "Gần 'o' ngắn của tiếng Việt ('hót'); hay bị kéo dài thành /ɔː/. Người Mỹ đọc từ này gần /ɑː/ ('hot' như 'haht'), nên giọng đọc của app sẽ nghe hơi khác.",
    how: "Miệng mở tròn vừa, lưỡi thấp và lùi, môi hơi tròn, đọc ngắn.",
    words: ["hot|/hɒt/", "dog|/dɒɡ/", "stop|/stɒp/", "box|/bɒks/", "job|/dʒɒb/", "want|/wɒnt/"],
    pairs: [["cot|/kɒt/", "caught|/kɔːt/"], ["shot|/ʃɒt/", "short|/ʃɔːt/"], ["pot|/pɒt/", "port|/pɔːt/"], ["cod|/kɒd/", "cord|/kɔːd/"]],
  },

  // ---- Diphthongs (8) ----
  {
    sym: "ɪə", kind: "diphthong", key: "near",
    vn: "Lướt từ 'i' ngắn sang 'ơ' nhẹ. Hay bị đọc thành một âm 'i' dài, mất phần 'ơ' cuối.",
    how: "Bắt đầu ở /ɪ/ rồi trượt về /ə/ nhẹ ở cuối, hai âm liền nhau trong một nhịp. Người Mỹ thường đọc thành /ɪr/.",
    words: ["near|/nɪə/", "here|/hɪə/", "beer|/bɪə/", "idea|/aɪˈdɪə/", "clear|/klɪə/", "year|/jɪə/"],
    pairs: [["hear|/hɪə/", "hair|/heə/"], ["fear|/fɪə/", "fair|/feə/"], ["dear|/dɪə/", "dare|/deə/"], ["beer|/bɪə/", "bear|/beə/"]],
  },
  {
    sym: "eɪ", kind: "diphthong", key: "day",
    vn: "Lướt từ 'e' sang 'i' (như 'ê-i'). Người học hay đọc thành /e/ ngắn nên 'late' nghe như 'let'.",
    how: "Bắt đầu ở /e/ rồi đẩy lưỡi lên về phía /ɪ/, kéo dài rõ cả hai phần.",
    words: ["day|/deɪ/", "name|/neɪm/", "make|/meɪk/", "rain|/reɪn/", "say|/seɪ/", "great|/ɡreɪt/"],
    pairs: [["late|/leɪt/", "let|/let/"], ["pain|/peɪn/", "pen|/pen/"], ["wait|/weɪt/", "wet|/wet/"], ["tale|/teɪl/", "tell|/tel/"]],
  },
  {
    sym: "ʊə", kind: "diphthong", key: "tour",
    vn: "Lướt từ 'u' ngắn sang 'ơ' nhẹ. Âm này hiếm và nhiều người bản xứ đã đọc thành /ɔː/ ('poor' như 'pour').",
    how: "Bắt đầu ở /ʊ/ rồi trượt về /ə/. Nếu khó, đọc thành /ɔː/ vẫn được chấp nhận.",
    words: ["tour|/tʊə/", "pure|/pjʊə/", "sure|/ʃʊə/", "poor|/pʊə/", "cure|/kjʊə/", "jury|/ˈdʒʊəri/"],
    pairs: [["poor|/pʊə/", "paw|/pɔː/"], ["tour|/tʊə/", "tore|/tɔː/"], ["sure|/ʃʊə/", "shore|/ʃɔː/"], ["moor|/mʊə/", "more|/mɔː/"]],
  },
  {
    sym: "ɔɪ", kind: "diphthong", key: "boy",
    vn: "Lướt từ 'o' sang 'i' (như 'oi' trong 'đồi' nhưng 'o' mở hơn). Thường dễ với người Việt, chỉ cần giữ phần 'i' cuối rõ.",
    how: "Bắt đầu ở /ɔː/ tròn môi rồi trượt lên /ɪ/, môi từ tròn sang căng.",
    words: ["boy|/bɔɪ/", "toy|/tɔɪ/", "coin|/kɔɪn/", "voice|/vɔɪs/", "enjoy|/ɪnˈdʒɔɪ/", "oil|/ɔɪl/"],
    pairs: [["boy|/bɔɪ/", "buy|/baɪ/"], ["toy|/tɔɪ/", "tie|/taɪ/"], ["oil|/ɔɪl/", "isle|/aɪl/"], ["foil|/fɔɪl/", "file|/faɪl/"]],
  },
  {
    sym: "əʊ", kind: "diphthong", key: "go",
    vn: "Lướt từ 'ơ' sang 'u' (gần 'âu'). Người học hay đọc thành 'ô' thuần, thiếu phần trượt, nên 'coat' nghe như 'caught'. Người Mỹ ghi và đọc là /oʊ/.",
    how: "Bắt đầu ở /ə/ rồi tròn dần môi về /ʊ/, kéo dài cả hai phần.",
    words: ["go|/ɡəʊ/", "home|/həʊm/", "phone|/fəʊn/", "road|/rəʊd/", "know|/nəʊ/", "open|/ˈəʊpən/"],
    pairs: [["boat|/bəʊt/", "bought|/bɔːt/"], ["coat|/kəʊt/", "caught|/kɔːt/"], ["note|/nəʊt/", "not|/nɒt/"], ["low|/ləʊ/", "law|/lɔː/"]],
  },
  {
    sym: "eə", kind: "diphthong", key: "air",
    vn: "Lướt từ 'e' sang 'ơ' nhẹ. Hay bị đọc thành 'e' ngắn hoặc 'e-a' tách rời.",
    how: "Bắt đầu ở /e/ rồi trượt về /ə/ trong một nhịp. Người Mỹ thường đọc thành /er/.",
    words: ["air|/eə/", "hair|/heə/", "care|/keə/", "there|/ðeə/", "share|/ʃeə/", "chair|/tʃeə/"],
    pairs: [["hair|/heə/", "hear|/hɪə/"], ["fair|/feə/", "fear|/fɪə/"], ["dare|/deə/", "dear|/dɪə/"], ["bear|/beə/", "beer|/bɪə/"]],
  },
  {
    sym: "aɪ", kind: "diphthong", key: "my",
    vn: "Giống 'ai' trong tiếng Việt, rất quen thuộc. Chỉ cần kéo dài phần 'a' và nhớ trượt lên 'i' ở cuối, đừng cắt ngang.",
    how: "Bắt đầu ở /a/ miệng mở rộng rồi trượt lên /ɪ/, môi khép dần.",
    words: ["my|/maɪ/", "time|/taɪm/", "like|/laɪk/", "night|/naɪt/", "five|/faɪv/", "price|/praɪs/"],
    pairs: [["bite|/baɪt/", "bait|/beɪt/"], ["pie|/paɪ/", "pay|/peɪ/"], ["mine|/maɪn/", "main|/meɪn/"], ["time|/taɪm/", "tame|/teɪm/"]],
  },
  {
    sym: "aʊ", kind: "diphthong", key: "now",
    vn: "Giống 'ao' trong tiếng Việt ('cao'). Quen thuộc, chỉ cần tròn môi ở cuối thay vì dừng ở 'a'.",
    how: "Bắt đầu ở /a/ miệng mở rộng rồi trượt về /ʊ/, môi tròn dần.",
    words: ["now|/naʊ/", "house|/haʊs/", "out|/aʊt/", "down|/daʊn/", "brown|/braʊn/", "mouth|/maʊθ/"],
    pairs: [["now|/naʊ/", "no|/nəʊ/"], ["how|/haʊ/", "hoe|/həʊ/"], ["town|/taʊn/", "tone|/təʊn/"], ["loud|/laʊd/", "load|/ləʊd/"]],
  },

  // ---- Consonants (24) ----
  {
    sym: "p", kind: "consonant", key: "pen",
    vn: "Giống 'p' trong 'pin' nhưng đầu từ phải bật hơi mạnh; tiếng Việt chỉ có 'p' ở cuối chữ, không bật hơi, nên hay bị nghe thành /b/.",
    how: "Khép hai môi rồi bật ra một luồng hơi. Đặt tờ giấy trước miệng: đọc 'pen' đúng thì tờ giấy phải rung. Không rung dây thanh.",
    words: ["pen|/pen/", "paper|/ˈpeɪpə/", "stop|/stɒp/", "happy|/ˈhæpi/", "open|/ˈəʊpən/", "help|/help/"],
    pairs: [["pen|/pen/", "Ben|/ben/"], ["pie|/paɪ/", "buy|/baɪ/"], ["pack|/pæk/", "back|/bæk/"], ["pig|/pɪɡ/", "big|/bɪɡ/"]],
  },
  {
    sym: "b", kind: "consonant", key: "book",
    vn: "Giống 'b' trong tiếng Việt ('ba'), nhưng cần rung dây thanh rõ; nếu không rung sẽ nghe thành /p/.",
    how: "Khép hai môi rồi mở ra, đặt tay lên cổ họng phải thấy rung. Không bật hơi mạnh như /p/.",
    words: ["book|/bʊk/", "baby|/ˈbeɪbi/", "job|/dʒɒb/", "big|/bɪɡ/", "table|/ˈteɪbəl/", "number|/ˈnʌmbə/"],
    pairs: [["big|/bɪɡ/", "pig|/pɪɡ/"], ["buy|/baɪ/", "pie|/paɪ/"], ["back|/bæk/", "pack|/pæk/"], ["Ben|/ben/", "pen|/pen/"]],
  },
  {
    sym: "t", kind: "consonant", key: "time",
    vn: "Giống 'th' trong tiếng Việt ('thanh') ở chỗ bật hơi, nhưng đặt lưỡi ở lợi chứ không giữa răng. Ở đầu từ phải bật hơi, ở cuối từ không được nuốt mất.",
    how: "Đầu lưỡi chạm lợi sau răng cửa trên rồi bật ra luồng hơi. Không rung dây thanh.",
    words: ["time|/taɪm/", "ten|/ten/", "water|/ˈwɔːtə/", "eat|/iːt/", "city|/ˈsɪti/", "stop|/stɒp/"],
    pairs: [["tie|/taɪ/", "die|/daɪ/"], ["town|/taʊn/", "down|/daʊn/"], ["time|/taɪm/", "dime|/daɪm/"], ["ten|/ten/", "den|/den/"]],
  },
  {
    sym: "d", kind: "consonant", key: "day",
    vn: "Giống 'đ' trong tiếng Việt ('đi'), rung dây thanh. Ở cuối từ người Việt hay bỏ mất nên 'code' nghe như 'coe'.",
    how: "Đầu lưỡi chạm lợi sau răng cửa trên rồi bật xuống, rung cổ họng.",
    words: ["day|/deɪ/", "dog|/dɒɡ/", "red|/red/", "ready|/ˈredi/", "window|/ˈwɪndəʊ/", "good|/ɡʊd/"],
    pairs: [["die|/daɪ/", "tie|/taɪ/"], ["down|/daʊn/", "town|/taʊn/"], ["dime|/daɪm/", "time|/taɪm/"], ["den|/den/", "ten|/ten/"]],
  },
  {
    sym: "tʃ", kind: "consonant", key: "church",
    vn: "Gần 'ch' trong tiếng Việt ('cha') nhưng bật hơi mạnh hơn và môi hơi chu. Cuối từ ('match') người Việt hay bỏ.",
    how: "Đặt lưỡi như /t/ rồi nhả ra thành /ʃ/ trong một nhịp: t + sh. Không rung dây thanh.",
    words: ["church|/tʃɜːtʃ/", "chair|/tʃeə/", "check|/tʃek/", "match|/mætʃ/", "cheese|/tʃiːz/", "teacher|/ˈtiːtʃə/"],
    pairs: [["chip|/tʃɪp/", "ship|/ʃɪp/"], ["cheap|/tʃiːp/", "sheep|/ʃiːp/"], ["chair|/tʃeə/", "share|/ʃeə/"], ["watch|/wɒtʃ/", "wash|/wɒʃ/"]],
  },
  {
    sym: "dʒ", kind: "consonant", key: "job",
    vn: "Gần 'gi' hoặc 'ch' có rung ở một số giọng; phải rung dây thanh và bật như /d/ rồi lướt sang /ʒ/. Hay bị đọc thành /tʃ/ hoặc 'z'.",
    how: "Đặt lưỡi như /d/ rồi nhả ra thành /ʒ/: d + zh, rung cổ họng.",
    words: ["job|/dʒɒb/", "juice|/dʒuːs/", "page|/peɪdʒ/", "change|/tʃeɪndʒ/", "bridge|/brɪdʒ/", "giant|/ˈdʒaɪənt/"],
    pairs: [["jeep|/dʒiːp/", "cheap|/tʃiːp/"], ["jar|/dʒɑː/", "char|/tʃɑː/"], ["joke|/dʒəʊk/", "choke|/tʃəʊk/"], ["badge|/bædʒ/", "batch|/bætʃ/"]],
  },
  {
    sym: "k", kind: "consonant", key: "cat",
    vn: "Giống 'c/k' trong tiếng Việt nhưng đầu từ phải bật hơi mạnh; cuối từ ('back') người Việt hay nuốt mất.",
    how: "Cuống lưỡi chạm vòm miệng phía trong rồi bật hơi ra. Không rung dây thanh.",
    words: ["cat|/kæt/", "key|/kiː/", "black|/blæk/", "desk|/desk/", "school|/skuːl/", "like|/laɪk/"],
    pairs: [["back|/bæk/", "bag|/bæɡ/"], ["coat|/kəʊt/", "goat|/ɡəʊt/"], ["come|/kʌm/", "gum|/ɡʌm/"], ["class|/klɑːs/", "glass|/ɡlɑːs/"]],
  },
  {
    sym: "ɡ", kind: "consonant", key: "go",
    vn: "Giống 'g' trong 'ga' (gờ), nhưng rung dây thanh rõ; hay bị đọc thành /k/ ở cuối từ ('bag' nghe như 'back').",
    how: "Cuống lưỡi chạm vòm miệng, mở ra có rung cổ họng. Không bật hơi mạnh như /k/.",
    words: ["go|/ɡəʊ/", "good|/ɡʊd/", "big|/bɪɡ/", "bag|/bæɡ/", "green|/ɡriːn/", "again|/əˈɡen/"],
    pairs: [["goat|/ɡəʊt/", "coat|/kəʊt/"], ["gum|/ɡʌm/", "come|/kʌm/"], ["glass|/ɡlɑːs/", "class|/klɑːs/"], ["bag|/bæɡ/", "back|/bæk/"]],
  },
  {
    sym: "f", kind: "consonant", key: "fish",
    vn: "Giống 'ph' trong tiếng Việt ('phở'). Quen thuộc; chỉ cần nhớ giữ âm xì ở cuối từ ('leaf').",
    how: "Răng cửa trên chạm nhẹ môi dưới, thổi hơi ra. Không rung dây thanh.",
    words: ["fish|/fɪʃ/", "five|/faɪv/", "coffee|/ˈkɒfi/", "leaf|/liːf/", "phone|/fəʊn/", "enough|/ɪˈnʌf/"],
    pairs: [["fine|/faɪn/", "vine|/vaɪn/"], ["safe|/seɪf/", "save|/seɪv/"], ["leaf|/liːf/", "leave|/liːv/"], ["fan|/fæn/", "van|/væn/"]],
  },
  {
    sym: "v", kind: "consonant", key: "very",
    vn: "Giống 'v' trong tiếng Việt, nhưng răng trên chạm môi dưới (tiếng Việt thường chỉ hai môi gần nhau) và phải rung. Hay bị đọc thành 'd' hoặc /w/.",
    how: "Răng cửa trên chạm nhẹ môi dưới, thổi hơi ra có rung cổ họng (như /f/ nhưng rung).",
    words: ["very|/ˈveri/", "love|/lʌv/", "five|/faɪv/", "voice|/vɔɪs/", "move|/muːv/", "seven|/ˈsevən/"],
    pairs: [["vine|/vaɪn/", "fine|/faɪn/"], ["save|/seɪv/", "safe|/seɪf/"], ["leave|/liːv/", "leaf|/liːf/"], ["van|/væn/", "fan|/fæn/"]],
  },
  {
    sym: "θ", kind: "consonant", key: "think",
    vn: "Tiếng Việt không có. Người học hay đọc thành 's' hoặc 't' ('think' nghe như 'sink' / 'tink').",
    how: "Đặt đầu lưỡi giữa hai hàm răng (hoặc chạm nhẹ răng cửa trên) rồi thổi hơi ra. Không rung dây thanh.",
    words: ["think|/θɪŋk/", "three|/θriː/", "thank|/θæŋk/", "mouth|/maʊθ/", "bath|/bɑːθ/", "birthday|/ˈbɜːθdeɪ/"],
    pairs: [["think|/θɪŋk/", "sink|/sɪŋk/"], ["thank|/θæŋk/", "sank|/sæŋk/"], ["mouth|/maʊθ/", "mouse|/maʊs/"], ["three|/θriː/", "free|/friː/"]],
  },
  {
    sym: "ð", kind: "consonant", key: "this",
    vn: "Tiếng Việt không có. Người học hay đọc thành 'd' hoặc 'z' ('this' nghe như 'dis').",
    how: "Vị trí lưỡi như /θ/ (lưỡi giữa răng) nhưng rung dây thanh. Đặt tay lên cổ họng phải thấy rung.",
    words: ["this|/ðɪs/", "that|/ðæt/", "the|/ðə/", "mother|/ˈmʌðə/", "brother|/ˈbrʌðə/", "weather|/ˈweðə/"],
    pairs: [["they|/ðeɪ/", "day|/deɪ/"], ["then|/ðen/", "den|/den/"], ["breathe|/briːð/", "breeze|/briːz/"], ["clothe|/kləʊð/", "close|/kləʊz/"]],
  },
  {
    sym: "s", kind: "consonant", key: "see",
    vn: "Giống 'x' trong tiếng Việt ('xa'). Điểm khó: giữ âm xì ở cuối từ, nơi tiếng Việt không có ('house', 'class') và ở cụm 'sp-', 'st-'.",
    how: "Đầu lưỡi gần lợi trên, thổi luồng hơi xì như tiếng rắn. Không rung dây thanh.",
    words: ["see|/siː/", "sun|/sʌn/", "city|/ˈsɪti/", "class|/klɑːs/", "house|/haʊs/", "mouse|/maʊs/"],
    pairs: [["sip|/sɪp/", "zip|/zɪp/"], ["bus|/bʌs/", "buzz|/bʌz/"], ["rice|/raɪs/", "rise|/raɪz/"], ["price|/praɪs/", "prize|/praɪz/"]],
  },
  {
    sym: "z", kind: "consonant", key: "zoo",
    vn: "Gần 'd/gi' của một số giọng, nhưng ở đây là âm xì có rung. Hay bị đọc thành /s/ nên 'rise' nghe như 'rice'.",
    how: "Vị trí như /s/ nhưng rung cổ họng (như tiếng ong 'zzz'). Nguyên âm đứng trước /z/ được kéo dài hơn.",
    words: ["zoo|/zuː/", "zero|/ˈzɪərəʊ/", "easy|/ˈiːzi/", "rise|/raɪz/", "music|/ˈmjuːzɪk/", "size|/saɪz/"],
    pairs: [["zip|/zɪp/", "sip|/sɪp/"], ["buzz|/bʌz/", "bus|/bʌs/"], ["rise|/raɪz/", "rice|/raɪs/"], ["prize|/praɪz/", "price|/praɪs/"]],
  },
  {
    sym: "ʃ", kind: "consonant", key: "she",
    vn: "Gần 's' trong 'sáng' (giọng miền Bắc đọc 's' thành 'x', miền Nam đọc 'sh'). Phải chu môi ra trước và kéo dài.",
    how: "Môi hơi chu ra, lưỡi cong lên gần vòm miệng, thổi hơi như 'suỵt!'. Không rung dây thanh.",
    words: ["she|/ʃiː/", "ship|/ʃɪp/", "fish|/fɪʃ/", "shop|/ʃɒp/", "wash|/wɒʃ/", "nation|/ˈneɪʃən/"],
    pairs: [["she|/ʃiː/", "sea|/siː/"], ["ship|/ʃɪp/", "sip|/sɪp/"], ["sheet|/ʃiːt/", "seat|/siːt/"], ["show|/ʃəʊ/", "so|/səʊ/"]],
  },
  {
    sym: "ʒ", kind: "consonant", key: "vision",
    vn: "Tiếng Việt không có. Gần như 'gi' trong giọng miền Nam hoặc 'r' trong giọng miền Bắc, nhưng chu môi và kéo dài. Chỉ có ở giữa hoặc cuối từ, không bao giờ đứng đầu.",
    how: "Vị trí như /ʃ/ nhưng rung dây thanh, môi chu nhẹ.",
    words: ["vision|/ˈvɪʒən/", "television|/ˈtelɪvɪʒən/", "measure|/ˈmeʒə/", "usually|/ˈjuːʒuəli/", "pleasure|/ˈpleʒə/", "garage|/ˈɡærɑːʒ/"],
    extra: [
      ["vision", "Âm giữa của từ này là?", "/ʒ/ (rung, như 'gi' kéo dài)", "/ʃ/ (không rung, như 'sh')", "'vision' /ˈvɪʒən/ có /ʒ/ rung; nếu đọc /ʃ/ sẽ thành 'vishion'."],
      ["measure", "Âm giữa của từ này là?", "/ʒ/ (rung, như 'gi' kéo dài)", "/s/ (xì, không rung)", "'measure' /ˈmeʒə/: chữ 's' ở đây đọc /ʒ/, không phải /s/."],
      ["pleasure", "Âm giữa của từ này là?", "/ʒ/ (rung, như 'gi' kéo dài)", "/z/ (rung, không chu môi)", "'pleasure' /ˈpleʒə/: /ʒ/ cần chu môi và lưỡi cong, khác /z/."],
      ["television", "Âm giữa của từ này là?", "/ʒ/ (rung, như 'gi' kéo dài)", "/ʃ/ (không rung, như 'sh')", "'television' /ˈtelɪvɪʒən/ có /ʒ/ rung ở vần 'vi-sion'."],
      ["usually", "Âm sau vần đầu của từ này là?", "/ʒ/ (rung, như 'gi' kéo dài)", "/dʒ/ (bật như 'j')", "'usually' /ˈjuːʒuəli/ có /ʒ/ lướt, không bật như /dʒ/."],
      ["garage", "Âm cuối của từ này (giọng Anh) là?", "/ʒ/ (rung, như 'gi' kéo dài)", "/dʒ/ (bật như 'j')", "'garage' /ˈɡærɑːʒ/ kết thúc bằng /ʒ/; người Mỹ đọc /ɡəˈrɑːʒ/, cũng là /ʒ/."],
    ],
  },
  {
    sym: "h", kind: "consonant", key: "hat",
    vn: "Giống 'h' trong tiếng Việt ('hoa'). Chỉ cần thở hơi nhẹ từ cổ họng, không cọ xát mạnh như 'kh'.",
    how: "Thở ra nhẹ, miệng đã sẵn sàng cho nguyên âm đi sau. Không rung dây thanh. Có từ viết 'h' nhưng câm: 'hour', 'honest'.",
    words: ["hat|/hæt/", "home|/həʊm/", "who|/huː/", "behind|/bɪˈhaɪnd/", "hello|/həˈləʊ/", "help|/help/"],
    pairs: [["hat|/hæt/", "at|/æt/"], ["hear|/hɪə/", "ear|/ɪə/"], ["heat|/hiːt/", "eat|/iːt/"], ["hold|/həʊld/", "old|/əʊld/"]],
  },
  {
    sym: "m", kind: "consonant", key: "man",
    vn: "Giống 'm' trong tiếng Việt. Quen thuộc ở đầu từ; cuối từ ('time') phải khép môi hẳn rồi mới dừng, đừng thả ra thành 'mơ'.",
    how: "Khép hai môi, hơi đi qua mũi, rung dây thanh.",
    words: ["man|/mæn/", "mother|/ˈmʌðə/", "time|/taɪm/", "summer|/ˈsʌmə/", "home|/həʊm/", "name|/neɪm/"],
    pairs: [["map|/mæp/", "nap|/næp/"], ["mice|/maɪs/", "nice|/naɪs/"], ["same|/seɪm/", "sane|/seɪn/"], ["Tim|/tɪm/", "tin|/tɪn/"]],
  },
  {
    sym: "n", kind: "consonant", key: "no",
    vn: "Giống 'n' trong tiếng Việt. Ở cuối từ ('sun') phải chạm lưỡi vào lợi; nếu để lưỡi lơ lửng sẽ nghe như /ŋ/.",
    how: "Đầu lưỡi chạm lợi trên, hơi đi qua mũi, rung dây thanh.",
    words: ["no|/nəʊ/", "night|/naɪt/", "sun|/sʌn/", "many|/ˈmeni/", "funny|/ˈfʌni/", "nine|/naɪn/"],
    pairs: [["nap|/næp/", "map|/mæp/"], ["nice|/naɪs/", "mice|/maɪs/"], ["sane|/seɪn/", "same|/seɪm/"], ["tin|/tɪn/", "Tim|/tɪm/"]],
  },
  {
    sym: "ŋ", kind: "consonant", key: "sing",
    vn: "Giống 'ng' trong tiếng Việt ('ngang'), nhưng ở tiếng Anh nó thường ở cuối từ và không có /ɡ/ theo sau ('sing' không đọc 'sing-g'). Hay bị bỏ thành /n/.",
    how: "Cuống lưỡi chạm vòm miệng phía trong, hơi đi qua mũi, rung dây thanh. Không bật thêm /ɡ/ ở cuối.",
    words: ["sing|/sɪŋ/", "long|/lɒŋ/", "morning|/ˈmɔːnɪŋ/", "thing|/θɪŋ/", "finger|/ˈfɪŋɡə/", "king|/kɪŋ/"],
    pairs: [["sing|/sɪŋ/", "sin|/sɪn/"], ["bang|/bæŋ/", "ban|/bæn/"], ["thing|/θɪŋ/", "thin|/θɪn/"], ["wing|/wɪŋ/", "win|/wɪn/"]],
  },
  {
    sym: "l", kind: "consonant", key: "look",
    vn: "Giống 'l' trong tiếng Việt ở đầu từ. Cuối từ ('girl', 'small') phải giữ lưỡi chạm lợi một chút; hay bị đọc thành 'u' hoặc bỏ mất. Người Việt cũng hay nhầm /l/ với /r/.",
    how: "Đầu lưỡi chạm lợi sau răng cửa trên, hơi thoát ra hai bên lưỡi, rung dây thanh.",
    words: ["look|/lʊk/", "love|/lʌv/", "hello|/həˈləʊ/", "yellow|/ˈjeləʊ/", "small|/smɔːl/", "girl|/ɡɜːl/"],
    pairs: [["light|/laɪt/", "right|/raɪt/"], ["long|/lɒŋ/", "wrong|/rɒŋ/"], ["lice|/laɪs/", "rice|/raɪs/"], ["glass|/ɡlɑːs/", "grass|/ɡrɑːs/"]],
  },
  {
    sym: "r", kind: "consonant", key: "red",
    vn: "Khác hẳn 'r' của tiếng Việt (rung lưỡi hoặc 'z'). Tiếng Anh cuốn lưỡi lên mà không chạm vòm miệng, môi hơi chu. Người Việt hay đọc thành 'l' hoặc 'z'.",
    how: "Cuốn đầu lưỡi lên và ra sau, không chạm vào đâu, môi chu nhẹ, rung dây thanh. Đừng rung lưỡi.",
    words: ["red|/red/", "right|/raɪt/", "run|/rʌn/", "orange|/ˈɒrɪndʒ/", "very|/ˈveri/", "library|/ˈlaɪbrəri/"],
    pairs: [["right|/raɪt/", "light|/laɪt/"], ["wrong|/rɒŋ/", "long|/lɒŋ/"], ["rice|/raɪs/", "lice|/laɪs/"], ["grass|/ɡrɑːs/", "glass|/ɡlɑːs/"]],
  },
  {
    sym: "w", kind: "consonant", key: "we",
    vn: "Giống 'u/o' đọc lướt trong tiếng Việt ('qua', 'hoa'). Hay bị đọc thành /v/ nên 'west' nghe như 'vest'.",
    how: "Chu tròn môi như sắp thổi nến rồi mở ra nhanh sang nguyên âm sau. Răng không chạm môi (khác /v/).",
    words: ["we|/wiː/", "water|/ˈwɔːtə/", "window|/ˈwɪndəʊ/", "week|/wiːk/", "one|/wʌn/", "question|/ˈkwestʃən/"],
    pairs: [["west|/west/", "vest|/vest/"], ["wine|/waɪn/", "vine|/vaɪn/"], ["worse|/wɜːs/", "verse|/vɜːs/"], ["wet|/wet/", "vet|/vet/"]],
  },
  {
    sym: "j", kind: "consonant", key: "yes",
    vn: "Giống 'i' đọc lướt đầu từ trong tiếng Việt ('yên', 'iu'). Hay bị đọc thành /dʒ/ nên 'yes' nghe như 'Jess'.",
    how: "Lưỡi đưa lên cao gần vòm miệng như bắt đầu đọc /iː/, rồi trượt nhanh sang nguyên âm sau. Không bật như /dʒ/.",
    words: ["yes|/jes/", "you|/juː/", "year|/jɪə/", "young|/jʌŋ/", "use|/juːz/", "yellow|/ˈjeləʊ/"],
    pairs: [["yes|/jes/", "Jess|/dʒes/"], ["year|/jɪə/", "gear|/dʒɪə/"], ["yet|/jet/", "jet|/dʒet/"], ["you|/juː/", "Jew|/dʒuː/"]],
  },
];

const KIND_LABEL: Record<PhonemeKind, string> = {
  vowel: "nguyên âm đơn",
  diphthong: "nguyên âm đôi",
  consonant: "phụ âm",
};

function item(spec: string): PronunciationItem {
  const [text, ipa] = spec.split("|");
  return { text, ipa };
}

function buildLesson(spec: PhonemeSpec, index: number): PronunciationLesson {
  const sym = `/${spec.sym}/`;
  const quiz: PronunciationQuizItem[] = [];
  const add = (say: string, question: string, right: string, wrong: string, explanation: string) => {
    // Alternate the order so the right answer is not always the first
    const options = quiz.length % 2 === 0 ? [right, wrong] : [wrong, right];
    quiz.push({ say, question, options, answer: right, explanation });
  };
  const pairs = (spec.pairs ?? []).map(([a, b]) => ({ a: item(a), b: item(b) }));
  for (const { a, b } of pairs) {
    add(a.text, "Bạn nghe thấy từ nào?", a.text, b.text, `'${a.text}' ${a.ipa} có âm ${sym}; '${b.text}' ${b.ipa} là từ khác, không có âm này.`);
    add(b.text, "Bạn nghe thấy từ nào?", b.text, a.text, `'${b.text}' ${b.ipa} không có âm ${sym}; '${a.text}' ${a.ipa} mới có.`);
  }
  for (const [say, question, right, wrong, explanation] of spec.extra ?? []) add(say, question, right, wrong, explanation);

  return {
    id: `pron-ph-${index + 1}`,
    order: 100 + index,
    title: `Âm ${sym} như trong "${spec.key}"`,
    tagline: `Nghe, đọc và phân biệt âm ${sym} trong "${spec.key}".`,
    intro: [`Âm ${sym} là một ${KIND_LABEL[spec.kind]} của tiếng Anh, nghe rõ nhất trong từ "${spec.key}".`, spec.vn],
    tips: [
      spec.how,
      "Luyện tập: nghe mẫu vài lần, đọc to theo từng từ, rồi thử đọc cho máy nghe ở bước Đọc to. Sau đó làm bài nghe để kiểm tra tai.",
    ],
    examples: spec.words.map(item),
    pairs: pairs.length > 0 ? pairs : undefined,
    quiz,
  };
}

export const PHONEME_LESSONS: PronunciationLesson[] = SPECS.map(buildLesson);

export interface PhonemeChartEntry {
  sym: string;
  key: string;
  lessonId: string;
}

export interface PhonemeChartGroup {
  kind: PhonemeKind;
  label: string;
  entries: PhonemeChartEntry[];
}

/** The chart on screen: the 44 sounds in three groups, each pointing at its lesson */
export const PHONEME_CHART: PhonemeChartGroup[] = (["vowel", "diphthong", "consonant"] as PhonemeKind[]).map((kind) => ({
  kind,
  label: { vowel: "Nguyên âm đơn", diphthong: "Nguyên âm đôi", consonant: "Phụ âm" }[kind],
  entries: SPECS.flatMap((s, i) => (s.kind === kind ? [{ sym: s.sym, key: s.key, lessonId: `pron-ph-${i + 1}` }] : [])),
}));
