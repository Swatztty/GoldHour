"""Renders the fictional sample-case screenshots in public/samples.

Run:  python3 scripts/render_samples.py
Requires: pip install playwright && playwright install chromium
All names, numbers, UPI IDs and accounts are invented for demo purposes.
"""
import html
import pathlib
from playwright.sync_api import sync_playwright

OUT = pathlib.Path(__file__).resolve().parent.parent / "public" / "samples"
OUT.mkdir(parents=True, exist_ok=True)

BASE_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
body { width: 400px; font-family: Roboto, 'Noto Sans', 'Noto Sans CJK JP', Arial, sans-serif; background: #fff; }
.status { display: flex; justify-content: space-between; padding: 8px 16px; font-size: 13px; font-weight: 600; }
.tag { font-size: 10px; font-weight: 700; background: #ffd54a; color: #222; border-radius: 4px; padding: 1px 6px; }
.bar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; color: #fff; }
.avatar { width: 38px; height: 38px; border-radius: 50%; display: grid; place-items: center; font-weight: 700; font-size: 15px; }
.bar .name { font-weight: 600; font-size: 15.5px; line-height: 1.2; }
.bar .sub { font-size: 12px; opacity: .85; }
.chat { padding: 12px 10px 18px; display: flex; flex-direction: column; gap: 8px; min-height: 560px; }
.b { max-width: 82%; padding: 7px 10px 18px; border-radius: 10px; font-size: 14.5px; line-height: 1.38; position: relative; box-shadow: 0 1px 0.5px rgba(0,0,0,.13); white-space: pre-wrap; }
.b .t { position: absolute; right: 8px; bottom: 3px; font-size: 10.5px; color: #667; }
.in { align-self: flex-start; background: #fff; border-top-left-radius: 2px; }
.out { align-self: flex-end; border-top-right-radius: 2px; }
.day { align-self: center; font-size: 12px; background: rgba(255,255,255,.85); color: #555; padding: 3px 10px; border-radius: 8px; margin: 4px 0; }
.sms .b { background: #eef0f4; }
.sms .chat { background: #fff; }
"""


def page(status_color, bar_bg, avatar_bg, avatar, name, sub, chat_bg, out_bg, items, cls=""):
    rows = []
    for it in items:
        if it[0] == "day":
            rows.append(f'<div class="day">{html.escape(it[1])}</div>')
        else:
            side, text, time = it
            bg = f' style="background:{out_bg}"' if side == "out" else ""
            rows.append(f'<div class="b {side}"{bg}>{html.escape(text)}<span class="t">{time}</span></div>')
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>{BASE_CSS}</style></head>
<body class="{cls}">
<div class="status" style="background:{status_color};color:#fff"><span>{items[-1][2] if items[-1][0] != 'day' else ''}</span><span class="tag">SAMPLE · FICTIONAL</span><span>4G ▮▮▮ 62%</span></div>
<div class="bar" style="background:{bar_bg}"><span style="font-size:20px">‹</span><div class="avatar" style="background:{avatar_bg}">{avatar}</div>
<div><div class="name">{html.escape(name)}</div><div class="sub">{html.escape(sub)}</div></div></div>
<div class="chat" style="background:{chat_bg}">{''.join(rows)}</div>
</body></html>"""


SAMPLES = {
    "digital-arrest-chat": page(
        "#0b4f45", "#0f6b5c", "#9fb7c2", "RS", "Insp. R. Sharma – Mumbai Cyber Cell", "+91 98201 44716 · video call 47:12",
        "#ece5dd", "#d9fdd3",
        [
            ("day", "Today"),
            ("in", "This is Mumbai Cyber Crime Branch. A courier parcel booked on your Aadhaar contains 5 passports and MDMA. FIR No. MH/CYB/2219/2026 is registered against you.", "1:52 PM"),
            ("in", "You are under DIGITAL ARREST. Do not disconnect the video call or inform anyone. This is a matter of national security.", "1:55 PM"),
            ("out", "Sir I have not sent any parcel. Please help me.", "1:56 PM"),
            ("in", "To prove your funds are legal, transfer your savings to the RBI verification account. Amount will be refunded within 2 hours after verification.", "2:04 PM"),
            ("in", "Account name: VERIFICATION SERVICES\nA/c 50200087345521\nIFSC HDFC0004127", "2:05 PM"),
            ("in", "Second part send by UPI:\nrbi.verify.cell@okaxis", "2:24 PM"),
            ("out", "Done sir. Please don't arrest me.", "2:32 PM"),
        ],
    ),
    "digital-arrest-sms": page(
        "#3b3f8f", "#4a50b0", "#2e7d32", "SB", "AX-SBIINB", "Bank alerts", "#fff", "#e3e6ff",
        [
            ("day", "Today"),
            ("in", "Dear Customer, your A/c XX4821 is debited by Rs.95,000.00 on 15-Oct-26 02:12 PM by IMPS to A/c 50200087345521 (HDFC0004127) VERIFICATION SERVICES. IMPS Ref No 628814402917. If not done by you, report immediately.", "2:12 PM"),
            ("in", "Dear Customer, your A/c XX4821 is debited by Rs.54,998.00 on 15-Oct-26 02:31 PM via UPI to rbi.verify.cell@okaxis. UPI Ref 628815093364.", "2:31 PM"),
        ],
        cls="sms",
    ),
    "sg-official-chat": page(
        "#0b4f45", "#0f6b5c", "#90a4ae", "DK", "Insp. Daniel Koh (SPF)", "+65 8734 2190",
        "#ece5dd", "#d9fdd3",
        [
            ("day", "Today"),
            ("in", "This is Inspector Koh from the Singapore Police Force. Your bank account is linked to a money laundering case, ref CAD/2026/88412.", "1:41 PM"),
            ("in", "To clear your name, transfer your savings to the MAS safety account for verification. It will be returned within 24 hours. Do not tell your family, this is confidential.", "1:47 PM"),
            ("out", "I am very worried. What should I do?", "1:49 PM"),
            ("in", "Account: OCBC 601-482917-001\nName: LX Global Trading Pte Ltd", "1:58 PM"),
            ("in", "Second part by PayNow to UEN 202498765K", "2:20 PM"),
            ("out", "Done. Please check.", "2:29 PM"),
        ],
    ),
    "sg-official-bank": page(
        "#8b1a1a", "#b71c1c", "#e53935", "DB", "DBS", "Bank alerts", "#fff", "#e3e6ff",
        [
            ("day", "Today"),
            ("in", "DBS: You have sent SGD 18,000.00 via FAST to LX GLOBAL TRADING PTE LTD (OCBC 601-482917-001) on 15 Oct 14:06. Ref FT26288143022. If unauthorised, contact your bank immediately.", "2:06 PM"),
            ("in", "DBS: You have sent SGD 6,500.00 via PayNow to UEN 202498765K (KH SOLUTIONS) on 15 Oct 14:28. Ref PN26288151877.", "2:28 PM"),
        ],
        cls="sms",
    ),
    "au-safe-account-sms": page(
        "#1f1f1f", "#2b2b2b", "#c62828", "N", "NAB", "Text message", "#fff", "#dfe7ff",
        [
            ("day", "Today 10:18 am"),
            ("in", "NAB: A new device in Perth has logged in to your account. If this was not you, call our fraud team on 02 8188 5521.", "10:18 AM"),
            ("out", "I called. They said hackers are in my account and I must move my money to a safe account.", "10:39 AM"),
        ],
        cls="sms",
    ),
    "au-safe-account-bank": page(
        "#1f1f1f", "#2b2b2b", "#c62828", "N", "NAB", "Payment confirmations", "#fff", "#dfe7ff",
        [
            ("day", "15 Oct 2026"),
            ("in", "Transfer successful\n$24,500.00 to M NGUYEN\nBSB 033-201  Account 4417 2290\nDescription: SAFE ACCT\nReceipt N1015-77210443", "10:42 AM"),
            ("in", "Osko payment sent\n$9,800.00 to PayID 0412 555 019 (J PATEL)\nReceipt N1015-77213108", "11:05 AM"),
        ],
        cls="sms",
    ),
    "jp-fake-police-chat": page(
        "#05a548", "#06c755", "#455a64", "佐", "警視庁 捜査二課 佐藤", "LINE 音声通話 03-6812-4470",
        "#8cabd8", "#85e249",
        [
            ("day", "今日"),
            ("in", "警視庁捜査二課の佐藤です。あなたの口座がマネーロンダリング事件に使われています。", "13:21"),
            ("in", "逮捕を避けるため、資産を保全口座に移してください。確認後すぐに返金されます。このことは誰にも話さないでください。", "13:30"),
            ("out", "わかりました。どうすればいいですか。", "13:33"),
            ("in", "振込先：みずほ銀行 新宿支店\n普通 3812274\n名義 カ）ホゼンカンリ", "13:41"),
            ("in", "2回目：楽天銀行 第一営業支店\n普通 7254018\n名義 タナカ ケンジ", "14:09"),
            ("out", "振り込みました。", "14:22"),
        ],
    ),
    "jp-fake-police-bank": page(
        "#00523a", "#00704a", "#2e7d32", "三", "三井住友銀行", "お知らせ", "#fff", "#e3f2e9",
        [
            ("day", "10月15日"),
            ("in", "【三井住友銀行】お振込を受け付けました。\n振込先：みずほ銀行 新宿支店 普通 3812274 カ）ホゼンカンリ\n金額：1,800,000円\n受付番号：20261015-0047721\n10月15日 13:52", "13:52"),
            ("in", "【三井住友銀行】お振込を受け付けました。\n振込先：楽天銀行 第一営業支店 普通 7254018 タナカ ケンジ\n金額：650,000円\n受付番号：20261015-0051308\n10月15日 14:20", "14:20"),
        ],
        cls="sms",
    ),
}

with sync_playwright() as p:
    browser = p.chromium.launch()
    pg = browser.new_page(viewport={"width": 400, "height": 700}, device_scale_factor=2)
    for name, doc in SAMPLES.items():
        pg.set_content(doc)
        pg.screenshot(path=str(OUT / f"{name}.png"), full_page=True)
        print("wrote", name)
    browser.close()
