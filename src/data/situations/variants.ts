/**
 * Other ways the other person can say a turn of a built-in conversation, so it does not sound the same every time.
 * Keyed by "<situation id>.<node id>"; each variant means the same as the node's own sentence (the learner's answers
 * still fit), and one of them is picked at random whenever the turn comes.
 */
export interface Variant {
  en: string;
  vi: string;
}

export const NODE_VARIANTS: Record<string, Variant[]> = {
  "cafe-order.n1": [
    { en: "Hello! Ready to order?", vi: "Xin chào! Bạn sẵn sàng gọi món chưa?" },
    { en: "Hi there! What would you like?", vi: "Chào bạn! Bạn muốn dùng gì?" },
  ],
  "cafe-order.n2": [
    { en: "Okay. Which size?", vi: "Vâng. Bạn chọn cỡ nào?" },
    { en: "Sure thing. Small, medium or large?", vi: "Được ạ. Cỡ nhỏ, vừa hay lớn?" },
  ],
  "cafe-order.n3": [
    { en: "Would you like anything else?", vi: "Bạn muốn dùng thêm gì không?" },
    { en: "Is that everything?", vi: "Vậy là đủ rồi chứ?" },
  ],
  "cafe-order.n4": [{ en: "Five dollars, please. Is that for here or to go?", vi: "Năm đô nhé. Bạn dùng tại quán hay mang đi?" }],
  "cafe-order.n5": [
    { en: "Here's your order. Enjoy!", vi: "Đơn của bạn đây. Chúc ngon miệng!" },
    { en: "There you go. Have a nice day!", vi: "Của bạn đây. Chúc một ngày tốt lành!" },
  ],

  "introduce-yourself.n1": [
    { en: "Hello! My name is Anna. What's yours?", vi: "Xin chào! Mình tên Anna. Còn bạn?" },
    { en: "Hey! I'm Anna. What should I call you?", vi: "Này! Mình là Anna. Mình gọi bạn là gì nhỉ?" },
  ],
  "introduce-yourself.n2": [
    { en: "Good to meet you. Where are you from?", vi: "Rất vui được gặp bạn. Bạn đến từ đâu?" },
    { en: "Nice to meet you! Which country are you from?", vi: "Rất vui được gặp bạn! Bạn đến từ nước nào?" },
  ],
  "introduce-yourself.n3": [
    { en: "Interesting! What's your job?", vi: "Thú vị đấy! Bạn làm nghề gì?" },
    { en: "Nice! What do you do for work?", vi: "Hay đấy! Bạn làm công việc gì?" },
  ],
  "introduce-yourself.n4": [
    { en: "Sounds interesting. It was nice talking to you!", vi: "Nghe thú vị đấy. Rất vui được nói chuyện với bạn!" },
    { en: "Great. Nice to chat with you!", vi: "Tuyệt. Rất vui được trò chuyện với bạn!" },
  ],

  "ask-direction.n1": [
    { en: "Hello. Do you need some help?", vi: "Xin chào. Bạn cần giúp gì không?" },
    { en: "Hi there. Are you looking for something?", vi: "Chào bạn. Bạn đang tìm gì à?" },
  ],
  "ask-direction.n2": [
    { en: "Just go straight, then turn left.", vi: "Cứ đi thẳng, rồi rẽ trái." },
    { en: "Walk straight and then take a left.", vi: "Đi thẳng rồi rẽ trái nhé." },
  ],
  "ask-direction.n3": [
    { en: "Of course. Go straight, then turn left.", vi: "Tất nhiên rồi. Đi thẳng, rồi rẽ trái." },
    { en: "No problem. Walk straight, then turn left.", vi: "Không sao. Đi thẳng, rồi rẽ trái." },
  ],
  "ask-direction.n4": [
    { en: "No, it's close. About five minutes' walk.", vi: "Không, gần thôi. Đi bộ khoảng năm phút." },
    { en: "Not far. You can walk there in five minutes.", vi: "Không xa. Bạn đi bộ năm phút là tới." },
  ],

  "ask-for-help.n1": [
    { en: "Hello. Are you all right? You look lost.", vi: "Xin chào. Bạn ổn không? Trông bạn có vẻ lạc đường." },
    { en: "Excuse me, do you need help?", vi: "Xin lỗi, bạn có cần giúp đỡ không?" },
  ],
  "ask-for-help.n2": [
    { en: "Sure. What's wrong?", vi: "Được chứ. Có chuyện gì vậy?" },
    { en: "Of course. How can I help?", vi: "Tất nhiên rồi. Tôi giúp gì được?" },
  ],
  "ask-for-help.n4": [{ en: "That's terrible! Let's find it together.", vi: "Tệ quá! Mình cùng tìm nhé." }],

  "daily-standup.n1": [
    { en: "Morning! What did you do yesterday?", vi: "Chào buổi sáng! Hôm qua bạn làm gì?" },
    { en: "Good morning! What did you work on yesterday?", vi: "Chào buổi sáng! Hôm qua bạn làm việc gì?" },
  ],
  "daily-standup.n2": [
    { en: "Nice. And what's your plan for today?", vi: "Tốt. Còn kế hoạch hôm nay của bạn?" },
    { en: "Okay. What will you work on today?", vi: "Được rồi. Hôm nay bạn sẽ làm gì?" },
  ],
  "daily-standup.n3": [
    { en: "Is there anything stopping you?", vi: "Có gì đang cản trở bạn không?" },
    { en: "Any problems?", vi: "Có vấn đề gì không?" },
  ],
  "daily-standup.n4": [
    { en: "Alright. We can talk after the meeting.", vi: "Được rồi. Mình nói chuyện sau cuộc họp nhé." },
    { en: "No problem. Let's discuss it after the meeting.", vi: "Không sao. Mình bàn việc đó sau cuộc họp nhé." },
  ],
  "daily-standup.n5": [
    { en: "Good. Have a nice day!", vi: "Tốt. Chúc bạn một ngày tốt lành!" },
    { en: "Great. Have a good day at work!", vi: "Tuyệt. Chúc bạn làm việc tốt!" },
  ],

  "online-meeting.n1": [
    { en: "Hello everyone. Can everyone hear me?", vi: "Chào mọi người. Mọi người nghe mình rõ không?" },
    { en: "Hi all. Is my voice clear?", vi: "Chào cả nhà. Giọng mình có rõ không?" },
  ],
  "online-meeting.n2": [
    { en: "Oh, sorry about that. Is it better now?", vi: "Ôi, xin lỗi nhé. Giờ đỡ hơn chưa?" },
    { en: "Sorry! Can you hear me better now?", vi: "Xin lỗi! Giờ bạn nghe rõ hơn chưa?" },
  ],
  "online-meeting.n3": [
    { en: "Okay, let's get started. Do you have any questions first?", vi: "Được, mình bắt đầu nhé. Bạn có câu hỏi nào trước không?" },
    { en: "Great. Any questions before we start?", vi: "Tốt. Có câu hỏi nào trước khi bắt đầu không?" },
  ],
  "online-meeting.n4": [
    { en: "Of course. Can you see my screen now?", vi: "Tất nhiên rồi. Giờ bạn thấy màn hình của mình chưa?" },
    { en: "Sure. Is my screen visible?", vi: "Được thôi. Màn hình của mình có hiện lên không?" },
  ],
  "online-meeting.n5": [
    { en: "Great. Let's get started.", vi: "Tuyệt. Mình bắt đầu nhé." },
    { en: "Perfect. Let's start.", vi: "Hoàn hảo. Mình bắt đầu thôi." },
  ],

  "restaurant.n1": [
    { en: "Hi! How many people?", vi: "Chào bạn! Mấy người ạ?" },
    { en: "Welcome! A table for how many?", vi: "Chào mừng bạn! Bàn cho mấy người ạ?" },
  ],
  "restaurant.n2": [
    { en: "Here's the menu. What can I get you?", vi: "Thực đơn đây ạ. Bạn muốn dùng gì?" },
    { en: "Here you go. Are you ready to order?", vi: "Của bạn đây ạ. Bạn sẵn sàng gọi món chưa?" },
  ],
  "restaurant.n3": [
    { en: "I recommend the fish today. It's very good.", vi: "Hôm nay tôi gợi ý món cá. Rất ngon ạ." },
    { en: "Today's fish is really good.", vi: "Món cá hôm nay thật sự ngon." },
  ],
  "restaurant.n4": [
    { en: "Would you like something to drink?", vi: "Bạn có muốn uống gì không?" },
    { en: "What would you like to drink?", vi: "Bạn muốn uống gì ạ?" },
  ],
  "restaurant.n5": [
    { en: "Sure. Enjoy your meal!", vi: "Vâng ạ. Chúc bạn ngon miệng!" },
    { en: "Certainly. Enjoy!", vi: "Chắc chắn rồi ạ. Chúc ngon miệng!" },
  ],

  "shopping.n1": [
    { en: "Hello! Are you looking for something?", vi: "Xin chào! Bạn đang tìm gì à?" },
    { en: "Hi! How can I help you?", vi: "Chào bạn! Tôi giúp gì được cho bạn?" },
  ],
  "shopping.n2": [
    { en: "That one is twenty dollars.", vi: "Cái đó hai mươi đô ạ." },
    { en: "It costs twenty dollars.", vi: "Giá hai mươi đô ạ." },
  ],
  "shopping.n3": [
    { en: "Yes, we have it. It's twenty dollars.", vi: "Có ạ. Giá hai mươi đô." },
    { en: "Yes. It costs twenty dollars.", vi: "Có ạ. Nó giá hai mươi đô." },
  ],
  "shopping.n4": [
    { en: "Sorry about that. I can give you a small discount.", vi: "Xin lỗi bạn. Tôi giảm cho bạn một chút nhé." },
    { en: "I understand. Let me give you a little discount.", vi: "Tôi hiểu. Để tôi giảm cho bạn một chút." },
  ],
  "shopping.n5": [
    { en: "Great! Will you pay by cash or card?", vi: "Tuyệt! Bạn trả bằng tiền mặt hay thẻ?" },
    { en: "Perfect! Cash or credit card?", vi: "Hoàn hảo! Tiền mặt hay thẻ tín dụng?" },
  ],

  "weekend-chat.n1": [
    { en: "Hello! How are you doing today?", vi: "Xin chào! Hôm nay bạn thế nào?" },
    { en: "Hi! How's it going?", vi: "Chào bạn! Dạo này thế nào?" },
  ],

  "ask-colleague.n1": [
    { en: "Hi. You look busy. Is everything okay?", vi: "Chào. Trông bạn bận đấy. Mọi thứ ổn chứ?" },
    { en: "Hey, what's going on? You look busy.", vi: "Này, có chuyện gì thế? Trông bạn bận lắm." },
  ],
  "ask-colleague.n2": [
    { en: "Of course. What do you need?", vi: "Tất nhiên rồi. Bạn cần gì?" },
    { en: "Sure. How can I help?", vi: "Được chứ. Mình giúp gì được?" },
  ],
  "ask-colleague.n3": [
    { en: "Alright. Can I see the error?", vi: "Được rồi. Cho mình xem lỗi nhé?" },
    { en: "Okay. Can you show me what happens?", vi: "Được. Bạn cho mình xem chuyện gì xảy ra nhé?" },
  ],
  "ask-colleague.n4": [
    { en: "I see. Maybe try restarting the app.", vi: "Mình hiểu rồi. Có lẽ bạn thử khởi động lại ứng dụng." },
    { en: "Got it. Try restarting the application.", vi: "Hiểu rồi. Bạn thử khởi động lại ứng dụng đi." },
  ],
  "ask-colleague.n5": [
    { en: "Does it work now?", vi: "Giờ nó chạy chưa?" },
    { en: "Is it running now?", vi: "Giờ nó đang chạy chưa?" },
  ],
};

/** The ways to say a turn: its own sentence first (index 0 is "no change"), then the variants */
export function turnVariants(situationId: string, nodeId: string): Variant[] {
  return NODE_VARIANTS[`${situationId}.${nodeId}`] ?? [];
}
