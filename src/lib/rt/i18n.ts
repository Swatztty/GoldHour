"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Screen text in the main languages of Asia-Pacific. The voice assistant already speaks the person's
 * language; this translates the buttons, headings and labels around it.
 * Translations were written for this prototype and should be reviewed by native speakers before launch.
 */
export const UI_LANGS = [
  { code: "en", name: "English" },
  { code: "hi", name: "हिन्दी" },
  { code: "ta", name: "தமிழ்" },
  { code: "ms", name: "Bahasa Melayu" },
  { code: "id", name: "Bahasa Indonesia" },
  { code: "th", name: "ไทย" },
  { code: "ja", name: "日本語" },
  { code: "zh", name: "中文（简体）" },
  { code: "fil", name: "Filipino" },
] as const;

export type UiLang = (typeof UI_LANGS)[number]["code"];
type Entry = Record<UiLang, string>;

const D = {
  // ---- navigation ----
  navReport: { en: "Report a scam", hi: "ठगी की रिपोर्ट", ta: "மோசடியைப் புகாரளி", ms: "Lapor penipuan", id: "Laporkan penipuan", th: "แจ้งมิจฉาชีพ", ja: "詐欺を報告", zh: "举报诈骗", fil: "Mag-ulat ng scam" },
  navCheck: { en: "Check a message", hi: "संदेश जाँचें", ta: "செய்தியைச் சரிபார்", ms: "Semak mesej", id: "Cek pesan", th: "ตรวจข้อความ", ja: "メッセージを確認", zh: "检查信息", fil: "Suriin ang mensahe" },
  navSafety: { en: "Stay safe", hi: "सुरक्षित रहें", ta: "பாதுகாப்பாக இரு", ms: "Kekal selamat", id: "Tetap aman", th: "อยู่อย่างปลอดภัย", ja: "身を守る", zh: "安全防护", fil: "Manatiling ligtas" },
  navNetwork: { en: "Scam network", hi: "ठगी नेटवर्क", ta: "மோசடி வலையமைப்பு", ms: "Rangkaian penipuan", id: "Jaringan penipuan", th: "เครือข่ายมิจฉาชีพ", ja: "詐欺ネットワーク", zh: "诈骗网络", fil: "Network ng scam" },
  tabReport: { en: "Report", hi: "रिपोर्ट", ta: "புகார்", ms: "Lapor", id: "Lapor", th: "แจ้ง", ja: "報告", zh: "举报", fil: "Ulat" },
  tabCheck: { en: "Check", hi: "जाँचें", ta: "சரிபார்", ms: "Semak", id: "Cek", th: "ตรวจ", ja: "確認", zh: "检查", fil: "Suriin" },
  tabSafety: { en: "Safety", hi: "सुरक्षा", ta: "பாதுகாப்பு", ms: "Selamat", id: "Aman", th: "ปลอดภัย", ja: "安全", zh: "安全", fil: "Ligtas" },
  tabNetwork: { en: "Network", hi: "नेटवर्क", ta: "வலையமைப்பு", ms: "Rangkaian", id: "Jaringan", th: "เครือข่าย", ja: "ネットワーク", zh: "网络", fil: "Network" },
  tabCall: { en: "Call", hi: "कॉल", ta: "அழை", ms: "Hubungi", id: "Telepon", th: "โทร", ja: "電話", zh: "致电", fil: "Tumawag" },
  settings: { en: "Settings", hi: "सेटिंग्स", ta: "அமைப்புகள்", ms: "Tetapan", id: "Pengaturan", th: "ตั้งค่า", ja: "設定", zh: "设置", fil: "Settings" },
  accessibility: { en: "Accessibility", hi: "सुलभता", ta: "அணுகல்தன்மை", ms: "Kebolehcapaian", id: "Aksesibilitas", th: "การเข้าถึง", ja: "アクセシビリティ", zh: "无障碍", fil: "Accessibility" },
  language: { en: "Language", hi: "भाषा", ta: "மொழி", ms: "Bahasa", id: "Bahasa", th: "ภาษา", ja: "言語", zh: "语言", fil: "Wika" },
  country: { en: "Your country", hi: "आपका देश", ta: "உங்கள் நாடு", ms: "Negara anda", id: "Negara Anda", th: "ประเทศของคุณ", ja: "あなたの国", zh: "您所在的国家", fil: "Iyong bansa" },
  tagline: { en: "Scam help in the first hour", hi: "पहले घंटे में ठगी से मदद", ta: "முதல் மணி நேரத்தில் மோசடி உதவி", ms: "Bantuan penipuan dalam jam pertama", id: "Bantuan penipuan di jam pertama", th: "ช่วยเหลือภายในชั่วโมงแรก", ja: "最初の1時間の詐欺サポート", zh: "诈骗发生后第一小时的帮助", fil: "Tulong sa scam sa unang oras" },
  call: { en: "Call", hi: "कॉल करें", ta: "அழைக்கவும்", ms: "Hubungi", id: "Telepon", th: "โทร", ja: "電話", zh: "致电", fil: "Tumawag sa" },
  demoStrip: {
    en: "Demo version. Calls and emails are switched off, and the network uses sample data.",
    hi: "डेमो संस्करण। कॉल और ईमेल बंद हैं, और नेटवर्क नमूना डेटा का उपयोग करता है।",
    ta: "டெமோ பதிப்பு. அழைப்புகளும் மின்னஞ்சல்களும் முடக்கப்பட்டுள்ளன; வலையமைப்பு மாதிரித் தரவைப் பயன்படுத்துகிறது.",
    ms: "Versi demo. Panggilan dan e-mel dimatikan, dan rangkaian menggunakan data contoh.",
    id: "Versi demo. Panggilan dan email dimatikan, dan jaringan memakai data contoh.",
    th: "เวอร์ชันสาธิต ปิดการโทรและอีเมลไว้ และเครือข่ายใช้ข้อมูลตัวอย่าง",
    ja: "デモ版です。電話とメールは無効で、ネットワークはサンプルデータです。",
    zh: "演示版本。电话和邮件已关闭，网络使用示例数据。",
    fil: "Demo na bersyon. Naka-off ang tawag at email, at sample data ang gamit ng network.",
  },
  howItWorks: { en: "How it works", hi: "यह कैसे काम करता है", ta: "இது எப்படி வேலை செய்கிறது", ms: "Cara ia berfungsi", id: "Cara kerjanya", th: "วิธีการทำงาน", ja: "使い方", zh: "使用方法", fil: "Paano ito gumagana" },
  playDemo: { en: "Play the demo", hi: "डेमो चलाएँ", ta: "டெமோவை இயக்கு", ms: "Main demo", id: "Putar demo", th: "เล่นการสาธิต", ja: "デモを再生", zh: "播放演示", fil: "I-play ang demo" },

  // ---- home ----
  heroPill: { en: "Lost money in the last few hours?", hi: "पिछले कुछ घंटों में पैसे गए?", ta: "கடந்த சில மணி நேரத்தில் பணம் இழந்தீர்களா?", ms: "Hilang wang dalam beberapa jam lepas?", id: "Kehilangan uang dalam beberapa jam terakhir?", th: "เสียเงินไปในไม่กี่ชั่วโมงที่ผ่านมา?", ja: "この数時間でお金を失いましたか？", zh: "过去几小时内被骗了钱？", fil: "Nawalan ng pera nitong nakaraang ilang oras?" },
  heroA: { en: "Call first.", hi: "पहले कॉल करें।", ta: "முதலில் அழையுங்கள்.", ms: "Telefon dahulu.", id: "Telepon dulu.", th: "โทรก่อน", ja: "まず電話を。", zh: "先打电话。", fil: "Tumawag muna." },
  heroB: { en: "We’ll make it count.", hi: "हम उस कॉल को असरदार बनाएँगे।", ta: "அந்த அழைப்பைப் பயனுள்ளதாக்குவோம்.", ms: "Kami bantu panggilan itu berhasil.", id: "Kami bantu panggilan itu berhasil.", th: "เราช่วยให้การโทรนั้นได้ผล", ja: "その電話を確実に役立てます。", zh: "我们让这通电话更有用。", fil: "Gagawin naming sulit ang tawag na iyon." },
  heroLead: {
    en: "Golden Hour never puts questions between you and the call that can stop the money. Call now. While you’re on hold, tell us what happened: the details the bank will ask for appear on screen, ready to read out. Then we file the reports and warn other victims.",
    hi: "Golden Hour आपके और उस कॉल के बीच कोई सवाल नहीं रखता जो पैसा रोक सकती है। अभी कॉल करें। होल्ड पर रहते हुए हमें बताइए क्या हुआ: बैंक जो पूछेगा वह स्क्रीन पर पढ़ने के लिए तैयार मिलेगा। फिर हम रिपोर्ट दर्ज करते हैं और दूसरे पीड़ितों को सचेत करते हैं।",
    ta: "பணத்தை நிறுத்தக்கூடிய அழைப்புக்கு முன் Golden Hour எந்தக் கேள்வியும் கேட்காது. இப்போதே அழையுங்கள். காத்திருக்கும்போது என்ன நடந்தது என்று சொல்லுங்கள்: வங்கி கேட்கும் விவரங்கள் திரையில் வாசிக்கத் தயாராக இருக்கும். பிறகு புகார்களைப் பதிவு செய்து மற்றவர்களை எச்சரிப்போம்.",
    ms: "Golden Hour tidak akan bertanya apa-apa sebelum anda membuat panggilan yang boleh menghentikan wang itu. Telefon sekarang. Sambil menunggu, ceritakan apa berlaku: butiran yang bank akan tanya muncul di skrin, sedia untuk dibaca. Kemudian kami failkan laporan dan beri amaran kepada mangsa lain.",
    id: "Golden Hour tidak pernah menaruh pertanyaan sebelum panggilan yang bisa menghentikan uang Anda. Telepon sekarang. Sambil menunggu, ceritakan yang terjadi: rincian yang akan ditanyakan bank muncul di layar, siap dibacakan. Lalu kami ajukan laporan dan peringatkan korban lain.",
    th: "Golden Hour จะไม่ถามอะไรก่อนที่คุณจะโทรเพื่อหยุดเงิน โทรเลยตอนนี้ ระหว่างรอสาย เล่าให้เราฟังว่าเกิดอะไรขึ้น ข้อมูลที่ธนาคารจะถามจะขึ้นบนหน้าจอ พร้อมอ่าน จากนั้นเราจะแจ้งความและเตือนผู้เสียหายคนอื่น",
    ja: "お金を止められる電話の前に、Golden Hour が質問することはありません。今すぐ電話してください。保留中に何があったか話せば、銀行に聞かれる内容が読み上げられる形で画面に出ます。その後の届け出や、他の被害者への警告も行います。",
    zh: "在可能止住资金的那通电话之前，Golden Hour 不会问您任何问题。现在就打。等待接通时告诉我们发生了什么：银行会问的信息会显示在屏幕上，可直接念出。之后我们帮您报案并提醒其他受害者。",
    fil: "Hindi ka tatanungin ng Golden Hour bago ka tumawag para pigilan ang pera. Tumawag ngayon. Habang naka-hold, sabihin ang nangyari: lalabas sa screen ang mga detalyeng itatanong ng bangko, handang basahin. Saka namin isusumite ang mga ulat at bibigyan ng babala ang ibang biktima.",
  },
  tapToTalk: { en: "Tap to start talking", hi: "बोलना शुरू करने के लिए टैप करें", ta: "பேசத் தொடங்க தட்டவும்", ms: "Ketik untuk mula bercakap", id: "Ketuk untuk mulai bicara", th: "แตะเพื่อเริ่มพูด", ja: "タップして話す", zh: "点按开始说话", fil: "I-tap para magsimulang magsalita" },
  anyLanguage: { en: "Any language. Nothing to fill in.", hi: "कोई भी भाषा। कुछ भरना नहीं है।", ta: "எந்த மொழியிலும். எதையும் நிரப்ப வேண்டாம்.", ms: "Apa-apa bahasa. Tiada borang.", id: "Bahasa apa pun. Tanpa formulir.", th: "ภาษาใดก็ได้ ไม่ต้องกรอกอะไร", ja: "どの言語でも。入力は不要です。", zh: "任何语言，无需填表。", fil: "Kahit anong wika. Walang pupunan." },
  typeInstead: { en: "I’d rather type or tap", hi: "मैं टाइप या टैप करना चाहूँगा", ta: "தட்டச்சு செய்ய / தட்ட விரும்புகிறேன்", ms: "Saya lebih suka menaip", id: "Saya lebih suka mengetik", th: "ขอพิมพ์หรือแตะแทน", ja: "文字やタップで答える", zh: "我想打字或点选", fil: "Mas gusto kong mag-type" },
  screenshotStart: { en: "Start with a screenshot", hi: "स्क्रीनशॉट से शुरू करें", ta: "திரைப்பிடிப்புடன் தொடங்கு", ms: "Mula dengan tangkapan skrin", id: "Mulai dengan tangkapan layar", th: "เริ่มจากภาพหน้าจอ", ja: "スクリーンショットから始める", zh: "从截图开始", fil: "Magsimula sa screenshot" },
  how1: { en: "Call the right number", hi: "सही नंबर पर कॉल करें", ta: "சரியான எண்ணை அழையுங்கள்", ms: "Hubungi nombor yang betul", id: "Hubungi nomor yang benar", th: "โทรหาเบอร์ที่ถูกต้อง", ja: "正しい番号に電話", zh: "拨打正确的号码", fil: "Tawagan ang tamang numero" },
  how1s: { en: "One tap. Never a number from a search or a message.", hi: "एक टैप। सर्च या मैसेज से मिला नंबर कभी नहीं।", ta: "ஒரு தட்டல். தேடலிலோ செய்தியிலோ வந்த எண் வேண்டாம்.", ms: "Satu ketik. Jangan guna nombor daripada carian atau mesej.", id: "Satu ketukan. Jangan pakai nomor dari pencarian atau pesan.", th: "แตะครั้งเดียว ห้ามใช้เบอร์จากการค้นหาหรือข้อความ", ja: "ワンタップで。検索やメッセージの番号は使わない。", zh: "一键拨打。绝不用搜索或短信里的号码。", fil: "Isang tap. Huwag gumamit ng numero mula sa search o mensahe." },
  how2: { en: "Have the answers ready", hi: "जवाब तैयार रखें", ta: "பதில்கள் தயார்", ms: "Jawapan sedia", id: "Jawaban siap", th: "มีคำตอบพร้อม", ja: "答えを用意", zh: "答案已备好", fil: "Handa ang mga sagot" },
  how2s: { en: "Amount, time, account and reference, ready to read out.", hi: "रकम, समय, खाता और रेफ़रेंस, पढ़कर सुनाने के लिए तैयार।", ta: "தொகை, நேரம், கணக்கு, குறிப்பு எண்: வாசிக்கத் தயார்.", ms: "Jumlah, masa, akaun dan rujukan, sedia untuk dibaca.", id: "Jumlah, waktu, rekening, dan referensi, siap dibacakan.", th: "จำนวนเงิน เวลา บัญชี และเลขอ้างอิง พร้อมอ่าน", ja: "金額・時刻・口座・取引番号を読み上げられる形に。", zh: "金额、时间、账户和交易编号，可直接念出。", fil: "Halaga, oras, account at reference, handang basahin." },
  how3: { en: "We handle the rest", hi: "बाकी हम संभालेंगे", ta: "மீதியை நாங்கள் பார்த்துக்கொள்வோம்", ms: "Selebihnya kami uruskan", id: "Sisanya kami urus", th: "ที่เหลือเราจัดการ", ja: "あとは任せて", zh: "其余交给我们", fil: "Kami na ang bahala sa iba" },
  how3s: { en: "Official reports, follow-ups, and a freeze alert when victims match.", hi: "आधिकारिक रिपोर्ट, फ़ॉलो-अप, और पीड़ित मिलने पर फ्रीज़ अलर्ट।", ta: "அதிகாரப்பூர்வ புகார்கள், பின்தொடர்தல், முடக்க எச்சரிக்கை.", ms: "Laporan rasmi, susulan, dan amaran bekukan apabila mangsa sepadan.", id: "Laporan resmi, tindak lanjut, dan peringatan blokir saat korban cocok.", th: "แจ้งความทางการ ติดตามผล และแจ้งเตือนอายัดเมื่อผู้เสียหายตรงกัน", ja: "正式な届け出、フォローアップ、被害者一致時の凍結通知。", zh: "正式报案、后续跟进，受害者匹配时发出冻结提醒。", fil: "Opisyal na ulat, follow-up, at freeze alert kapag tumugma ang mga biktima." },
  cardCheckTitle: { en: "Not sure yet? Check before you pay", hi: "पक्का नहीं? भुगतान से पहले जाँचें", ta: "உறுதியாக இல்லையா? பணம் செலுத்தும் முன் சரிபாருங்கள்", ms: "Belum pasti? Semak sebelum bayar", id: "Belum yakin? Cek sebelum bayar", th: "ยังไม่แน่ใจ? ตรวจก่อนจ่าย", ja: "迷ったら、払う前に確認", zh: "不确定？付款前先检查", fil: "Hindi sigurado? Suriin bago magbayad" },
  cardCheckBody: { en: "Paste a message, number, account or link. We check it against other victims’ reports.", hi: "संदेश, नंबर, खाता या लिंक डालें। हम दूसरे पीड़ितों की रिपोर्टों से मिलान करते हैं।", ta: "செய்தி, எண், கணக்கு அல்லது இணைப்பை ஒட்டுங்கள். மற்றவர்களின் புகார்களுடன் ஒப்பிடுகிறோம்.", ms: "Tampal mesej, nombor, akaun atau pautan. Kami semak dengan laporan mangsa lain.", id: "Tempel pesan, nomor, rekening, atau tautan. Kami cocokkan dengan laporan korban lain.", th: "วางข้อความ เบอร์ บัญชี หรือลิงก์ เราจะตรวจกับรายงานของผู้เสียหายรายอื่น", ja: "メッセージ・番号・口座・リンクを貼り付けると、他の被害報告と照合します。", zh: "粘贴信息、号码、账户或链接，我们会与其他受害者的举报比对。", fil: "I-paste ang mensahe, numero, account o link. Itutugma namin sa ulat ng ibang biktima." },
  checkBtn: { en: "Check", hi: "जाँचें", ta: "சரிபார்", ms: "Semak", id: "Cek", th: "ตรวจ", ja: "確認", zh: "检查", fil: "Suriin" },
  cardAlertsTitle: { en: "Scams going around in", hi: "इन दिनों चल रही ठगी:", ta: "தற்போது பரவும் மோசடிகள்:", ms: "Penipuan terkini di", id: "Penipuan yang marak di", th: "มิจฉาชีพที่กำลังระบาดใน", ja: "流行中の詐欺：", zh: "近期常见诈骗：", fil: "Mga scam na kumakalat sa" },
  seeExample: { en: "See what it looks like", hi: "देखें यह कैसा दिखता है", ta: "இது எப்படி இருக்கும் என்று பார்", ms: "Lihat contohnya", id: "Lihat contohnya", th: "ดูตัวอย่าง", ja: "例を見る", zh: "查看示例", fil: "Tingnan ang halimbawa" },
  demoEyebrow: { en: "Judging or testing?", hi: "जज या टेस्टर?", ta: "நடுவரா அல்லது சோதனையா?", ms: "Juri atau penguji?", id: "Juri atau penguji?", th: "กรรมการหรือผู้ทดสอบ?", ja: "審査・テスト中ですか？", zh: "评审或测试？", fil: "Hurado o tester?" },
  demoTitle: { en: "See the whole journey in one minute", hi: "एक मिनट में पूरा सफ़र देखें", ta: "ஒரு நிமிடத்தில் முழுப் பயணத்தையும் பாருங்கள்", ms: "Lihat seluruh perjalanan dalam seminit", id: "Lihat seluruh alurnya dalam semenit", th: "ดูทั้งกระบวนการในหนึ่งนาที", ja: "1分で全体の流れを見る", zh: "一分钟看完整个流程", fil: "Tingnan ang buong proseso sa isang minuto" },
  takeTour: { en: "Take the quick tour", hi: "छोटा टूर देखें", ta: "சிறு சுற்றுப்பயணம்", ms: "Lawatan ringkas", id: "Tur singkat", th: "ทัวร์สั้น ๆ", ja: "クイックツアー", zh: "快速导览", fil: "Mabilis na tour" },
  orPick: { en: "Or pick a sample case", hi: "या एक नमूना मामला चुनें", ta: "அல்லது மாதிரி வழக்கைத் தேர்ந்தெடு", ms: "Atau pilih kes contoh", id: "Atau pilih kasus contoh", th: "หรือเลือกกรณีตัวอย่าง", ja: "またはサンプルを選ぶ", zh: "或选择示例案例", fil: "O pumili ng sample na kaso" },

  // ---- check ----
  checkPill: { en: "Before you pay or reply", hi: "भुगतान या जवाब से पहले", ta: "பணம் செலுத்தும் / பதிலளிக்கும் முன்", ms: "Sebelum bayar atau balas", id: "Sebelum bayar atau membalas", th: "ก่อนจ่ายหรือตอบกลับ", ja: "支払いや返信の前に", zh: "付款或回复之前", fil: "Bago magbayad o sumagot" },
  checkH1: { en: "Is this a scam? Check it in seconds.", hi: "क्या यह ठगी है? सेकंडों में जाँचें।", ta: "இது மோசடியா? நொடிகளில் சரிபாருங்கள்.", ms: "Adakah ini penipuan? Semak dalam beberapa saat.", id: "Apakah ini penipuan? Cek dalam hitungan detik.", th: "นี่คือมิจฉาชีพไหม? ตรวจได้ในไม่กี่วินาที", ja: "これは詐欺？数秒で確認。", zh: "这是诈骗吗？几秒钟就能查。", fil: "Scam ba ito? Suriin sa ilang segundo." },
  checkLead: {
    en: "Paste a message, or a phone number, bank account, payment ID or link. Golden Hour checks it against reports from other victims and looks for the tricks scammers use, in any language.",
    hi: "संदेश, फ़ोन नंबर, बैंक खाता, पेमेंट आईडी या लिंक डालें। Golden Hour दूसरे पीड़ितों की रिपोर्टों से मिलान करता है और ठगों की चालें पहचानता है, किसी भी भाषा में।",
    ta: "செய்தி, தொலைபேசி எண், வங்கிக் கணக்கு, கட்டண ஐடி அல்லது இணைப்பை ஒட்டுங்கள். Golden Hour மற்றவர்களின் புகார்களுடன் ஒப்பிட்டு, மோசடியாளர்களின் தந்திரங்களைத் தேடும்.",
    ms: "Tampal mesej, nombor telefon, akaun bank, ID pembayaran atau pautan. Golden Hour menyemaknya dengan laporan mangsa lain dan mencari helah penipu, dalam apa-apa bahasa.",
    id: "Tempel pesan, nomor telepon, rekening bank, ID pembayaran, atau tautan. Golden Hour mencocokkannya dengan laporan korban lain dan mencari trik penipu, dalam bahasa apa pun.",
    th: "วางข้อความ เบอร์โทร บัญชีธนาคาร พร้อมเพย์ หรือลิงก์ Golden Hour จะตรวจกับรายงานของผู้เสียหายอื่นและมองหากลโกง ไม่ว่าภาษาใด",
    ja: "メッセージ、電話番号、口座番号、決済ID、リンクを貼り付けてください。Golden Hour が他の被害報告と照合し、詐欺の手口を探します。どの言語でも使えます。",
    zh: "粘贴信息、电话号码、银行账户、支付 ID 或链接。Golden Hour 会与其他受害者的举报比对，并识别骗子的惯用伎俩，支持任何语言。",
    fil: "I-paste ang mensahe, numero, bank account, payment ID o link. Itutugma ito ng Golden Hour sa ulat ng ibang biktima at hahanapin ang mga taktika ng scammer, sa anumang wika.",
  },
  checkPlaceholder: { en: "Paste or say what you received, for example a text message or the number that called you", hi: "जो मिला उसे डालें या बोलें, जैसे कोई SMS या कॉल करने वाला नंबर", ta: "பெற்றதை ஒட்டுங்கள் அல்லது சொல்லுங்கள், உதா. SMS அல்லது அழைத்த எண்", ms: "Tampal atau sebut apa yang anda terima, contohnya SMS atau nombor yang menelefon", id: "Tempel atau ucapkan yang Anda terima, misalnya SMS atau nomor yang menelepon", th: "วางหรือพูดสิ่งที่ได้รับ เช่น SMS หรือเบอร์ที่โทรมา", ja: "届いたメッセージや電話番号を貼り付けるか、話してください", zh: "粘贴或说出您收到的内容，例如短信或来电号码", fil: "I-paste o sabihin ang natanggap mo, gaya ng text o numerong tumawag" },
  checkIt: { en: "Check it", hi: "जाँचें", ta: "சரிபார்", ms: "Semak", id: "Cek sekarang", th: "ตรวจเลย", ja: "確認する", zh: "检查", fil: "Suriin" },
  sayIt: { en: "Say it", hi: "बोलें", ta: "சொல்லுங்கள்", ms: "Sebut", id: "Ucapkan", th: "พูด", ja: "話す", zh: "说出来", fil: "Sabihin" },
  stop: { en: "Stop", hi: "रोकें", ta: "நிறுத்து", ms: "Henti", id: "Berhenti", th: "หยุด", ja: "停止", zh: "停止", fil: "Ihinto" },
  clear: { en: "Clear", hi: "मिटाएँ", ta: "அழி", ms: "Kosongkan", id: "Hapus", th: "ล้าง", ja: "消去", zh: "清除", fil: "Burahin" },
  riskHigh: { en: "High risk", hi: "उच्च जोखिम", ta: "அதிக ஆபத்து", ms: "Risiko tinggi", id: "Risiko tinggi", th: "ความเสี่ยงสูง", ja: "危険度：高", zh: "高风险", fil: "Mataas na panganib" },
  riskMedium: { en: "Be careful", hi: "सावधान रहें", ta: "கவனமாக இருங்கள்", ms: "Berhati-hati", id: "Hati-hati", th: "ระวัง", ja: "注意", zh: "请小心", fil: "Mag-ingat" },
  riskLow: { en: "No warning signs found", hi: "कोई चेतावनी संकेत नहीं मिला", ta: "எச்சரிக்கை அறிகுறி இல்லை", ms: "Tiada tanda amaran", id: "Tidak ada tanda bahaya", th: "ไม่พบสัญญาณเตือน", ja: "警告サインなし", zh: "未发现警示信号", fil: "Walang nakitang babala" },
  foundInNetwork: { en: "Found in the scam network", hi: "ठगी नेटवर्क में मिला", ta: "மோசடி வலையமைப்பில் உள்ளது", ms: "Ditemui dalam rangkaian penipuan", id: "Ditemukan di jaringan penipuan", th: "พบในเครือข่ายมิจฉาชีพ", ja: "詐欺ネットワークで発見", zh: "在诈骗网络中发现", fil: "Nakita sa network ng scam" },
  warningSigns: { en: "Warning signs", hi: "चेतावनी संकेत", ta: "எச்சரிக்கை அறிகுறிகள்", ms: "Tanda amaran", id: "Tanda bahaya", th: "สัญญาณเตือน", ja: "警告サイン", zh: "警示信号", fil: "Mga babala" },
  whatToDo: { en: "What to do", hi: "क्या करें", ta: "என்ன செய்வது", ms: "Apa perlu dibuat", id: "Yang harus dilakukan", th: "สิ่งที่ควรทำ", ja: "すべきこと", zh: "该怎么做", fil: "Ano ang gagawin" },
  warnFamily: { en: "Warn family and friends", hi: "परिवार और दोस्तों को सावधान करें", ta: "குடும்பம், நண்பர்களை எச்சரி", ms: "Beri amaran kepada keluarga", id: "Peringatkan keluarga", th: "เตือนครอบครัวและเพื่อน", ja: "家族や友人に知らせる", zh: "提醒家人朋友", fil: "Babalaan ang pamilya" },
  readAloud: { en: "Read aloud", hi: "पढ़कर सुनाएँ", ta: "உரக்கப் படி", ms: "Baca kuat", id: "Bacakan", th: "อ่านออกเสียง", ja: "読み上げ", zh: "朗读", fil: "Basahin nang malakas" },
  reportThis: { en: "Report this scam", hi: "इस ठगी की रिपोर्ट करें", ta: "இந்த மோசடியைப் புகாரளி", ms: "Laporkan penipuan ini", id: "Laporkan penipuan ini", th: "แจ้งเรื่องนี้", ja: "この詐欺を報告", zh: "举报此诈骗", fil: "Iulat ang scam na ito" },
  alreadyPaid: { en: "Already paid? Call", hi: "भुगतान कर दिया? कॉल करें", ta: "ஏற்கனவே செலுத்தினீர்களா? அழையுங்கள்", ms: "Sudah bayar? Hubungi", id: "Sudah bayar? Telepon", th: "จ่ายไปแล้ว? โทร", ja: "支払い済みなら電話：", zh: "已付款？请拨打", fil: "Nakapagbayad na? Tumawag sa" },
  tryExample: { en: "Try an example", hi: "एक उदाहरण आज़माएँ", ta: "ஒரு உதாரணத்தை முயற்சி செய்", ms: "Cuba contoh", id: "Coba contoh", th: "ลองตัวอย่าง", ja: "例を試す", zh: "试试示例", fil: "Subukan ang halimbawa" },

  // ---- safety hub ----
  safetyH1: { en: "Stay one step ahead of scammers", hi: "ठगों से एक कदम आगे रहें", ta: "மோசடியாளர்களை விட ஒரு படி முன்னால்", ms: "Sentiasa selangkah di hadapan penipu", id: "Selangkah lebih maju dari penipu", th: "ก้าวนำมิจฉาชีพหนึ่งก้าว", ja: "詐欺師の一歩先へ", zh: "比骗子快一步", fil: "Laging isang hakbang sa unahan ng scammer" },
  safetyLead: { en: "Practise saying no, get warnings during a call, and let someone you trust look out for you.", hi: "ना कहने का अभ्यास करें, कॉल के दौरान चेतावनी पाएँ, और किसी भरोसेमंद को अपनी निगरानी करने दें।", ta: "இல்லை என்று சொல்லப் பயிற்சி செய்யுங்கள், அழைப்பின்போது எச்சரிக்கை பெறுங்கள், நம்பிக்கையானவர் உங்களைக் கவனிக்கட்டும்.", ms: "Berlatih berkata tidak, dapatkan amaran semasa panggilan, dan biar orang yang dipercayai menjaga anda.", id: "Berlatih menolak, dapatkan peringatan saat ditelepon, dan biarkan orang tepercaya menjaga Anda.", th: "ฝึกปฏิเสธ รับคำเตือนระหว่างสาย และให้คนที่ไว้ใจช่วยดูแล", ja: "断る練習をし、通話中に警告を受け、信頼できる人に見守ってもらいましょう。", zh: "练习说“不”，通话中获得提醒，并让信任的人照看您。", fil: "Magsanay tumanggi, makakuha ng babala habang may tawag, at hayaang may pinagkakatiwalaang magbantay sa iyo." },
  practiceTitle: { en: "Practice call", hi: "अभ्यास कॉल", ta: "பயிற்சி அழைப்பு", ms: "Panggilan latihan", id: "Latihan panggilan", th: "ฝึกรับสาย", ja: "練習通話", zh: "模拟来电练习", fil: "Practice na tawag" },
  practiceBody: { en: "A pretend scammer calls you. Practise saying no and get a score.", hi: "एक नकली ठग आपको कॉल करता है। ना कहने का अभ्यास करें और स्कोर पाएँ।", ta: "போலி மோசடியாளர் அழைக்கிறார். இல்லை என்று சொல்லிப் பழகி மதிப்பெண் பெறுங்கள்.", ms: "Penipu olok-olok menelefon anda. Berlatih menolak dan dapatkan markah.", id: "Penipu pura-pura menelepon. Berlatih menolak dan dapatkan skor.", th: "มิจฉาชีพจำลองโทรมา ฝึกปฏิเสธแล้วรับคะแนน", ja: "偽の詐欺電話で断る練習をして、点数をもらいましょう。", zh: "模拟骗子来电，练习拒绝并获得评分。", fil: "Tatawag ang kunwaring scammer. Magsanay tumanggi at makakuha ng score." },
  shieldTitle: { en: "Call shield", hi: "कॉल शील्ड", ta: "அழைப்பு கவசம்", ms: "Perisai panggilan", id: "Perisai panggilan", th: "โล่ป้องกันสาย", ja: "通話シールド", zh: "通话防护", fil: "Call shield" },
  shieldBody: { en: "Put a suspicious call on speaker. Golden Hour listens and warns you if it sounds like a scam.", hi: "संदिग्ध कॉल को स्पीकर पर रखें। Golden Hour सुनता है और ठगी लगे तो चेतावनी देता है।", ta: "சந்தேகமான அழைப்பை ஸ்பீக்கரில் வையுங்கள். மோசடி போல இருந்தால் Golden Hour எச்சரிக்கும்.", ms: "Letak panggilan mencurigakan pada pembesar suara. Golden Hour mendengar dan memberi amaran.", id: "Nyalakan pengeras suara pada panggilan mencurigakan. Golden Hour mendengar dan memperingatkan Anda.", th: "เปิดลำโพงเมื่อได้รับสายน่าสงสัย Golden Hour จะฟังและเตือนถ้าดูเหมือนมิจฉาชีพ", ja: "怪しい電話をスピーカーにすると、Golden Hour が聞き取り、詐欺の疑いがあれば警告します。", zh: "把可疑来电开免提，Golden Hour 会收听并在疑似诈骗时提醒您。", fil: "I-speaker ang kahina-hinalang tawag. Makikinig ang Golden Hour at magbababala kung scam." },
  familyTitle: { en: "Family guardian", hi: "पारिवारिक संरक्षक", ta: "குடும்பப் பாதுகாவலர்", ms: "Penjaga keluarga", id: "Penjaga keluarga", th: "ผู้ดูแลครอบครัว", ja: "家族の見守り", zh: "家人守护", fil: "Tagapagbantay ng pamilya" },
  familyBody: { en: "Choose someone you trust. They’re alerted if you report a scam or a check looks risky.", hi: "किसी भरोसेमंद को चुनें। रिपोर्ट या जोखिम वाली जाँच पर उन्हें सूचना मिलती है।", ta: "நம்பிக்கையானவரைத் தேர்ந்தெடுங்கள். புகார் அல்லது ஆபத்தான சரிபார்ப்பின்போது அவருக்கு அறிவிப்பு செல்லும்.", ms: "Pilih orang yang dipercayai. Mereka dimaklumkan jika anda melapor atau semakan berisiko.", id: "Pilih orang tepercaya. Mereka diberi tahu jika Anda melapor atau hasil cek berisiko.", th: "เลือกคนที่ไว้ใจ เขาจะได้รับแจ้งเมื่อคุณแจ้งเหตุหรือผลตรวจมีความเสี่ยง", ja: "信頼できる人を選ぶと、報告時や危険な確認結果のときに知らせます。", zh: "选择您信任的人。当您举报或检查结果有风险时会通知对方。", fil: "Pumili ng pinagkakatiwalaan. Aabisuhan sila kung mag-uulat ka o delikado ang resulta." },
  trackerTitle: { en: "My reports", hi: "मेरी रिपोर्टें", ta: "என் புகார்கள்", ms: "Laporan saya", id: "Laporan saya", th: "รายงานของฉัน", ja: "私の報告", zh: "我的举报", fil: "Aking mga ulat" },
  trackerBody: { en: "Track reference numbers and follow-ups until your case is resolved.", hi: "मामला सुलझने तक संदर्भ नंबर और फ़ॉलो-अप पर नज़र रखें।", ta: "வழக்கு முடியும் வரை குறிப்பு எண்கள், பின்தொடர்தல்களைக் கண்காணியுங்கள்.", ms: "Jejak nombor rujukan dan susulan sehingga kes selesai.", id: "Lacak nomor referensi dan tindak lanjut sampai kasus selesai.", th: "ติดตามเลขอ้างอิงและการติดตามผลจนเรื่องจบ", ja: "解決まで受付番号とフォローアップを管理。", zh: "跟踪参考编号和后续进度，直到结案。", fil: "Subaybayan ang reference number at follow-up hanggang malutas." },
  open: { en: "Open", hi: "खोलें", ta: "திற", ms: "Buka", id: "Buka", th: "เปิด", ja: "開く", zh: "打开", fil: "Buksan" },
} satisfies Record<string, Entry>;

export type Key = keyof typeof D;

// ---------- store ----------
const KEY = "gh.lang";
const EVT = "gh-lang";

function detect(): UiLang {
  const nav = (typeof navigator !== "undefined" ? navigator.language : "en").toLowerCase();
  const base = nav.split("-")[0];
  if (base === "tl") return "fil";
  return (UI_LANGS.find((l) => l.code === base)?.code ?? "en") as UiLang;
}

function read(): UiLang {
  try {
    const v = localStorage.getItem(KEY);
    if (v && UI_LANGS.some((l) => l.code === v)) return v as UiLang;
  } catch {
    /* storage unavailable */
  }
  return detect();
}

let cache: UiLang | null = null;
function snapshot(): UiLang {
  if (!cache) cache = read();
  return cache;
}

export function setUiLang(l: UiLang) {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* still apply for this visit */
  }
  cache = l;
  window.dispatchEvent(new Event(EVT));
}

export function useUiLang(): UiLang {
  const lang = useSyncExternalStore(
    (cb) => {
      const on = () => {
        cache = read();
        cb();
      };
      window.addEventListener(EVT, on);
      window.addEventListener("storage", on);
      return () => {
        window.removeEventListener(EVT, on);
        window.removeEventListener("storage", on);
      };
    },
    snapshot,
    () => "en" as UiLang,
  );
  // Screen readers pronounce the page in the chosen language
  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-Hans" : lang;
  }, [lang]);
  return lang;
}

export function useT() {
  const lang = useUiLang();
  return (k: Key) => (D[k] as Entry)[lang] ?? D[k].en;
}

export function tr(lang: UiLang, k: Key) {
  return (D[k] as Entry)[lang] ?? D[k].en;
}
