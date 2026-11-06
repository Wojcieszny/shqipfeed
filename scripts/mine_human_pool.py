#!/usr/bin/env python3
"""
scripts/mine_human_pool.py — Mine unused on-disk human audio pool to build 10 Real-Life Family Scenes & expand everyday cards.

Ticket: CORPUS-SCENES-01
- Organizes day.js into 10 focused Real-Life Family Micro-Scenes (10 turns each, 100 turns total).
- Mines 50 high-utility everyday family conversational sentences from human_corpus_index.json into cards.json.
- Registers all provenance in sources.js and human.js.
- Updates sw.js cache to shqipfeed-v37 (< 1,500 assets).
- Updates docs/ROADMAP.md.
"""

import os
import shutil
import json
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_json(rel_path):
    with open(os.path.join(ROOT, rel_path), 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(rel_path, data):
    with open(os.path.join(ROOT, rel_path), 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

def read_text(rel_path):
    with open(os.path.join(ROOT, rel_path), 'r', encoding='utf-8') as f:
        return f.read()

def write_text(rel_path, text):
    with open(os.path.join(ROOT, rel_path), 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)

# 1. Load human corpus index
corpus = load_json('human_corpus_index.json')
corpus_by_path = {c['file_path']: c for c in corpus}
word_pool = {c['albanian'].strip().lower(): c for c in corpus if c.get('kind') == 'word'}

# 2. Define the 50 new cards across 5 key islands
NEW_CARDS = [
    # --- Family & Warmth (10 cards: family-013 .. family-022) ---
    {
        "id": "family-013",
        "island": "Family & Warmth",
        "albanian": "Kam punuar gjithë ditën.",
        "english": "I worked all day long.",
        "phonetic": "kahm poo-NOO-ahr GYEETH dee-TUHN",
        "tip": "Simple past tense: kam punuar (I worked). Final -ë is dropped in spoken Albanian.",
        "blocks": [
            {"text": "Kam punuar", "type": "verb"},
            {"text": "gjithë ditën", "type": "other"}
        ],
        "source_file": "audio/human/kam-punuar-gjithë-ditën.mp3",
        "lesson": {
            "background": "Common evening remark when catching up with family after work.",
            "answers": [
                {"id": "family-013-a1", "albanian": "Unë jam i lodhur.", "english": "I am tired", "audio": "day/12"},
                {"id": "family-013-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "family-001-r"}
            ],
            "reply": {"id": "family-013-r", "albanian": "Unë jam i lodhur.", "english": "I am tired", "audio": "day/12"}
        }
    },
    {
        "id": "family-014",
        "island": "Family & Warmth",
        "albanian": "Unë punoj në zyrë.",
        "english": "I work at an office.",
        "phonetic": "OO-nuh poo-NOI nuh ZEE-ruh",
        "tip": "Describing where you work to family or new acquaintances.",
        "blocks": [
            {"text": "Unë punoj", "type": "verb"},
            {"text": "në zyrë", "type": "other"}
        ],
        "source_file": "audio/human/unë-punoj-në-zyrë.mp3",
        "lesson": {
            "background": "Talking about your profession and daily routine.",
            "answers": [
                {"id": "family-014-a1", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"},
                {"id": "family-014-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "family-014-r", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"}
        }
    },
    {
        "id": "family-015",
        "island": "Family & Warmth",
        "albanian": "A po punon ai tani?",
        "english": "Is he working right now?",
        "phonetic": "ah poh poo-NOHN ai TAH-nee?",
        "tip": "Asking if someone is busy working right now. Note the continuous marker 'po'.",
        "blocks": [
            {"text": "A po punon", "type": "verb"},
            {"text": "ai tani", "type": "other"}
        ],
        "source_file": "audio/human/a-po-punon-ai-tani.mp3",
        "lesson": {
            "background": "Checking in on a family member's schedule.",
            "answers": [
                {"id": "family-015-a1", "albanian": "Ai është në punë", "english": "He is at work", "audio": "day/52"},
                {"id": "family-015-a2", "albanian": "Ai është në shtëpi", "english": "He is at home", "audio": "day/55"}
            ],
            "reply": {"id": "family-015-r", "albanian": "Ai është në punë", "english": "He is at work", "audio": "day/52"}
        }
    },
    {
        "id": "family-016",
        "island": "Family & Warmth",
        "albanian": "Kur kthehesh në shtëpi?",
        "english": "When will you come home?",
        "phonetic": "koor KTHEH-hesh nuh shte-PEE?",
        "tip": "Common loving question spouses and family members ask each other during the day.",
        "blocks": [
            {"text": "Kur kthehesh", "type": "verb"},
            {"text": "në shtëpi", "type": "object"}
        ],
        "source_file": "audio/human/kur-kthehesh-në-shtëpi.mp3",
        "lesson": {
            "background": "Planning dinner and evening arrival time at home.",
            "answers": [
                {"id": "family-016-a1", "albanian": "Është ora tetë.", "english": "It is eight o'clock", "audio": "day/65"},
                {"id": "family-016-a2", "albanian": "Sot nuk kam kohë", "english": "I don't have time today", "audio": "plans-001-a2"}
            ],
            "reply": {"id": "family-016-r", "albanian": "Është ora tetë.", "english": "It is eight o'clock", "audio": "day/65"}
        }
    },
    {
        "id": "family-017",
        "island": "Family & Warmth",
        "albanian": "Ai është në punë",
        "english": "He is at work.",
        "phonetic": "ai UHSHT nuh POON",
        "tip": "Direct statement about a family member's location. 'Punë' drops final -ë to sound like POON.",
        "blocks": [
            {"text": "Ai është", "type": "power"},
            {"text": "në punë", "type": "other"}
        ],
        "source_file": "audio/human/ai-është-në-punë.mp3",
        "lesson": {
            "background": "Explaining that someone isn't home yet.",
            "answers": [
                {"id": "family-017-a1", "albanian": "Në rregull", "english": "All right", "audio": "day/16"},
                {"id": "family-017-a2", "albanian": "Faleminderit", "english": "Thank you", "audio": "food-001-a1"}
            ],
            "reply": {"id": "family-017-r", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
        }
    },
    {
        "id": "family-018",
        "island": "Family & Warmth",
        "albanian": "Ai është në shtëpi",
        "english": "He is at home.",
        "phonetic": "ai UHSHT nuh shte-PEE",
        "tip": "Saying that someone has arrived home.",
        "blocks": [
            {"text": "Ai është", "type": "power"},
            {"text": "në shtëpi", "type": "other"}
        ],
        "source_file": "audio/human/ai-është-në-shtëpi.mp3",
        "lesson": {
            "background": "Letting guests or callers know someone is home.",
            "answers": [
                {"id": "family-018-a1", "albanian": "Mirë se vini!", "english": "Welcome!", "audio": "day/05"},
                {"id": "family-018-a2", "albanian": "Mirëdita", "english": "Hello", "audio": "day/01"}
            ],
            "reply": {"id": "family-018-r", "albanian": "Mirë se vini!", "english": "Welcome!", "audio": "day/05"}
        }
    },
    {
        "id": "family-019",
        "island": "Family & Warmth",
        "albanian": "Rrini si në shtëpinë tuaj!",
        "english": "Please feel right at home!",
        "phonetic": "RREE-nee see nuh shte-PEEN TOO-ai!",
        "tip": "The quintessential Albanian hospitality greeting inviting guests to feel completely at ease.",
        "blocks": [
            {"text": "Rrini si", "type": "power"},
            {"text": "në shtëpinë tuaj", "type": "other"}
        ],
        "source_file": "audio/human/rrini-si-në-shtëpinë-tuaj.mp3",
        "lesson": {
            "background": "Warmly welcoming guests into your living room.",
            "answers": [
                {"id": "family-019-a1", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"},
                {"id": "family-019-a2", "albanian": "Ndihem shumë mirë këtu", "english": "I feel great here", "audio": "day/09"}
            ],
            "reply": {"id": "family-019-r", "albanian": "Ndihem shumë mirë këtu", "english": "I feel great here", "audio": "day/09"}
        }
    },
    {
        "id": "family-020",
        "island": "Family & Warmth",
        "albanian": "Ajo dëgjon muzikë, kur bën detyrat e shtëpisë.",
        "english": "She listens to music while doing housework.",
        "phonetic": "ah-YOH dehg-YOHN moo-ZEEK, koor buhn deh-TEE-raht eh shte-PEES",
        "tip": "Describing household routines and family habits.",
        "blocks": [
            {"text": "Ajo dëgjon muzikë", "type": "verb"},
            {"text": "kur bën detyrat e shtëpisë", "type": "other"}
        ],
        "source_file": "audio/human/ajo-dëgjon-muzikë-kur-bën-detyrat-e-shtëpisë.mp3",
        "lesson": {
            "background": "Talking about how chores get done around the house.",
            "answers": [
                {"id": "family-020-a1", "albanian": "Është një ide e mirë", "english": "It is a good idea", "audio": "day/49"},
                {"id": "family-020-a2", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"}
            ],
            "reply": {"id": "family-020-r", "albanian": "Është një ide e mirë", "english": "It is a good idea", "audio": "day/49"}
        }
    },
    {
        "id": "family-021",
        "island": "Family & Warmth",
        "albanian": "Ai nuk erdhi, sepse nuk kishte dëshirë.",
        "english": "He didn't come because he didn't feel like it.",
        "phonetic": "ai nook EHR-dhee, sehp-SEH nook KEESH-teh duh-SHEER",
        "tip": "Past tense with 'sepse' (because). 'Dëshirë' drops final -ë to sound like duh-SHEER.",
        "blocks": [
            {"text": "Ai nuk erdhi", "type": "verb"},
            {"text": "sepse nuk kishte dëshirë", "type": "other"}
        ],
        "source_file": "audio/human/ai-nuk-erdhi-sepse-nuk-kishte-dëshirë.mp3",
        "lesson": {
            "background": "Casual family gossip about why someone missed a family gathering.",
            "answers": [
                {"id": "family-021-a1", "albanian": "Në rregull", "english": "All right", "audio": "day/16"},
                {"id": "family-021-a2", "albanian": "Nuk kuptoj", "english": "I don't understand", "audio": "day/16"}
            ],
            "reply": {"id": "family-021-r", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
        }
    },
    {
        "id": "family-022",
        "island": "Family & Warmth",
        "albanian": "Gjyshi ynë është sëmurë.",
        "english": "Our grandfather is ill.",
        "phonetic": "GYEE-shee EE-nuh UHSHT suh-MOOR",
        "tip": "Expressing concern about an elderly family member.",
        "blocks": [
            {"text": "Gjyshi ynë", "type": "power"},
            {"text": "është sëmurë", "type": "other"}
        ],
        "source_file": "audio/human/gjyshi-ynë-është-sëmurë.mp3",
        "lesson": {
            "background": "Sharing family health updates.",
            "answers": [
                {"id": "family-022-a1", "albanian": "Besoj se ai ka nevojë për mjek.", "english": "I think he needs a doctor", "audio": "day/66"},
                {"id": "family-022-a2", "albanian": "Faleminderit", "english": "Thank you", "audio": "food-001-a1"}
            ],
            "reply": {"id": "family-022-r", "albanian": "Besoj se ai ka nevojë për mjek.", "english": "I think he needs a doctor", "audio": "day/66"}
        }
    },

    # --- Plans & Weekend (10 cards: plans-012 .. plans-021) ---
    {
        "id": "plans-012",
        "island": "Plans & Weekend",
        "albanian": "Si është moti sot?",
        "english": "What is the weather like today?",
        "phonetic": "see UHSHT MOH-tee sot?",
        "tip": "The universal everyday conversation starter before leaving the house.",
        "blocks": [
            {"text": "Si është", "type": "power"},
            {"text": "moti sot", "type": "other"}
        ],
        "source_file": "audio/human/si-është-moti-sot.mp3",
        "lesson": {
            "background": "Checking the morning weather before heading out.",
            "answers": [
                {"id": "plans-012-a1", "albanian": "Sot është ngrohtë.", "english": "It is warm today", "audio": "day/73"},
                {"id": "plans-012-a2", "albanian": "Sot është ftohtë.", "english": "It is cold today", "audio": "day/72"}
            ],
            "reply": {"id": "plans-012-r", "albanian": "Sot është ngrohtë.", "english": "It is warm today", "audio": "day/73"}
        }
    },
    {
        "id": "plans-013",
        "island": "Plans & Weekend",
        "albanian": "Sot është ngrohtë.",
        "english": "It is warm today.",
        "phonetic": "sot UHSHT NGROHT",
        "tip": "Final -ë is dropped: NGROHT.",
        "blocks": [
            {"text": "Sot është", "type": "power"},
            {"text": "ngrohtë", "type": "other"}
        ],
        "source_file": "audio/human/sot-është-ngrohtë.mp3",
        "lesson": {
            "background": "Pleasant mild weather comment.",
            "answers": [
                {"id": "plans-013-a1", "albanian": "A dëshironi të dilni shëtitje?", "english": "Would you like to go for a walk?", "audio": "day/48"},
                {"id": "plans-013-a2", "albanian": "Është një ide e mirë", "english": "It is a good idea", "audio": "day/49"}
            ],
            "reply": {"id": "plans-013-r", "albanian": "A dëshironi të dilni shëtitje?", "english": "Would you like to go for a walk?", "audio": "day/48"}
        }
    },
    {
        "id": "plans-014",
        "island": "Plans & Weekend",
        "albanian": "Sot është ftohtë.",
        "english": "It is cold today.",
        "phonetic": "sot UHSHT FTOHT",
        "tip": "Final -ë is dropped: FTOHT.",
        "blocks": [
            {"text": "Sot është", "type": "power"},
            {"text": "ftohtë", "type": "other"}
        ],
        "source_file": "audio/human/sot-është-ftohtë.mp3",
        "lesson": {
            "background": "Suggesting jackets or staying indoors.",
            "answers": [
                {"id": "plans-014-a1", "albanian": "Po rri në shtëpi.", "english": "I'm staying at home", "audio": "day/55"},
                {"id": "plans-014-a2", "albanian": "Një çaj, të lutem!", "english": "A tea please!", "audio": "day/22"}
            ],
            "reply": {"id": "plans-014-r", "albanian": "Një çaj, të lutem!", "english": "A tea please!", "audio": "day/22"}
        }
    },
    {
        "id": "plans-015",
        "island": "Plans & Weekend",
        "albanian": "Bie shi.",
        "english": "It is raining.",
        "phonetic": "BEE-eh SHEE",
        "tip": "Short and direct: bie (falls) shi (rain).",
        "blocks": [
            {"text": "Bie", "type": "verb"},
            {"text": "shi", "type": "object"}
        ],
        "source_file": "audio/human/bie-shi.mp3",
        "lesson": {
            "background": "Looking out the window on a rainy day.",
            "answers": [
                {"id": "plans-015-a1", "albanian": "Dua të rri në shtëpi.", "english": "I want to stay home", "audio": "day/68"},
                {"id": "plans-015-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "plans-015-r", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
        }
    },
    {
        "id": "plans-016",
        "island": "Plans & Weekend",
        "albanian": "Është ditë me diell.",
        "english": "It is sunny.",
        "phonetic": "UHSHT DEET meh dee-EHL",
        "tip": "Literally 'it is day with sun'. Perfect day for a walk.",
        "blocks": [
            {"text": "Është ditë", "type": "power"},
            {"text": "me diell", "type": "other"}
        ],
        "source_file": "audio/human/është-ditë-me-diell.mp3",
        "lesson": {
            "background": "Inviting someone out on a sunny day.",
            "answers": [
                {"id": "plans-016-a1", "albanian": "A shkojmë në plazh?", "english": "Shall we go to the beach?", "audio": "day/50"},
                {"id": "plans-016-a2", "albanian": "Është një ide e mirë", "english": "It is a good idea", "audio": "day/49"}
            ],
            "reply": {"id": "plans-016-r", "albanian": "A shkojmë në plazh?", "english": "Shall we go to the beach?", "audio": "day/50"}
        }
    },
    {
        "id": "plans-017",
        "island": "Plans & Weekend",
        "albanian": "Dje isha në kinema.",
        "english": "I was at the cinema yesterday.",
        "phonetic": "DYEH EE-shah nuh kee-NEH-mah",
        "tip": "Simple past of 'jam' (to be): dje isha (yesterday I was).",
        "blocks": [
            {"text": "Dje isha", "type": "verb"},
            {"text": "në kinema", "type": "other"}
        ],
        "source_file": "audio/human/dje-isha-në-kinema.mp3",
        "lesson": {
            "background": "Sharing what you did yesterday with family or friends.",
            "answers": [
                {"id": "plans-017-a1", "albanian": "Kalova mirë me ty.", "english": "I had a lovely time", "audio": "day/71"},
                {"id": "plans-017-a2", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"}
            ],
            "reply": {"id": "plans-017-r", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"}
        }
    },
    {
        "id": "plans-018",
        "island": "Plans & Weekend",
        "albanian": "Dje ishte e shtunë.",
        "english": "Yesterday was Saturday.",
        "phonetic": "DYEH EESH-teh eh SHTOON",
        "tip": "Past tense: ishte (it was). Final -ë dropped in shtunë.",
        "blocks": [
            {"text": "Dje ishte", "type": "verb"},
            {"text": "e shtunë", "type": "other"}
        ],
        "source_file": "audio/human/dje-ishte-e-shtunë.mp3",
        "lesson": {
            "background": "Reminiscing about weekend plans.",
            "answers": [
                {"id": "plans-018-a1", "albanian": "Sot kemi kohë.", "english": "We have time today", "audio": "day/47"},
                {"id": "plans-018-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "plans-018-r", "albanian": "Sot kemi kohë.", "english": "We have time today", "audio": "day/47"}
        }
    },
    {
        "id": "plans-019",
        "island": "Plans & Weekend",
        "albanian": "Ku keni qenë?",
        "english": "Where were you?",
        "phonetic": "koo KEH-nee CHEHN?",
        "tip": "Present perfect question: keni qenë (have been).",
        "blocks": [
            {"text": "Ku keni", "type": "power"},
            {"text": "qenë", "type": "verb"}
        ],
        "source_file": "audio/human/ku-keni-qenë.mp3",
        "lesson": {
            "background": "Asking family members where they went during the afternoon.",
            "answers": [
                {"id": "plans-019-a1", "albanian": "Ne kemi ardhur për pushime.", "english": "We are on holiday", "audio": "day/08"},
                {"id": "plans-019-a2", "albanian": "Dua të shkoj në qendër.", "english": "I want to go to the city centre", "audio": "day/52"}
            ],
            "reply": {"id": "plans-019-r", "albanian": "Ne kemi ardhur për pushime.", "english": "We are on holiday", "audio": "day/08"}
        }
    },
    {
        "id": "plans-020",
        "island": "Plans & Weekend",
        "albanian": "Ku keni shkuar?",
        "english": "Where did you go?",
        "phonetic": "koo KEH-nee SHKOO-ahr?",
        "tip": "Past question with motion: keni shkuar (have gone).",
        "blocks": [
            {"text": "Ku keni", "type": "power"},
            {"text": "shkuar", "type": "verb"}
        ],
        "source_file": "audio/human/ku-keni-shkuar.mp3",
        "lesson": {
            "background": "Asking about someone's outing or day trip.",
            "answers": [
                {"id": "plans-020-a1", "albanian": "A shkojmë në plazh?", "english": "Shall we go to the beach?", "audio": "day/50"},
                {"id": "plans-020-a2", "albanian": "Dua të shkoj në qendër.", "english": "I want to go to the city centre", "audio": "day/52"}
            ],
            "reply": {"id": "plans-020-r", "albanian": "Dua të shkoj në qendër.", "english": "I want to go to the city centre", "audio": "day/52"}
        }
    },
    {
        "id": "plans-021",
        "island": "Plans & Weekend",
        "albanian": "Si keni fjetur?",
        "english": "How did you sleep?",
        "phonetic": "see KEH-nee FYEH-toor?",
        "tip": "Kind morning question to overnight guests or family members.",
        "blocks": [
            {"text": "Si keni", "type": "power"},
            {"text": "fjetur", "type": "verb"}
        ],
        "source_file": "audio/human/si-keni-fjetur.mp3",
        "lesson": {
            "background": "Polite morning question around breakfast.",
            "answers": [
                {"id": "plans-021-a1", "albanian": "Jam në rregull, faleminderit", "english": "I'm ok, thanks", "audio": "day/03"},
                {"id": "plans-021-a2", "albanian": "Unë jam i lodhur.", "english": "I am tired", "audio": "day/12"}
            ],
            "reply": {"id": "plans-021-r", "albanian": "Jam në rregull, faleminderit", "english": "I'm ok, thanks", "audio": "day/03"}
        }
    },

    # --- House & Hosts (10 cards: house-009 .. house-018) ---
    {
        "id": "house-009",
        "island": "House & Hosts",
        "albanian": "Sot pastrojmë shtëpinë.",
        "english": "We are cleaning the house today.",
        "phonetic": "sot pahs-TROI-muh shte-PEEN",
        "tip": "Weekend family chore announcement: pastrojmë (we clean).",
        "blocks": [
            {"text": "Sot pastrojmë", "type": "verb"},
            {"text": "shtëpinë", "type": "object"}
        ],
        "source_file": "audio/human/sot-pastrojmë-shtëpinë.mp3",
        "lesson": {
            "background": "Organizing weekend house chores.",
            "answers": [
                {"id": "house-009-a1", "albanian": "A mund të më ndihmoni?", "english": "Can you help me?", "audio": "day/29"},
                {"id": "house-009-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "house-009-r", "albanian": "A mund të më ndihmoni?", "english": "Can you help me?", "audio": "day/29"}
        }
    },
    {
        "id": "house-010",
        "island": "House & Hosts",
        "albanian": "Fëmijët pastrojnë dhomën.",
        "english": "The children are cleaning the room.",
        "phonetic": "fuh-MEE-yuht pahs-TROI-nuh DHOH-muhn",
        "tip": "Talking about kids helping with chores.",
        "blocks": [
            {"text": "Fëmijët pastrojnë", "type": "verb"},
            {"text": "dhomën", "type": "object"}
        ],
        "source_file": "audio/human/fëmijët-pastrojnë-dhomën.mp3",
        "lesson": {
            "background": "Family teamwork around the house.",
            "answers": [
                {"id": "house-010-a1", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"},
                {"id": "house-010-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
            ],
            "reply": {"id": "house-010-r", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"}
        }
    },
    {
        "id": "house-011",
        "island": "House & Hosts",
        "albanian": "Burri im lan makinën.",
        "english": "My husband is washing the car.",
        "phonetic": "BOOR-ree eem lahn mah-KEE-nuhn",
        "tip": "'Lan' means washes. Everyday family chore update.",
        "blocks": [
            {"text": "Burri im", "type": "power"},
            {"text": "lan makinën", "type": "verb"}
        ],
        "source_file": "audio/human/burri-im-lan-makinën.mp3",
        "lesson": {
            "background": "Outdoor household chores on a Saturday.",
            "answers": [
                {"id": "house-011-a1", "albanian": "Në rregull", "english": "All right", "audio": "day/16"},
                {"id": "house-011-a2", "albanian": "Faleminderit", "english": "Thank you", "audio": "food-001-a1"}
            ],
            "reply": {"id": "house-011-r", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
        }
    },
    {
        "id": "house-012",
        "island": "House & Hosts",
        "albanian": "Kush i lan enët?",
        "english": "Who does the dishes?",
        "phonetic": "koosh ee lahn EH-nuht?",
        "tip": "The universal post-dinner kitchen question!",
        "blocks": [
            {"text": "Kush i lan", "type": "verb"},
            {"text": "enët", "type": "object"}
        ],
        "source_file": "audio/human/kush-i-lan-enët.mp3",
        "lesson": {
            "background": "Deciding who does the kitchen dishes after dinner.",
            "answers": [
                {"id": "house-012-a1", "albanian": "A mund të më ndihmoni?", "english": "Can you help me?", "audio": "day/29"},
                {"id": "house-012-a2", "albanian": "Faleminderit për ndihmën tuaj!", "english": "Thank you for your help!", "audio": "day/69"}
            ],
            "reply": {"id": "house-012-r", "albanian": "Faleminderit për ndihmën tuaj!", "english": "Thank you for your help!", "audio": "day/69"}
        }
    },
    {
        "id": "house-013",
        "island": "House & Hosts",
        "albanian": "Kush i lan dritaret?",
        "english": "Who washes the windows?",
        "phonetic": "koosh ee lahn dree-TAH-ret?",
        "tip": "Asking who cleans the windows.",
        "blocks": [
            {"text": "Kush i lan", "type": "verb"},
            {"text": "dritaret", "type": "object"}
        ],
        "source_file": "audio/human/kush-i-lan-dritaret.mp3",
        "lesson": {
            "background": "Assigning cleaning tasks during spring cleaning.",
            "answers": [
                {"id": "house-013-a1", "albanian": "Dritaret janë të pista.", "english": "The windows are dirty", "audio": "day/46"},
                {"id": "house-013-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "house-013-r", "albanian": "Dritaret janë të pista.", "english": "The windows are dirty", "audio": "day/46"}
        }
    },
    {
        "id": "house-014",
        "island": "House & Hosts",
        "albanian": "Dritaret janë të pista.",
        "english": "The windows are dirty.",
        "phonetic": "dree-TAH-ret YAH-nuh tuh PEES-tah",
        "tip": "Notice the adjective agreement with feminine plural 'dritaret'.",
        "blocks": [
            {"text": "Dritaret janë", "type": "power"},
            {"text": "të pista", "type": "other"}
        ],
        "source_file": "audio/human/dritaret-janë-të-pista.mp3",
        "lesson": {
            "background": "Noticing that the house needs a wipe down.",
            "answers": [
                {"id": "house-014-a1", "albanian": "Sot pastrojmë shtëpinë.", "english": "We are cleaning the house today", "audio": "day/41"},
                {"id": "house-014-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "house-014-r", "albanian": "Sot pastrojmë shtëpinë.", "english": "We are cleaning the house today", "audio": "day/41"}
        }
    },
    {
        "id": "house-015",
        "island": "House & Hosts",
        "albanian": "Këtu janë gotat, pjatat dhe picetat.",
        "english": "Here are the glasses, plates and napkins.",
        "phonetic": "kuh-TOO YAH-nuh GOH-taht, PYAH-taht dheh pee-TSEH-taht",
        "tip": "Essential items for setting a friendly table.",
        "blocks": [
            {"text": "Këtu janë", "type": "power"},
            {"text": "gotat, pjatat dhe picetat", "type": "object"}
        ],
        "source_file": "audio/human/këtu-janë-gotat-pjatat-dhe-picetat.mp3",
        "lesson": {
            "background": "Handing out table items while helping hosts.",
            "answers": [
                {"id": "house-015-a1", "albanian": "Unë shtroj tavolinën.", "english": "I am setting the table", "audio": "day/28"},
                {"id": "house-015-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
            ],
            "reply": {"id": "house-015-r", "albanian": "Unë shtroj tavolinën.", "english": "I am setting the table", "audio": "day/28"}
        }
    },
    {
        "id": "house-016",
        "island": "House & Hosts",
        "albanian": "Këtu janë thikat, pirunjtë dhe lugët.",
        "english": "Here are the knives, forks and spoons.",
        "phonetic": "kuh-TOO YAH-nuh THEE-kaht, pee-ROON-yuht dheh LOO-guht",
        "tip": "Flatware cutlery vocabulary in Albanian: thikat, pirunjtë, lugët.",
        "blocks": [
            {"text": "Këtu janë", "type": "power"},
            {"text": "thikat, pirunjtë dhe lugët", "type": "object"}
        ],
        "source_file": "audio/human/këtu-janë-thikat-pirunjtë-dhe-lugët.mp3",
        "lesson": {
            "background": "Laying out utensils on the dinner table.",
            "answers": [
                {"id": "house-016-a1", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"},
                {"id": "house-016-a2", "albanian": "Asgjë!", "english": "You're welcome!", "audio": "day/27"}
            ],
            "reply": {"id": "house-016-r", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
        }
    },
    {
        "id": "house-017",
        "island": "House & Hosts",
        "albanian": "A ke hapëse shishesh?",
        "english": "Do you have a bottle opener?",
        "phonetic": "ah keh hah-POO-seh SHEE-shesh?",
        "tip": "Common kitchen request when drinks or refreshments arrive.",
        "blocks": [
            {"text": "A ke", "type": "power"},
            {"text": "hapëse shishesh", "type": "object"}
        ],
        "source_file": "audio/human/a-ke-hapëse-shishesh.mp3",
        "lesson": {
            "background": "Opening cold drinks for guests.",
            "answers": [
                {"id": "house-017-a1", "albanian": "po", "english": "Yes", "audio": "day/20"},
                {"id": "house-017-a2", "albanian": "Këtu është!", "english": "It's right here!", "audio": "day/59"}
            ],
            "reply": {"id": "house-017-r", "albanian": "Këtu është!", "english": "It's right here!", "audio": "day/59"}
        }
    },
    {
        "id": "house-018",
        "island": "House & Hosts",
        "albanian": "A ti pres qepët?",
        "english": "Shall I cut the onions?",
        "phonetic": "ah tee prehs KEH-puht?",
        "tip": "Courteous offer to help out with food prep in the kitchen.",
        "blocks": [
            {"text": "A ti pres", "type": "verb"},
            {"text": "qepët", "type": "object"}
        ],
        "source_file": "audio/human/a-ti-pres-qepët.mp3",
        "lesson": {
            "background": "Helping the host chop vegetables.",
            "answers": [
                {"id": "house-018-a1", "albanian": "Faleminderit për ndihmën tuaj!", "english": "Thank you for your help!", "audio": "day/69"},
                {"id": "house-018-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "house-018-r", "albanian": "Faleminderit për ndihmën tuaj!", "english": "Thank you for your help!", "audio": "day/69"}
        }
    },

    # --- Food & Eating (10 cards: food-015 .. food-024) ---
    {
        "id": "food-015",
        "island": "Food & Eating",
        "albanian": "A do përsëri supë?",
        "english": "Do you want some more soup?",
        "phonetic": "ah doh puhr-suh-REE SOOP?",
        "tip": "Offering a second helping of hot homemade soup.",
        "blocks": [
            {"text": "A do", "type": "power"},
            {"text": "përsëri supë", "type": "object"}
        ],
        "source_file": "audio/human/a-do-përsëri-supë.mp3",
        "lesson": {
            "background": "Generous hosts urging guests to have another bowl.",
            "answers": [
                {"id": "food-015-a1", "albanian": "Unë e kam ngrënë të gjithë ushqimin.", "english": "I ate all the food", "audio": "day/44"},
                {"id": "food-015-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
            ],
            "reply": {"id": "food-015-r", "albanian": "Unë e kam ngrënë të gjithë ushqimin.", "english": "I ate all the food", "audio": "day/44"}
        }
    },
    {
        "id": "food-016",
        "island": "Food & Eating",
        "albanian": "A keni uri?",
        "english": "Are you hungry?",
        "phonetic": "ah KEH-nee OO-ree?",
        "tip": "First thing every Albanian mother or grandmother asks when you enter the house!",
        "blocks": [
            {"text": "A keni", "type": "power"},
            {"text": "uri", "type": "object"}
        ],
        "source_file": "audio/human/a-keni-uri.mp3",
        "lesson": {
            "background": "Heartwarming question upon arriving at mealtime.",
            "answers": [
                {"id": "food-016-a1", "albanian": "po", "english": "Yes", "audio": "day/20"},
                {"id": "food-016-a2", "albanian": "Unë kam ngrënë.", "english": "I ate", "audio": "day/44"}
            ],
            "reply": {"id": "food-016-r", "albanian": "po", "english": "Yes", "audio": "day/20"}
        }
    },
    {
        "id": "food-017",
        "island": "Food & Eating",
        "albanian": "A ti qëroj patatet?",
        "english": "Shall I peel the potatoes?",
        "phonetic": "ah tee cheh-ROI pah-TAH-tet?",
        "tip": "Peeling potatoes ('qëroj') to prepare dinner with the family.",
        "blocks": [
            {"text": "A ti qëroj", "type": "verb"},
            {"text": "patatet", "type": "object"}
        ],
        "source_file": "audio/human/a-ti-qëroj-patatet.mp3",
        "lesson": {
            "background": "Offering practical help in the kitchen.",
            "answers": [
                {"id": "food-017-a1", "albanian": "Faleminderit për ndihmën tuaj!", "english": "Thank you for your help!", "audio": "day/69"},
                {"id": "food-017-a2", "albanian": "Në rregull", "english": "All right", "audio": "day/16"}
            ],
            "reply": {"id": "food-017-r", "albanian": "Faleminderit për ndihmën tuaj!", "english": "Thank you for your help!", "audio": "day/69"}
        }
    },
    {
        "id": "food-018",
        "island": "Food & Eating",
        "albanian": "Dua të blej fruta dhe perime.",
        "english": "I want to buy fruit and vegetables.",
        "phonetic": "DOO-ah tuh bley FROO-tah dheh peh-REE-meh",
        "tip": "Everyday shopping intent for fresh groceries at the corner store.",
        "blocks": [
            {"text": "Dua të blej", "type": "verb"},
            {"text": "fruta dhe perime", "type": "object"}
        ],
        "source_file": "audio/human/dua-të-blej-fruta-dhe-perime.mp3",
        "lesson": {
            "background": "Heading to the market to buy dinner ingredients.",
            "answers": [
                {"id": "food-018-a1", "albanian": "Ku është pazari?", "english": "Where is the market?", "audio": "day/83"},
                {"id": "food-018-a2", "albanian": "Është këtu!", "english": "It's right here!", "audio": "day/59"}
            ],
            "reply": {"id": "food-018-r", "albanian": "Ku është pazari?", "english": "Where is the market?", "audio": "day/83"}
        }
    },
    {
        "id": "food-019",
        "island": "Food & Eating",
        "albanian": "Dua një pjatancë me perime.",
        "english": "I'd like some mixed vegetables.",
        "phonetic": "DOO-ah nyuh pyah-TAHN-tsuh meh peh-REE-meh",
        "tip": "Ordering healthy sides or vegetable platters at a restaurant.",
        "blocks": [
            {"text": "Dua", "type": "power"},
            {"text": "një pjatancë me perime", "type": "object"}
        ],
        "source_file": "audio/human/dua-një-pjatancë-me-perime.mp3",
        "lesson": {
            "background": "Ordering sides at the dinner table.",
            "answers": [
                {"id": "food-019-a1", "albanian": "Kjo është një cilësi goxha e mirë.", "english": "This is very good quality", "audio": "day/41"},
                {"id": "food-019-a2", "albanian": "Faleminderit", "english": "Thank you", "audio": "food-001-a1"}
            ],
            "reply": {"id": "food-019-r", "albanian": "Kjo është një cilësi goxha e mirë.", "english": "This is very good quality", "audio": "day/41"}
        }
    },
    {
        "id": "food-020",
        "island": "Food & Eating",
        "albanian": "Dua fruta ose djathë.",
        "english": "I would like some fruit or cheese.",
        "phonetic": "DOO-ah FROO-tah OH-seh DYAHTH",
        "tip": "Healthy breakfast or dessert snack options. Final -ë dropped in djathë.",
        "blocks": [
            {"text": "Dua", "type": "power"},
            {"text": "fruta ose djathë", "type": "object"}
        ],
        "source_file": "audio/human/dua-fruta-ose-djathë.mp3",
        "lesson": {
            "background": "Choosing simple snacks after the main meal.",
            "answers": [
                {"id": "food-020-a1", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"},
                {"id": "food-020-a2", "albanian": "Urdhëroni menunë!", "english": "Here is the menu!", "audio": "day/33"}
            ],
            "reply": {"id": "food-020-r", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
        }
    },
    {
        "id": "food-021",
        "island": "Food & Eating",
        "albanian": "Çfarë ka për të pirë?",
        "english": "What is there to drink?",
        "phonetic": "chfah-ruh kah puhr tuh PEER?",
        "tip": "Asking what refreshments are available at the table.",
        "blocks": [
            {"text": "Çfarë ka", "type": "power"},
            {"text": "për të pirë", "type": "other"}
        ],
        "source_file": "audio/human/çfarë-ka-për-të-pirë.mp3",
        "lesson": {
            "background": "Asking what drinks are on offer.",
            "answers": [
                {"id": "food-021-a1", "albanian": "Ka ujë ose lëngje frutash.", "english": "There is water or fruit juices", "audio": "day/24"},
                {"id": "food-021-a2", "albanian": "Do të doja një ujë mineral.", "english": "I'd like a mineral water", "audio": "day/25"}
            ],
            "reply": {"id": "food-021-r", "albanian": "Ka ujë ose lëngje frutash.", "english": "There is water or fruit juices", "audio": "day/24"}
        }
    },
    {
        "id": "food-022",
        "island": "Food & Eating",
        "albanian": "Do të doja një ujë mineral.",
        "english": "I'd like a mineral water.",
        "phonetic": "doh tuh DOH-yah nyuh OO-yuh mee-neh-RAHL",
        "tip": "Polite ordering phrase with conditional 'do të doja'.",
        "blocks": [
            {"text": "Do të doja", "type": "power"},
            {"text": "një ujë mineral", "type": "object"}
        ],
        "source_file": "audio/human/do-të-doja-një-ujë-mineral.mp3",
        "lesson": {
            "background": "Requesting sparkling/mineral water at a restaurant or table.",
            "answers": [
                {"id": "food-022-a1", "albanian": "Urdhëroni!", "english": "Here you go!", "audio": "day/33"},
                {"id": "food-022-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
            ],
            "reply": {"id": "food-022-r", "albanian": "Urdhëroni!", "english": "Here you go!", "audio": "day/33"}
        }
    },
    {
        "id": "food-023",
        "island": "Food & Eating",
        "albanian": "Ka ujë ose lëngje frutash.",
        "english": "There is water or fruit juices.",
        "phonetic": "kah OO-yuh OH-seh LUHN-gyeh FROO-tahsh",
        "tip": "Informing guests of available non-alcoholic drinks.",
        "blocks": [
            {"text": "Ka", "type": "power"},
            {"text": "ujë ose lëngje frutash", "type": "object"}
        ],
        "source_file": "audio/human/ka-ujë-ose-lëngje-frutash.mp3",
        "lesson": {
            "background": "Listing drinks for guests.",
            "answers": [
                {"id": "food-023-a1", "albanian": "Ju lutem edhe një gotë ujë.", "english": "Another glass of water please", "audio": "day/25"},
                {"id": "food-023-a2", "albanian": "Faleminderit", "english": "Thank you", "audio": "food-001-a1"}
            ],
            "reply": {"id": "food-023-r", "albanian": "Ju lutem edhe një gotë ujë.", "english": "Another glass of water please", "audio": "day/25"}
        }
    },
    {
        "id": "food-024",
        "island": "Food & Eating",
        "albanian": "Unë kam ngrënë.",
        "english": "I ate.",
        "phonetic": "OO-nuh kahm NGRUHN",
        "tip": "Polite past-tense way to decline more food: kam ngrënë (I have eaten).",
        "blocks": [
            {"text": "Unë kam ngrënë", "type": "verb"}
        ],
        "source_file": "audio/human/unë-kam-ngrënë.mp3",
        "lesson": {
            "background": "Saying politely that you already had your meal.",
            "answers": [
                {"id": "food-024-a1", "albanian": "Ju bëftë mirë!", "english": "Enjoy your meal!", "audio": "day/41"},
                {"id": "food-024-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
            ],
            "reply": {"id": "food-024-r", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
        }
    },

    # --- Health & Feelings (10 cards: health-012 .. health-021) ---
    {
        "id": "health-012",
        "island": "Health & Feelings",
        "albanian": "A keni dhimbje?",
        "english": "Do you have any pain?",
        "phonetic": "ah KEH-nee DHEEMB-yeh?",
        "tip": "Caring inquiry when someone is not looking well.",
        "blocks": [
            {"text": "A keni", "type": "power"},
            {"text": "dhimbje", "type": "object"}
        ],
        "source_file": "audio/human/a-keni-dhimbje.mp3",
        "lesson": {
            "background": "Asking how someone is feeling when they are hurting.",
            "answers": [
                {"id": "health-012-a1", "albanian": "Kam shpesh dhimbje koke.", "english": "I often have headaches", "audio": "day/62"},
                {"id": "health-012-a2", "albanian": "Jam në rregull, faleminderit", "english": "I'm ok, thanks", "audio": "day/03"}
            ],
            "reply": {"id": "health-012-r", "albanian": "Kam shpesh dhimbje koke.", "english": "I often have headaches", "audio": "day/62"}
        }
    },
    {
        "id": "health-013",
        "island": "Health & Feelings",
        "albanian": "Kam shpesh dhimbje koke.",
        "english": "I often have headaches.",
        "phonetic": "kahm SHPESH DHEEMB-yeh KOH-keh",
        "tip": "Common everyday symptom: dhimbje koke (headache).",
        "blocks": [
            {"text": "Kam shpesh", "type": "power"},
            {"text": "dhimbje koke", "type": "object"}
        ],
        "source_file": "audio/human/kam-shpesh-dhimbje-koke.mp3",
        "lesson": {
            "background": "Explaining that you need a quiet rest or an aspirin.",
            "answers": [
                {"id": "health-013-a1", "albanian": "Duam të blejmë ilaçe.", "english": "We want to buy medicine", "audio": "day/68"},
                {"id": "health-013-a2", "albanian": "Unë dua të fle.", "english": "I want to sleep", "audio": "day/67"}
            ],
            "reply": {"id": "health-013-r", "albanian": "Duam të blejmë ilaçe.", "english": "We want to buy medicine", "audio": "day/68"}
        }
    },
    {
        "id": "health-014",
        "island": "Health & Feelings",
        "albanian": "Kam gjithmonë dhimbje kurrizi.",
        "english": "I always have back pain.",
        "phonetic": "kahm yeeth-MOHN DHEEMB-yeh koo-REE-zee",
        "tip": "Everyday physical complaint: kurriz (back).",
        "blocks": [
            {"text": "Kam gjithmonë", "type": "power"},
            {"text": "dhimbje kurrizi", "type": "object"}
        ],
        "source_file": "audio/human/kam-gjithmonë-dhimbje-kurrizi.mp3",
        "lesson": {
            "background": "Describing chronic back fatigue.",
            "answers": [
                {"id": "health-014-a1", "albanian": "Besoj se ai ka nevojë për mjek.", "english": "I think he needs a doctor", "audio": "day/66"},
                {"id": "health-014-a2", "albanian": "A mund të ulemi?", "english": "May we take a seat?", "audio": "day/15"}
            ],
            "reply": {"id": "health-014-r", "albanian": "A mund të ulemi?", "english": "May we take a seat?", "audio": "day/15"}
        }
    },
    {
        "id": "health-015",
        "island": "Health & Feelings",
        "albanian": "Ndonjë herë kam dhimbje barku.",
        "english": "I sometimes have stomach aches.",
        "phonetic": "ndoh-NYUH HEHR kahm DHEEMB-yeh BAHR-koo",
        "tip": "Describing an upset stomach: bark (stomach / belly).",
        "blocks": [
            {"text": "Ndonjë herë kam", "type": "power"},
            {"text": "dhimbje barku", "type": "object"}
        ],
        "source_file": "audio/human/ndonjë-herë-kam-dhimbje-barku.mp3",
        "lesson": {
            "background": "Describing stomach sensitivity after food.",
            "answers": [
                {"id": "health-015-a1", "albanian": "Një çaj, të lutem!", "english": "A tea please!", "audio": "day/22"},
                {"id": "health-015-a2", "albanian": "Duam të blejmë ilaçe.", "english": "We want to buy medicine", "audio": "day/68"}
            ],
            "reply": {"id": "health-015-r", "albanian": "Një çaj, të lutem!", "english": "A tea please!", "audio": "day/22"}
        }
    },
    {
        "id": "health-016",
        "island": "Health & Feelings",
        "albanian": "Duam të blejmë ilaçe.",
        "english": "We want to buy medicine.",
        "phonetic": "DOO-ahm tuh bley-muh ee-LAH-cheh",
        "tip": "Plural 'duam' (we want). Medicine in Albanian: ilaçe.",
        "blocks": [
            {"text": "Duam të blejmë", "type": "verb"},
            {"text": "ilaçe", "type": "object"}
        ],
        "source_file": "audio/human/duam-të-blejmë-ilaçe.mp3",
        "lesson": {
            "background": "Heading out to the local chemist.",
            "answers": [
                {"id": "health-016-a1", "albanian": "Ku gjendet farmacia më e afërt?", "english": "Where is the nearest pharmacy?", "audio": "day/67"},
                {"id": "health-016-a2", "albanian": "Është drejt", "english": "It's straight on", "audio": "day/57"}
            ],
            "reply": {"id": "health-016-r", "albanian": "Ku gjendet farmacia më e afërt?", "english": "Where is the nearest pharmacy?", "audio": "day/67"}
        }
    },
    {
        "id": "health-017",
        "island": "Health & Feelings",
        "albanian": "Ne kërkojmë një farmaci për të blerë ilaçe.",
        "english": "We're looking for a pharmacy to buy medicine.",
        "phonetic": "neh kuhr-KOI-muh nyuh fahr-mah-TSEE puhr tuh BLEHR ee-LAH-cheh",
        "tip": "Full natural sentence when asking locals on the street for directions to a pharmacy.",
        "blocks": [
            {"text": "Ne kërkojmë", "type": "verb"},
            {"text": "një farmaci", "type": "object"},
            {"text": "për të blerë ilaçe", "type": "other"}
        ],
        "source_file": "audio/human/ne-kërkojmë-një-farmaci-për-të-blerë-ilaçe.mp3",
        "lesson": {
            "background": "Asking neighbors where the nearest drugstore is located.",
            "answers": [
                {"id": "health-017-a1", "albanian": "Është drejt", "english": "It's straight on", "audio": "day/57"},
                {"id": "health-017-a2", "albanian": "Është këtu!", "english": "It's right here!", "audio": "day/59"}
            ],
            "reply": {"id": "health-017-r", "albanian": "Është drejt", "english": "It's straight on", "audio": "day/57"}
        }
    },
    {
        "id": "health-018",
        "island": "Health & Feelings",
        "albanian": "Ku gjendet farmacia më e afërt?",
        "english": "Where is the nearest pharmacy?",
        "phonetic": "koo DYEHN-det fahr-mah-TSEE-ah muh eh AH-fuhrt?",
        "tip": "Superlative pattern: më e afërt (nearest).",
        "blocks": [
            {"text": "Ku gjendet", "type": "power"},
            {"text": "farmacia më e afërt", "type": "object"}
        ],
        "source_file": "audio/human/ku-gjendet-farmacia-më-e-afërt.mp3",
        "lesson": {
            "background": "Urgent question when needing pain relief or medicine.",
            "answers": [
                {"id": "health-018-a1", "albanian": "Është drejt", "english": "It's straight on", "audio": "day/57"},
                {"id": "health-018-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
            ],
            "reply": {"id": "health-018-r", "albanian": "Është drejt", "english": "It's straight on", "audio": "day/57"}
        }
    },
    {
        "id": "health-019",
        "island": "Health & Feelings",
        "albanian": "A të duhej të thërrisje mjekun?",
        "english": "Did you have to call the doctor?",
        "phonetic": "ah tuh DOO-hey tuh thuhr-REES-yeh MYEH-koon?",
        "tip": "Asking if medical intervention was necessary.",
        "blocks": [
            {"text": "A të duhej", "type": "power"},
            {"text": "të thërrisje mjekun", "type": "verb"}
        ],
        "source_file": "audio/human/a-të-duhej-të-thërrisje-mjekun.mp3",
        "lesson": {
            "background": "Checking in on a sick relative's condition.",
            "answers": [
                {"id": "health-019-a1", "albanian": "Besoj se ai ka nevojë për mjek.", "english": "I think he needs a doctor", "audio": "day/66"},
                {"id": "health-019-a2", "albanian": "Jam në rregull, faleminderit", "english": "I'm ok, thanks", "audio": "day/03"}
            ],
            "reply": {"id": "health-019-r", "albanian": "Besoj se ai ka nevojë për mjek.", "english": "I think he needs a doctor", "audio": "day/66"}
        }
    },
    {
        "id": "health-020",
        "island": "Health & Feelings",
        "albanian": "Besoj se ai ka nevojë për mjek.",
        "english": "I think he needs a doctor.",
        "phonetic": "beh-ZOI seh ai kah neh-VOI puhr MYEK",
        "tip": "'Ka nevojë për' means 'needs'. 'Mjek' drops final sounds to MYEK.",
        "blocks": [
            {"text": "Besoj se", "type": "power"},
            {"text": "ai ka nevojë", "type": "verb"},
            {"text": "për mjek", "type": "object"}
        ],
        "source_file": "audio/human/besoj-se-ai-ka-nevojë-për-mjek.mp3",
        "lesson": {
            "background": "Advising someone to get checked out by a physician.",
            "answers": [
                {"id": "health-020-a1", "albanian": "Kam takim te mjeku.", "english": "I have a doctor's appointment", "audio": "day/70"},
                {"id": "health-020-a2", "albanian": "Faleminderit për ndihmën tuaj!", "english": "Thank you for your help!", "audio": "day/69"}
            ],
            "reply": {"id": "health-020-r", "albanian": "Kam takim te mjeku.", "english": "I have a doctor's appointment", "audio": "day/70"}
        }
    },
    {
        "id": "health-021",
        "island": "Health & Feelings",
        "albanian": "Kam takim te mjeku.",
        "english": "I have a doctor's appointment.",
        "phonetic": "kahm tah-KEEM teh MYEH-koo",
        "tip": "'Takim' means meeting or appointment.",
        "blocks": [
            {"text": "Kam takim", "type": "power"},
            {"text": "te mjeku", "type": "other"}
        ],
        "source_file": "audio/human/kam-takim-te-mjeku.mp3",
        "lesson": {
            "background": "Explaining where you are going during the day.",
            "answers": [
                {"id": "health-021-a1", "albanian": "Shumë mirë!", "english": "Very good!", "audio": "greet-001-r"},
                {"id": "health-021-a2", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
            ],
            "reply": {"id": "health-021-r", "albanian": "Faleminderit shumë.", "english": "Thank you very much", "audio": "day/06"}
        }
    }
]

# 3. Define the 10 Real-Life Family Scenes (10 scenes x 10 turns = 100 turns)
REAL_LIFE_SCENES = [
    {
        "id": "scene-01",
        "title": "Scene 1: At the Front Door",
        "island": "Greetings & Check-ins",
        "turns": [
            {"who": "anila", "sq": "Mirëdita!", "en": "Hello!", "audio": "day/01", "src": "audio/human/mirëdita.mp3"},
            {"who": "ilir", "sq": "Mirëdita. Si je?", "en": "Hello. How are you?", "audio": "day/02", "src": "audio/human/mirëdita-si-je.mp3"},
            {"who": "anila", "sq": "Jam në rregull, faleminderit", "en": "I'm ok, thanks.", "audio": "day/03", "src": "audio/human/jam-në-rregull-faleminderit.mp3"},
            {"who": "ilir", "sq": "Edhe unë", "en": "Me too.", "audio": "day/04", "src": "audio/human/edhe-unë.mp3"},
            {"who": "anila", "sq": "Mirë se vini!", "en": "Welcome!", "audio": "day/05", "src": "audio/human/mirë-se-vini.mp3"},
            {"who": "ilir", "sq": "Faleminderit shumë.", "en": "Thank you very much.", "audio": "day/06", "src": "audio/human/faleminderit-shumë.mp3"},
            {"who": "anila", "sq": "Po ti, a jeton këtu?", "en": "And you, do you live here?", "audio": "day/07", "src": "audio/human/po-ti-a-jeton-këtu.mp3"},
            {"who": "ilir", "sq": "Ne kemi ardhur për pushime.", "en": "We are on holiday.", "audio": "day/08", "src": "audio/human/ne-kemi-ardhur-për-pushime.mp3"},
            {"who": "anila", "sq": "Ndihem shumë mirë këtu", "en": "I feel great here.", "audio": "day/09", "src": "audio/human/ndihem-shumë-mirë-këtu.mp3"},
            {"who": "ilir", "sq": "Edhe unë. U gëzova që të takova.", "en": "Me too, it was a pleasure to meet you.", "audio": "day/10", "src": "audio/human/edhe-unë-u-gëzova-që-të-takova.mp3"}
        ]
    },
    {
        "id": "scene-02",
        "title": "Scene 2: Slow Down, I'm Learning!",
        "island": "Conversation Repair",
        "turns": [
            {"who": "anila", "sq": "Flet shqip?", "en": "Do you speak Albanian?", "audio": "day/11", "src": "audio/human/flet-shqip.mp3"},
            {"who": "ilir", "sq": "Jo, unë nuk flas shqip.", "en": "No, I don't speak Albanian.", "audio": "day/12", "src": "audio/human/jo-unë-nuk-flas-shqip.mp3"},
            {"who": "anila", "sq": "Mund t'i kuptoj mirë.", "en": "I can understand them well.", "audio": "day/13", "src": "audio/human/mund-t-i-kuptoj-mirë.mp3"},
            {"who": "ilir", "sq": "Mund të flasësh pak më me ngadalë, të lutem?", "en": "Could you talk a bit more slowly, please?", "audio": "day/14", "src": "audio/human/mund-të-flasësh-pak-më-me-ngadalë-të-lutem.mp3"},
            {"who": "anila", "sq": "Ju keni një nuancë në shqiptim.", "en": "You only have a slight accent.", "audio": "day/15", "src": "audio/human/ju-keni-një-nuancë-në-shqiptim.mp3"},
            {"who": "ilir", "sq": "Nuk e kuptoj fjalën.", "en": "I don't understand the word.", "audio": "day/16", "src": "audio/human/nuk-e-kuptoj-fjalën.mp3"},
            {"who": "anila", "sq": "Shqiptimi juaj është mjaft i mirë.", "en": "Your pronunciation is very good.", "audio": "day/17", "src": "audio/human/shqiptimi-juaj-është-mjaft-i-mirë.mp3"},
            {"who": "ilir", "sq": "Po, e kuptoj mirë.", "en": "Yes, I understand well.", "audio": "day/18", "src": "audio/human/po-e-kuptoj-mirë.mp3"},
            {"who": "ilir", "sq": "Faleminderit shumë.", "en": "Thank you very much.", "audio": "day/19", "src": "audio/human/faleminderit-shumë.mp3"},
            {"who": "anila", "sq": "Asgjë!", "en": "You're welcome!", "audio": "day/20", "src": "audio/human/asgjë.mp3"}
        ]
    },
    {
        "id": "scene-03",
        "title": "Scene 3: Morning Coffee & Tea",
        "island": "Coffee & Table",
        "turns": [
            {"who": "anila", "sq": "A mund të ulemi?", "en": "May we take a seat?", "audio": "day/21", "src": "audio/human/a-mund-të-ulemi.mp3"},
            {"who": "ilir", "sq": "Në rregull", "en": "All right.", "audio": "day/22", "src": "audio/human/në-rregull.mp3"},
            {"who": "anila", "sq": "A dëshironi një kafe?", "en": "Would you like a coffee?", "audio": "day/23", "src": "audio/human/a-dëshironi-një-kafe.mp3"},
            {"who": "ilir", "sq": "Do të doja një kafe me qumësht.", "en": "I'd like a coffee with milk.", "audio": "day/24", "src": "audio/human/do-të-doja-një-kafe-me-qumësht.mp3"},
            {"who": "anila", "sq": "A e pi kafenë me sheqer?", "en": "Do you drink coffee with sugar?", "audio": "day/25", "src": "audio/human/a-e-pi-kafenë-me-sheqer.mp3"},
            {"who": "ilir", "sq": "po", "en": "Yes.", "audio": "day/26", "src": "audio/human/po.mp3"},
            {"who": "anila", "sq": "Apo ju pëlqen më shumë një çaj?", "en": "Or do you prefer a tea?", "audio": "day/27", "src": "audio/human/apo-ju-pëlqen-më-shumë-një-çaj.mp3"},
            {"who": "ilir", "sq": "Një çaj, të lutem!", "en": "A tea please!", "audio": "day/28", "src": "audio/human/një-çaj-të-lutem.mp3"},
            {"who": "anila", "sq": "Ju lutem edhe një gotë ujë.", "en": "Another glass of water, please.", "audio": "day/29", "src": "audio/human/ju-lutem-edhe-një-gotë-ujë.mp3"},
            {"who": "ilir", "sq": "Faleminderit shumë.", "en": "Thank you very much.", "audio": "day/30", "src": "audio/human/faleminderit-shumë.mp3"}
        ]
    },
    {
        "id": "scene-04",
        "title": "Scene 4: The Dinner Table & Second Helping",
        "island": "Food & Eating",
        "turns": [
            {"who": "anila", "sq": "Çfarë dëshiron të hash? Mish apo peshk?", "en": "What do you prefer to eat? Meat or fish?", "audio": "day/31", "src": "audio/human/çfarë-dëshiron-të-hash-mish-apo-peshk.mp3"},
            {"who": "ilir", "sq": "Unë do marr peshk", "en": "I'll have fish.", "audio": "day/32", "src": "audio/human/unë-do-marr-peshk.mp3"},
            {"who": "anila", "sq": "Bukë të thekur me sallam dhe djathë?", "en": "Toast with sausage and cheese?", "audio": "day/33", "src": "audio/human/bukë-të-thekur-me-sallam-dhe-djathë.mp3"},
            {"who": "ilir", "sq": "Kjo është një cilësi goxha e mirë.", "en": "This is very good quality.", "audio": "day/34", "src": "audio/human/kjo-është-një-cilësi-goxha-e-mirë.mp3"},
            {"who": "ilir", "sq": "gëzuar", "en": "Cheers!", "audio": "day/35", "src": "audio/human/gëzuar.mp3"},
            {"who": "anila", "sq": "gëzuar", "en": "Cheers!", "audio": "day/36", "src": "audio/human/gëzuar.mp3"},
            {"who": "anila", "sq": "A do përsëri supë?", "en": "Do you want some more soup?", "audio": "day/37", "src": "audio/human/a-do-përsëri-supë.mp3"},
            {"who": "ilir", "sq": "Unë e kam ngrënë të gjithë ushqimin.", "en": "I ate all the food.", "audio": "day/38", "src": "audio/human/unë-e-kam-ngrënë-të-gjithë-ushqimin.mp3"},
            {"who": "anila", "sq": "Paguaj unë", "en": "It's on me.", "audio": "day/39", "src": "audio/human/paguaj-unë.mp3"},
            {"who": "ilir", "sq": "Faleminderit shumë.", "en": "Thank you very much.", "audio": "day/40", "src": "audio/human/faleminderit-shumë.mp3"}
        ]
    },
    {
        "id": "scene-05",
        "title": "Scene 5: Helping Around the House",
        "island": "House & Hosts",
        "turns": [
            {"who": "anila", "sq": "Sot pastrojmë shtëpinë.", "en": "We are cleaning the house today.", "audio": "day/41", "src": "audio/human/sot-pastrojmë-shtëpinë.mp3"},
            {"who": "ilir", "sq": "A mund të më ndihmoni?", "en": "Can you help me?", "audio": "day/42", "src": "audio/human/a-mund-të-më-ndihmoni.mp3"},
            {"who": "anila", "sq": "Mund të më ndihmoni, ju lutem?", "en": "Can you help me, please?", "audio": "day/43", "src": "audio/human/mund-të-më-ndihmoni-ju-lutem.mp3"},
            {"who": "ilir", "sq": "Unë shtroj tavolinën.", "en": "I am setting the table.", "audio": "day/44", "src": "audio/human/unë-shtroj-tavolinën.mp3"},
            {"who": "anila", "sq": "Ku jane gotat?", "en": "Where are the glasses?", "audio": "day/45", "src": "audio/human/ku-jane-gotat.mp3"},
            {"who": "ilir", "sq": "Këtu janë gotat, pjatat dhe picetat.", "en": "Here are the glasses, the plates and the napkins.", "audio": "day/46", "src": "audio/human/këtu-janë-gotat-pjatat-dhe-picetat.mp3"},
            {"who": "anila", "sq": "Këtu janë thikat, pirunjtë dhe lugët.", "en": "Here are the knives, the forks and the spoons.", "audio": "day/47", "src": "audio/human/këtu-janë-thikat-pirunjtë-dhe-lugët.mp3"},
            {"who": "ilir", "sq": "Kush i lan enët?", "en": "Who does the dishes?", "audio": "day/48", "src": "audio/human/kush-i-lan-enët.mp3"},
            {"who": "anila", "sq": "Faleminderit për ndihmën tuaj!", "en": "Thank you for your help!", "audio": "day/49", "src": "audio/human/faleminderit-për-ndihmën-tuaj.mp3"},
            {"who": "ilir", "sq": "Asgjë!", "en": "You're welcome!", "audio": "day/50", "src": "audio/human/asgjë.mp3"}
        ]
    },
    {
        "id": "scene-06",
        "title": "Scene 6: After a Workday & Family Check-in",
        "island": "Family & Warmth",
        "turns": [
            {"who": "anila", "sq": "Kur kthehesh në shtëpi?", "en": "When will you come home?", "audio": "day/51", "src": "audio/human/kur-kthehesh-në-shtëpi.mp3"},
            {"who": "ilir", "sq": "Unë punoj në zyrë.", "en": "I work at an office.", "audio": "day/52", "src": "audio/human/unë-punoj-në-zyrë.mp3"},
            {"who": "ilir", "sq": "Kam punuar gjithë ditën.", "en": "I worked all day long.", "audio": "day/53", "src": "audio/human/kam-punuar-gjithë-ditën.mp3"},
            {"who": "anila", "sq": "Unë jam i lodhur.", "en": "I am tired.", "audio": "day/54", "src": "audio/human/unë-jam-i-lodhur.mp3"},
            {"who": "anila", "sq": "Po rri në shtëpi.", "en": "I’m staying at home.", "audio": "day/55", "src": "audio/human/po-rri-në-shtëpi.mp3"},
            {"who": "ilir", "sq": "Rrini si në shtëpinë tuaj!", "en": "Please, feel right at home!", "audio": "day/56", "src": "audio/human/rrini-si-në-shtëpinë-tuaj.mp3"},
            {"who": "anila", "sq": "Ne jemi një familje.", "en": "We are a family.", "audio": "day/57", "src": "audio/human/ne-jemi-një-familje.mp3"},
            {"who": "ilir", "sq": "Faleminderit për ndihmën tuaj!", "en": "Thank you for your help!", "audio": "day/58", "src": "audio/human/faleminderit-për-ndihmën-tuaj.mp3"},
            {"who": "anila", "sq": "Kalova mirë me ty.", "en": "I had a lovely time.", "audio": "day/59", "src": "audio/human/kalova-mirë-me-ty.mp3"},
            {"who": "ilir", "sq": "Edhe unë", "en": "Me too.", "audio": "day/60", "src": "audio/human/edhe-unë.mp3"}
        ]
    },
    {
        "id": "scene-07",
        "title": "Scene 7: Checking on Health & Comfort",
        "island": "Health & Feelings",
        "turns": [
            {"who": "anila", "sq": "A keni dhimbje?", "en": "Do you have any pain?", "audio": "day/61", "src": "audio/human/a-keni-dhimbje.mp3"},
            {"who": "ilir", "sq": "Kam shpesh dhimbje koke.", "en": "I often have headaches.", "audio": "day/62", "src": "audio/human/kam-shpesh-dhimbje-koke.mp3"},
            {"who": "anila", "sq": "Ai nuk është vetëm i lodhur por edhe i sëmurë.", "en": "He is not only tired, but also ill.", "audio": "day/63", "src": "audio/human/ai-nuk-është-vetëm-i-lodhur-por-edhe-i-sëmurë.mp3"},
            {"who": "ilir", "sq": "Ndonjë herë kam dhimbje barku.", "en": "I sometimes have stomach aches.", "audio": "day/64", "src": "audio/human/ndonjë-herë-kam-dhimbje-barku.mp3"},
            {"who": "anila", "sq": "A të duhej të thërrisje mjekun?", "en": "Did you have to call the doctor?", "audio": "day/65", "src": "audio/human/a-të-duhej-të-thërrisje-mjekun.mp3"},
            {"who": "ilir", "sq": "Besoj se ai ka nevojë për mjek.", "en": "I think he needs a doctor.", "audio": "day/66", "src": "audio/human/besoj-se-ai-ka-nevojë-për-mjek.mp3"},
            {"who": "anila", "sq": "Ku gjendet farmacia më e afërt?", "en": "Where is the nearest pharmacy?", "audio": "day/67", "src": "audio/human/ku-gjendet-farmacia-më-e-afërt.mp3"},
            {"who": "ilir", "sq": "Ne kërkojmë një farmaci për të blerë ilaçe.", "en": "We’re looking for a drugstore to buy medicine.", "audio": "day/68", "src": "audio/human/ne-kërkojmë-një-farmaci-për-të-blerë-ilaçe.mp3"},
            {"who": "anila", "sq": "Po ju jap një recetë për në farmaci.", "en": "I am giving you a prescription for the pharmacy.", "audio": "day/69", "src": "audio/human/po-ju-jap-një-recetë-për-në-farmaci.mp3"},
            {"who": "ilir", "sq": "Faleminderit shumë.", "en": "Thank you very much.", "audio": "day/70", "src": "audio/human/faleminderit-shumë.mp3"}
        ]
    },
    {
        "id": "scene-08",
        "title": "Scene 8: Making Weekend Plans",
        "island": "Plans & Weekend",
        "turns": [
            {"who": "anila", "sq": "Sot kemi kohë.", "en": "We have time today.", "audio": "day/71", "src": "audio/human/sot-kemi-kohë.mp3"},
            {"who": "ilir", "sq": "A dëshironi të dilni shëtitje?", "en": "Would you like to go for a walk?", "audio": "day/72", "src": "audio/human/a-dëshironi-të-dilni-shëtitje.mp3"},
            {"who": "anila", "sq": "Është një ide e mirë", "en": "It is a good idea.", "audio": "day/73", "src": "audio/human/është-një-ide-e-mirë.mp3"},
            {"who": "ilir", "sq": "A shkojmë në plazh?", "en": "Shall we go to the beach?", "audio": "day/74", "src": "audio/human/a-shkojmë-në-plazh.mp3"},
            {"who": "anila", "sq": "Ku doni të shkoni?", "en": "Where would you like to go?", "audio": "day/75", "src": "audio/human/ku-doni-të-shkoni.mp3"},
            {"who": "ilir", "sq": "Dua të shkoj në qendër.", "en": "I would like to go to the city centre.", "audio": "day/76", "src": "audio/human/dua-të-shkoj-në-qendër.mp3"},
            {"who": "anila", "sq": "Cili autobus shkon në qendër?", "en": "Which bus goes to the city centre?", "audio": "day/77", "src": "audio/human/cili-autobus-shkon-në-qendër.mp3"},
            {"who": "ilir", "sq": "Autobusi tjetër vjen për 15 minuta.", "en": "The next bus is in 15 minutes.", "audio": "day/78", "src": "audio/human/autobusi-tjetër-vjen-për-15-minuta.mp3"},
            {"who": "anila", "sq": "Ku është stacioni i autobusit?", "en": "Where is the bus stop?", "audio": "day/79", "src": "audio/human/ku-është-stacioni-i-autobusit.mp3"},
            {"who": "ilir", "sq": "Është drejt", "en": "It's straight on.", "audio": "day/80", "src": "audio/human/është-drejt.mp3"}
        ]
    },
    {
        "id": "scene-09",
        "title": "Scene 9: Quick Trip to the Market",
        "island": "Shopping",
        "turns": [
            {"who": "anila", "sq": "A shkojmë në një qendër tregtare?", "en": "Shall we go to the department store?", "audio": "day/81", "src": "audio/human/a-shkojmë-në-një-qendër-tregtare.mp3"},
            {"who": "ilir", "sq": "Dua të blej fruta dhe perime.", "en": "I want to buy fruit and vegetables.", "audio": "day/82", "src": "audio/human/dua-të-blej-fruta-dhe-perime.mp3"},
            {"who": "anila", "sq": "Ku është pazari?", "en": "Where is the market?", "audio": "day/83", "src": "audio/human/ku-është-pazari.mp3"},
            {"who": "ilir", "sq": "A është i hapur pazari të dielave?", "en": "Is the market open on Sundays?", "audio": "day/84", "src": "audio/human/a-është-i-hapur-pazari-të-dielave.mp3"},
            {"who": "anila", "sq": "Çfarë perimesh keni?", "en": "What vegetables do you have?", "audio": "day/85", "src": "audio/human/çfarë-perimesh-keni.mp3"},
            {"who": "ilir", "sq": "Sa kushton, ju lutem?", "en": "How much is it?", "audio": "day/86", "src": "audio/human/sa-kushton-ju-lutem.mp3"},
            {"who": "anila", "sq": "Njëqind", "en": "One hundred.", "audio": "day/87", "src": "audio/human/njëqind.mp3"},
            {"who": "ilir", "sq": "A mund të paguaj me kartë krediti?", "en": "May one pay by credit card?", "audio": "day/88", "src": "audio/human/a-mund-të-paguaj-me-kartë-krediti.mp3"},
            {"who": "anila", "sq": "A mund të paguaj edhe me lekë në dorë?", "en": "May one also pay in cash?", "audio": "day/89", "src": "audio/human/a-mund-të-paguaj-edhe-me-lekë-në-dorë.mp3"},
            {"who": "ilir", "sq": "po", "en": "Yes.", "audio": "day/90", "src": "audio/human/po.mp3"}
        ]
    },
    {
        "id": "scene-10",
        "title": "Scene 10: Warm Goodbyes at the Door",
        "island": "Family & Warmth",
        "turns": [
            {"who": "anila", "sq": "Është ora tetë.", "en": "It is eight o'clock.", "audio": "day/91", "src": "audio/human/është-ora-tetë.mp3"},
            {"who": "ilir", "sq": "Është vonë tashmë.", "en": "It is already late.", "audio": "day/92", "src": "audio/human/është-vonë-tashmë.mp3"},
            {"who": "anila", "sq": "Unë dua të fle.", "en": "I want to sleep.", "audio": "day/93", "src": "audio/human/unë-dua-të-fle.mp3"},
            {"who": "ilir", "sq": "Dua të shkoj në shtëpi.", "en": "I want to go home.", "audio": "day/94", "src": "audio/human/dua-të-shkoj-në-shtëpi.mp3"},
            {"who": "anila", "sq": "Shkofshi shëndoshë e mirë në shtëpi!", "en": "Hope you arrive home safely!", "audio": "day/95", "src": "audio/human/shkofshi-shëndoshë-e-mirë-në-shtëpi.mp3"},
            {"who": "ilir", "sq": "Faleminderit shumë.", "en": "Thank you very much.", "audio": "day/96", "src": "audio/human/faleminderit-shumë.mp3"},
            {"who": "anila", "sq": "A do të shihemi nesër?", "en": "Shall we see each other tomorrow?", "audio": "day/97", "src": "audio/human/a-do-të-shihemi-nesër.mp3"},
            {"who": "ilir", "sq": "Shihemi nesër!", "en": "See you tomorrow!", "audio": "day/98", "src": "audio/human/shihemi-nesër.mp3"},
            {"who": "anila", "sq": "Natën e mirë", "en": "Good night.", "audio": "day/99", "src": "audio/human/natën-e-mirë.mp3"},
            {"who": "ilir", "sq": "mirupafshim", "en": "Goodbye.", "audio": "day/100", "src": "audio/human/mirupafshim--dori.mp3"}
        ]
    }
]

def main():
    print("=== Step 1: Copy Card Audio Files ===")
    os.makedirs(os.path.join(ROOT, 'audio'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'audio', 'words'), exist_ok=True)
    os.makedirs(os.path.join(ROOT, 'audio', 'day'), exist_ok=True)

    # Load existing sources.js
    sources_text = read_text('sources.js')
    m = re.search(r'window\.ShqipSources\s*=\s*(\{[\s\S]*\});?\s*$', sources_text)
    sources_obj = json.loads(m.group(1))
    reg = sources_obj.setdefault('cardAudio', {})

    for card in NEW_CARDS:
        src_path = os.path.join(ROOT, card['source_file'])
        dst_name = f"{card['id']}.mp3"
        dst_path = os.path.join(ROOT, 'audio', dst_name)
        shutil.copyfile(src_path, dst_path)

        meta = corpus_by_path.get(card['source_file'], {})
        reg[f"audio/{dst_name}"] = {
            "source": meta.get('source', '50languages'),
            "speaker": meta.get('speaker', '50LANGUAGES native speaker'),
            "license": meta.get('license', 'CC BY-NC-ND 4.0 (private study only)'),
            "page": meta.get('page', 'https://50languages.com/en/learn/phrasebook-lessons/'),
            "from": card['source_file']
        }

    print(f"Copied {len(NEW_CARDS)} card audio files to audio/ and registered in sources.js.")

    print("\n=== Step 2: Copy Single Words to audio/words/ and update human.js ===")
    human_text = read_text('human.js')
    hm = re.search(r'window\.ShqipHuman\s*=\s*(\{[\s\S]*\});?\s*$', human_text)
    human_obj = json.loads(hm.group(1))

    words_copied = 0
    for card in NEW_CARDS:
        tokens = re.findall(r'[a-zA-ZëçËÇ]+', card['albanian'].lower())
        for token in tokens:
            if token in word_pool:
                w_meta = word_pool[token]
                w_src = os.path.join(ROOT, w_meta['file_path'])
                w_dst = os.path.join(ROOT, 'audio', 'words', f"{token}.mp3")
                if not os.path.exists(w_dst):
                    shutil.copyfile(w_src, w_dst)
                    words_copied += 1
                if token not in human_obj:
                    human_obj[token] = {
                        "file": f"audio/words/{token}.mp3",
                        "speaker": w_meta.get('speaker', 'Native speaker'),
                        "source": w_meta.get('source', 'commons'),
                        "license": w_meta.get('license', 'CC BY 4.0')
                    }
                else:
                    if not os.path.exists(os.path.join(ROOT, human_obj[token].get('file', f"audio/human/{token}.mp3"))):
                        human_obj[token]['file'] = f"audio/words/{token}.mp3"

    print(f"Copied {words_copied} new words to audio/words/ and verified human.js entries.")
    write_text('human.js', f"window.ShqipHuman = {json.dumps(human_obj, ensure_ascii=False, indent=2)};\n")

    print("\n=== Step 3: Copy Scene Audio to audio/day/ and register in sources.js ===")
    flat_turns = []
    scenes_for_day = []

    for sc in REAL_LIFE_SCENES:
        scene_entry = {
            "id": sc["id"],
            "title": sc["title"],
            "island": sc["island"],
            "turns": []
        }
        for t in sc["turns"]:
            day_file = f"{t['audio']}.mp3"  # e.g. "day/01.mp3"
            dst_day_path = os.path.join(ROOT, 'audio', day_file)
            src_day_path = os.path.join(ROOT, t['src'])
            shutil.copyfile(src_day_path, dst_day_path)

            meta = corpus_by_path.get(t['src'], {})
            reg[f"audio/{day_file}"] = {
                "source": meta.get('source', '50languages'),
                "speaker": meta.get('speaker', '50LANGUAGES native speaker'),
                "license": meta.get('license', 'CC BY-NC-ND 4.0 (private study only)'),
                "page": meta.get('page', 'https://50languages.com/en/learn/phrasebook-lessons/'),
                "from": t['src']
            }

            turn_obj = {
                "who": t["who"],
                "sq": t["sq"],
                "en": t["en"],
                "audio": t["audio"],
                "part": sc["title"],
                "sceneId": sc["id"],
                "island": sc["island"]
            }
            scene_entry["turns"].append(turn_obj)
            flat_turns.append(turn_obj)
        scenes_for_day.append(scene_entry)

    print(f"Copied {len(flat_turns)} turns across {len(scenes_for_day)} scenes to audio/day/ and registered in sources.js.")
    write_text('sources.js', f"window.ShqipSources = {json.dumps(sources_obj, ensure_ascii=False, indent=2)};\n")

    print("\n=== Step 4: Write updated day.js ===")
    day_data = {
        "title": "A day with Anila and Ilir",
        "note": "Native human Albanian recordings from 50LANGUAGES, Loecsen, and Wikimedia Commons. Voiced across 10 real-life family micro-scenes.",
        "scenes": scenes_for_day,
        "turns": flat_turns
    }
    write_text('day.js', f"window.ShqipDay = {json.dumps(day_data, ensure_ascii=False, indent=2)};\n")
    print("Updated day.js with 10 micro-scenes and 100 turns.")

    print("\n=== Step 5: Append new cards to cards.json ===")
    cards = load_json('cards.json')
    seen_ids = set(c['id'] for c in cards)

    for nc in NEW_CARDS:
        if nc['id'] not in seen_ids:
            card_dict = {
                "id": nc["id"],
                "island": nc["island"],
                "albanian": nc["albanian"],
                "english": nc["english"],
                "phonetic": nc["phonetic"],
                "tip": nc["tip"],
                "blocks": nc["blocks"],
                "lesson": nc["lesson"],
                "verified": False
            }
            cards.append(card_dict)
            seen_ids.add(nc['id'])

    save_json('cards.json', cards)
    print(f"Updated cards.json: now {len(cards)} total cards.")

    print("\n=== Step 6: Update sw.js pre-cache list ===")
    sw_text = read_text('sw.js')
    sw_text = re.sub(r"const CACHE_VERSION = '([^']+)';", "const CACHE_VERSION = 'shqipfeed-v37';", sw_text)

    # Core app shell assets
    core_assets = [
        "./",
        "./index.html",
        "./styles.css",
        "./app.js",
        "./data.js",
        "./cards.json",
        "./day.js",
        "./rules.js",
        "./listen.js",
        "./human.js",
        "./sources.js",
        "./manifest.json",
        "./icons/icon-192.png",
        "./icons/icon-512.png"
    ]

    # Active card audio from cards.json
    active_audio = set()
    for c in cards:
        active_audio.add(f"./audio/{c.get('audio') or c['id']}.mp3")
        lesson = c.get('lesson')
        if lesson:
            for ans in lesson.get('answers', []):
                if ans.get('audio'):
                    active_audio.add(f"./audio/{ans['audio']}.mp3")
            if lesson.get('reply') and lesson['reply'].get('audio'):
                active_audio.add(f"./audio/{lesson['reply']['audio']}.mp3")

    # Day audio
    for t in flat_turns:
        active_audio.add(f"./audio/{t['audio']}.mp3")

    # Word audio files: keep previous words in sw.js plus any new words copied
    words_dir = os.path.join(ROOT, 'audio', 'words')
    existing_sw_words = set(re.findall(r'\"(\./audio/words/[^\"]+)\"', sw_text))
    word_assets = []
    for w_entry in existing_sw_words:
        if os.path.exists(os.path.join(ROOT, w_entry.lstrip('./'))):
            word_assets.append(w_entry)

    # Add any newly copied words for the cards
    for card in NEW_CARDS:
        tokens = re.findall(r'[a-zA-ZëçËÇ]+', card['albanian'].lower())
        for token in tokens:
            w_path = os.path.join(words_dir, f"{token}.mp3")
            if os.path.exists(w_path):
                word_assets.append(f"./audio/words/{token}.mp3")

    all_assets = sorted(list(set(core_assets + list(active_audio) + word_assets)))

    # Ensure raw archive audio/human/ is excluded
    all_assets = [a for a in all_assets if not a.startswith('./audio/human/')]

    print(f"Total ASSETS in sw.js: {len(all_assets)} (must be < 1,500)")
    assert len(all_assets) < 1500, f"sw.js asset count {len(all_assets)} exceeds 1500!"

    assets_lines = "const ASSETS = [\n" + "\n".join(f'  "{a}",' for a in all_assets) + "\n];"
    sw_text = re.sub(r'const ASSETS = \[[^\]]*\];', assets_lines, sw_text)
    write_text('sw.js', sw_text)
    print("Updated sw.js with cache version shqipfeed-v37.")

    print("\n=== Step 7: Update docs/ROADMAP.md ===")
    roadmap_text = read_text('docs/ROADMAP.md')
    if 'CORPUS-SCENES-01' not in roadmap_text:
        new_row = '| `CORPUS-SCENES-01` | Mine human audio pool: 10 Real-Life Family Scenes in `day.js` & 50 everyday conversation cards in `cards.json` | `done` | 10 real-life family scenes in `day.js` (100 turns total); 50 everyday cards added to `cards.json` with 100% human audio; phonetics, Lego blocks & lesson dialogs; `sw.js` cached < 1,500 files. |\n'
        roadmap_text = roadmap_text.strip() + '\n' + new_row
        write_text('docs/ROADMAP.md', roadmap_text)
        print("Updated docs/ROADMAP.md with CORPUS-SCENES-01 marked done.")

    print("\nAll operations completed successfully!")

if __name__ == '__main__':
    main()
