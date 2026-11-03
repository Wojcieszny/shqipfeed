/* data.js
   Loads starter cards from cards.json, stores owner-added islands,
   verified flags, and progress, and builds the backup file.
   The screen never reads storage itself. app.js asks this file.
*/
(function () {
  var KEY_OWNER = "shqipfeed-owner-cards";
  var KEY_VERIFIED = "shqipfeed-verified";
  var KEY_PROGRESS = "shqipfeed-progress";
  var KEY_BOXES = "shqipfeed-boxes";
  var KEY_CAP = "shqipfeed-level-cap";
  var REQUIRED = ["id", "island", "english", "albanian", "phonetic"];
  var BLOCK_TYPES = { power: true, verb: true, object: true, other: true };
  var BOX_WAIT = [0, 0, 2, 4, 9, 14];
  var PATH = [
    "Greetings & Check-ins",
    "Conversation Repair",
    "Coffee & Table",
    "Food & Eating",
    "Family & Warmth",
    "Health & Feelings",
    "Plans & Weekend",
    "Numbers & Money",
    "Getting Around",
    "Shopping",
    "House & Hosts",
    "Lego Verb Builder",
  ];

  var starterCards = [];
  var memory = { owner: [], verified: {}, progress: {}, boxes: {}, cap: "auto" };
  var canStore = probeStorage();

  // True when localStorage can be written. False in private mode or when storage is full.
  function probeStorage() {
    try {
      var key = "__shqipfeed_probe";
      window.localStorage.setItem(key, "1");
      window.localStorage.removeItem(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  // Finds the folder this script was loaded from, so cards.json works at any site root.
  function scriptBase() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var clean = (scripts[i].src || "").split("?")[0];
      if (clean.endsWith("/data.js")) {
        return clean.slice(0, clean.length - "data.js".length);
      }
    }
    return "./";
  }

  // Reads one saved JSON value. Falls back to memory when storage is blocked.
  function readKey(key, fallback) {
    if (!canStore) {
      if (key === KEY_OWNER) return memory.owner;
      if (key === KEY_VERIFIED) return memory.verified;
      if (key === KEY_BOXES) return memory.boxes;
      if (key === KEY_CAP) return memory.cap;
      return memory.progress;
    }
    try {
      var raw = window.localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  // Writes one JSON value. If storage fails, keep the session copy and stop trying.
  function writeKey(key, value) {
    if (key === KEY_OWNER) memory.owner = value;
    else if (key === KEY_VERIFIED) memory.verified = value;
    else if (key === KEY_BOXES) memory.boxes = value;
    else if (key === KEY_CAP) memory.cap = value;
    else memory.progress = value;
    if (!canStore) return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      canStore = false;
      return false;
    }
  }

  // Names a pasted card in errors, including its id when it has one.
  function cardLabel(card, index) {
    var n = index + 1;
    if (card && typeof card.id === "string" && card.id.trim()) {
      return "Card " + n + ' ("' + card.id.trim() + '")';
    }
    return "Card " + n;
  }

  // Fetches cards.json and remembers it for this page load.
  function loadStarterCards() {
    return fetch(scriptBase() + "cards.json").then(function (res) {
      if (!res.ok) throw new Error("bad status");
      return res.json();
    }).then(function (data) {
      if (!Array.isArray(data)) throw new Error("not a list");
      starterCards = data;
      return starterCards;
    });
  }

  // Returns the cards that shipped with the app. Does not include owner cards.
  function getStarterCards() {
    return starterCards.map(function (card) {
      return Object.assign({}, card);
    });
  }

  // Returns islands the owner pasted in. These can be deleted. Starter cards cannot.
  function getOwnerCards() {
    var raw = readKey(KEY_OWNER, []);
    if (!Array.isArray(raw)) return [];
    return raw.map(function (card) {
      return Object.assign({}, card);
    });
  }

  // Returns the verified on/off choices saved on this phone, keyed by card id.
  function getVerifiedMap() {
    var raw = readKey(KEY_VERIFIED, {});
    var copy = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return copy;
    Object.keys(raw).forEach(function (id) {
      if (raw[id] === true || raw[id] === false) copy[id] = raw[id];
    });
    return copy;
  }

  // The flag on the card, unless this phone has toggled that card.
  function effectiveVerified(card) {
    var overrides = getVerifiedMap();
    if (Object.prototype.hasOwnProperty.call(overrides, card.id)) {
      return overrides[card.id] === true;
    }
    return card.verified === true;
  }

  // Starter cards first, then owner cards, with the verified flag this phone should show.
  function getAllCards() {
    var starter = getStarterCards().map(function (card) {
      return Object.assign({}, card, {
        source: "starter",
        verified: effectiveVerified(card),
      });
    });
    var owner = getOwnerCards().map(function (card) {
      return Object.assign({}, card, {
        source: "owner",
        verified: effectiveVerified(card),
      });
    });
    return starter.concat(owner);
  }

  // Groups cards into islands, in first-seen order, with known counts from progress.
  function getIslandSummaries(progress) {
    var order = [];
    var map = {};
    getAllCards().forEach(function (card) {
      if (!map[card.island]) {
        map[card.island] = {
          name: card.island,
          total: 0,
          known: 0,
          ownerOnly: true,
          cards: [],
        };
        order.push(card.island);
      }
      var row = map[card.island];
      row.total += 1;
      row.cards.push(card);
      if (card.source === "starter") row.ownerOnly = false;
      if (progress && progress[card.id] === "known") row.known += 1;
    });
    return order.map(function (name) {
      return map[name];
    });
  }

  // Checks pasted JSON. Returns plain-English errors and, if clean, the cards to save.
  function validatePaste(text, existingIds, existingIslands) {
    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return {
        ok: false,
        cards: [],
        errors: ["That is not valid JSON. Check commas and quotes."],
      };
    }

    var list;
    if (Array.isArray(parsed)) list = parsed;
    else if (parsed && typeof parsed === "object") list = [parsed];
    else {
      return {
        ok: false,
        cards: [],
        errors: ["Paste a card object {...} or a list of cards [...]."],
      };
    }

    if (list.length === 0) {
      return { ok: false, cards: [], errors: ["Paste at least one card."] };
    }

    var ids = {};
    (existingIds || []).forEach(function (id) {
      ids[id] = true;
    });
    var takenIslands = {};
    (existingIslands || []).forEach(function (name) {
      takenIslands[name] = true;
    });
    var newIslands = {};
    var errors = [];
    var cards = [];

    for (var i = 0; i < list.length; i++) {
      var raw = list[i];
      var label = cardLabel(raw, i);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        errors.push(label + ": this entry is not a card object.");
        continue;
      }

      var missing = false;
      for (var f = 0; f < REQUIRED.length; f++) {
        var field = REQUIRED[f];
        if (typeof raw[field] !== "string" || raw[field].trim() === "") {
          errors.push(label + ": missing " + field + ".");
          missing = true;
        }
      }
      if (missing) continue;

      var id = raw.id.trim();
      var island = raw.island.trim();
      if (ids[id]) {
        errors.push(label + ': id "' + id + '" is already used.');
      } else {
        ids[id] = true;
      }
      if (takenIslands[island] && !newIslands[island]) {
        errors.push(label + ': island "' + island + '" already exists. Use a new name.');
      } else {
        newIslands[island] = true;
      }

      var blocks = [];
      var blocksOk = true;
      if (raw.blocks !== undefined) {
        if (!Array.isArray(raw.blocks)) {
          errors.push(label + ": blocks must be a list.");
          blocksOk = false;
        } else {
          for (var b = 0; b < raw.blocks.length; b++) {
            var block = raw.blocks[b];
            if (!block || typeof block !== "object" || typeof block.text !== "string" || block.text.trim() === "") {
              errors.push(label + ": block " + (b + 1) + " is missing text.");
              blocksOk = false;
              continue;
            }
            if (!BLOCK_TYPES[block.type]) {
              errors.push(label + ": block " + (b + 1) + " type must be power, verb, object, or other.");
              blocksOk = false;
              continue;
            }
            blocks.push({ text: block.text.trim(), type: block.type });
          }
        }
      }
      if (!blocksOk) continue;

      cards.push({
        id: id,
        island: island,
        english: raw.english.trim(),
        albanian: raw.albanian.trim(),
        phonetic: raw.phonetic.trim(),
        tip: typeof raw.tip === "string" ? raw.tip.trim() : "",
        blocks: blocks,
        verified: raw.verified === true,
      });
    }

    return { ok: errors.length === 0, cards: errors.length ? [] : cards, errors: errors };
  }

  // Saves cards that already passed validatePaste.
  function addOwnerCards(cards) {
    var next = getOwnerCards().concat(cards);
    writeKey(KEY_OWNER, next);
    return { ok: true };
  }

  // Removes an island the owner added. Refuses if the name comes from cards.json.
  function deleteOwnerIsland(name) {
    var starterNames = {};
    getStarterCards().forEach(function (card) {
      starterNames[card.island] = true;
    });
    if (starterNames[name]) {
      return { ok: false, error: "Starter islands can't be deleted." };
    }
    var next = getOwnerCards().filter(function (card) {
      return card.island !== name;
    });
    writeKey(KEY_OWNER, next);
    return { ok: true };
  }

  // Remembers the Mark verified toggle for one card.
  function setVerified(id, value) {
    var map = getVerifiedMap();
    map[id] = value === true;
    writeKey(KEY_VERIFIED, map);
  }

  // Reads Known / Skip for every card. Only those two values are kept.
  function getProgress() {
    var raw = readKey(KEY_PROGRESS, {});
    var copy = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return copy;
    Object.keys(raw).forEach(function (id) {
      if (raw[id] === "known" || raw[id] === "skipped") copy[id] = raw[id];
    });
    return copy;
  }

  // Replaces the whole Known / Skip map.
  function setProgress(progress) {
    writeKey(KEY_PROGRESS, progress || {});
  }

  // Clears Known / Skip and the five boxes. Islands and verified flags stay.
  function resetProgress() {
    writeKey(KEY_PROGRESS, {});
    writeKey(KEY_BOXES, {});
  }

  // Local calendar day, so a box due "today" matches the phone's date.
  function dayStamp(offset) {
    var d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + (offset || 0));
    var month = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (month.length < 2) month = "0" + month;
    if (day.length < 2) day = "0" + day;
    return d.getFullYear() + "-" + month + "-" + day;
  }

  // Beginner, unless the card says medium or advanced.
  function levelOf(card) {
    if (card && (card.level === "medium" || card.level === "advanced")) return card.level;
    return "beginner";
  }

  // The course order. Inside an island, beginner comes before medium, then advanced.
  function pathCards() {
    var groups = {};
    var order = PATH.slice();
    getAllCards().forEach(function (card) {
      if (order.indexOf(card.island) === -1) order.push(card.island);
      if (!groups[card.island]) groups[card.island] = [];
      groups[card.island].push(card);
    });
    var rank = { beginner: 0, medium: 1, advanced: 2 };
    var out = [];
    order.forEach(function (name) {
      var list = groups[name] || [];
      list.sort(function (a, b) {
        return rank[levelOf(a)] - rank[levelOf(b)];
      });
      out = out.concat(list);
    });
    return out;
  }

  // The five boxes saved on this phone. Each value is { box, due }.
  function getBoxes() {
    var raw = readKey(KEY_BOXES, {});
    var copy = {};
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return copy;
    Object.keys(raw).forEach(function (id) {
      var row = raw[id];
      if (!row || typeof row !== "object") return;
      if (row.box !== 1 && row.box !== 2 && row.box !== 3 && row.box !== 4 && row.box !== 5) return;
      if (typeof row.due !== "string") return;
      copy[id] = { box: row.box, due: row.due };
    });
    return copy;
  }

  // "beginner" holds the path on beginner lines. Anything else lets the app move on.
  function getCap() {
    return readKey(KEY_CAP, "auto") === "beginner" ? "beginner" : "auto";
  }

  // Remembers whether the app may leave Beginner.
  function setCap(value) {
    writeKey(KEY_CAP, value === "beginner" ? "beginner" : "auto");
  }

  // True when every card of that level in the island has been got right at least once.
  function allAtLeast(island, level, boxes, min) {
    var list = [];
    getAllCards().forEach(function (card) {
      if (card.island === island && levelOf(card) === level) list.push(card);
    });
    if (!list.length) return false;
    for (var i = 0; i < list.length; i++) {
      var state = boxes[list[i].id];
      if (!state || state.box < min) return false;
    }
    return true;
  }

  // Beginner is always open. Medium waits until that island's beginner lines are in box 2 or higher.
  function levelAllowed(card, boxes, cap) {
    var level = levelOf(card);
    if (cap === "beginner" && level !== "beginner") return false;
    if (level === "beginner") return true;
    if (!allAtLeast(card.island, "beginner", boxes, 2)) return false;
    if (level === "medium") return true;
    var hasMedium = false;
    getAllCards().forEach(function (other) {
      if (other.island === card.island && levelOf(other) === "medium") hasMedium = true;
    });
    if (!hasMedium) return true;
    return allAtLeast(card.island, "medium", boxes, 2);
  }

  // Due lines first, then up to five new ones. A long review day adds no new lines.
  function buildToday() {
    var boxes = getBoxes();
    var cap = getCap();
    var today = dayStamp(0);
    var due = [];
    var fresh = [];
    pathCards().forEach(function (card) {
      if (!levelAllowed(card, boxes, cap)) return;
      var state = boxes[card.id];
      if (!state) fresh.push(card);
      else if (state.due <= today) due.push(card);
    });
    var reviews = due.slice(0, 12);
    var news = due.length > 12 ? [] : fresh.slice(0, 5);
    var queue = reviews.concat(news);
    var started = Object.keys(boxes).length > 0;
    var where = "The app picks the next lines.";
    if (queue[0]) where = queue[0].island + " · " + queue[0].english;
    else if (started) where = "Nothing is due today.";
    return {
      queue: queue,
      newIds: news.filter(function (card) { return card.review !== false; }).map(function (card) { return card.id; }),
      where: where,
      started: started,
      caughtUp: started && queue.length === 0,
    };
  }

  // Got it moves up one box. Again drops back to box 1 and is due today.
  function gradeCard(id, gotIt) {
    var boxes = getBoxes();
    var state = boxes[id];
    var box = state && state.box ? state.box : 1;
    if (gotIt) {
      var next = box >= 5 ? 5 : box + 1;
      boxes[id] = { box: next, due: dayStamp(BOX_WAIT[next]) };
    } else {
      boxes[id] = { box: 1, due: dayStamp(0) };
    }
    writeKey(KEY_BOXES, boxes);
    return boxes[id];
  }

  // A count screen is heard once. It does not sit in a box or come back.
  function passCard(id) {
    var boxes = getBoxes();
    boxes[id] = { box: 5, due: "9999-12-31" };
    writeKey(KEY_BOXES, boxes);
    return boxes[id];
  }

  // How many lines sit in each box.
  function boxCounts() {
    var boxes = getBoxes();
    var counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    Object.keys(boxes).forEach(function (id) {
      if (String(boxes[id].due || "").indexOf("9999") === 0) return;
      var box = boxes[id].box;
      if (counts[box] !== undefined) counts[box] += 1;
    });
    return counts;
  }

  // How many lines exist at each level, and how many have been seen.
  function levelCounts() {
    var boxes = getBoxes();
    var out = {
      beginner: { total: 0, started: 0 },
      medium: { total: 0, started: 0 },
      advanced: { total: 0, started: 0 },
    };
    pathCards().forEach(function (card) {
      var level = levelOf(card);
      out[level].total += 1;
      if (boxes[card.id]) out[level].started += 1;
    });
    return out;
  }

  // Island rows for Settings. Not a menu.
  function islandProgress() {
    var boxes = getBoxes();
    var rows = [];
    var seen = {};
    pathCards().forEach(function (card) {
      if (!seen[card.island]) {
        seen[card.island] = { name: card.island, total: 0, inBoxes: 0 };
        rows.push(seen[card.island]);
      }
      seen[card.island].total += 1;
      if (boxes[card.id]) seen[card.island].inBoxes += 1;
    });
    return rows;
  }

  // One JSON object with owner islands, verified flags, and progress.
  function buildBackup() {
    return {
      version: 1,
      ownerCards: getOwnerCards(),
      verified: getVerifiedMap(),
      progress: getProgress(),
      boxes: getBoxes(),
    };
  }

  // Replaces owner islands, verified flags, and progress. Rejects a bad file without changing anything.
  function applyBackup(data) {
    var errors = [];
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { ok: false, errors: ["That backup is not a JSON object."] };
    }
    if (!Array.isArray(data.ownerCards)) {
      errors.push("Backup is missing ownerCards, the list of added cards.");
    }
    if (!data.verified || typeof data.verified !== "object" || Array.isArray(data.verified)) {
      errors.push("Backup is missing verified flags.");
    }
    if (!data.progress || typeof data.progress !== "object" || Array.isArray(data.progress)) {
      errors.push("Backup is missing progress.");
    }
    if (errors.length) return { ok: false, errors: errors };

    var starterIds = {};
    var starterIslands = {};
    getStarterCards().forEach(function (card) {
      starterIds[card.id] = true;
      starterIslands[card.island] = true;
    });

    var fakeList = data.ownerCards;
    var seen = {};
    var cleanedCards = [];
    var introduced = {};
    for (var i = 0; i < fakeList.length; i++) {
      var card = fakeList[i];
      var label = cardLabel(card, i);
      if (!card || typeof card !== "object" || Array.isArray(card)) {
        errors.push(label + ": this entry is not a card object.");
        continue;
      }
      var missing = false;
      for (var f = 0; f < REQUIRED.length; f++) {
        var field = REQUIRED[f];
        if (typeof card[field] !== "string" || card[field].trim() === "") {
          errors.push(label + ": missing " + field + ".");
          missing = true;
        }
      }
      if (missing) continue;
      var id = card.id.trim();
      var island = card.island.trim();
      if (starterIds[id] || seen[id]) {
        errors.push(label + ': id "' + id + '" is already used.');
      } else {
        seen[id] = true;
      }
      if (starterIslands[island] && !introduced[island]) {
        errors.push(label + ': island "' + island + '" already exists. Use a new name.');
      } else {
        introduced[island] = true;
      }
      cleanedCards.push({
        id: id,
        island: island,
        english: card.english.trim(),
        albanian: card.albanian.trim(),
        phonetic: card.phonetic.trim(),
        tip: typeof card.tip === "string" ? card.tip.trim() : "",
        blocks: Array.isArray(card.blocks) ? card.blocks : [],
        verified: card.verified === true,
      });
    }

    var verified = {};
    Object.keys(data.verified).forEach(function (id) {
      if (data.verified[id] === true || data.verified[id] === false) {
        verified[id] = data.verified[id];
      } else {
        errors.push('Verified flag for "' + id + '" must be true or false.');
      }
    });

    var progress = {};
    Object.keys(data.progress).forEach(function (id) {
      if (data.progress[id] === "known" || data.progress[id] === "skipped") {
        progress[id] = data.progress[id];
      } else {
        errors.push('Progress for "' + id + '" must be known or skipped.');
      }
    });

    var boxes = {};
    if (data.boxes && typeof data.boxes === "object" && !Array.isArray(data.boxes)) {
      Object.keys(data.boxes).forEach(function (id) {
        var row = data.boxes[id];
        if (!row || typeof row !== "object") return;
        if (row.box !== 1 && row.box !== 2 && row.box !== 3 && row.box !== 4 && row.box !== 5) return;
        if (typeof row.due !== "string") return;
        boxes[id] = { box: row.box, due: row.due };
      });
    }

    if (errors.length) return { ok: false, errors: errors };

    writeKey(KEY_OWNER, cleanedCards);
    writeKey(KEY_VERIFIED, verified);
    writeKey(KEY_PROGRESS, progress);
    writeKey(KEY_BOXES, boxes);
    return { ok: true, errors: [] };
  }

  // Tells the screen whether saves will stick after a refresh.
  function storageWorks() {
    return canStore;
  }

  window.ShqipData = {
    scriptBase: scriptBase,
    storageWorks: storageWorks,
    loadStarterCards: loadStarterCards,
    getStarterCards: getStarterCards,
    getOwnerCards: getOwnerCards,
    getAllCards: getAllCards,
    getIslandSummaries: getIslandSummaries,
    validatePaste: validatePaste,
    addOwnerCards: addOwnerCards,
    deleteOwnerIsland: deleteOwnerIsland,
    setVerified: setVerified,
    getProgress: getProgress,
    setProgress: setProgress,
    resetProgress: resetProgress,
    buildToday: buildToday,
    gradeCard: gradeCard,
    passCard: passCard,
    boxCounts: boxCounts,
    levelCounts: levelCounts,
    islandProgress: islandProgress,
    getCap: getCap,
    setCap: setCap,
    levelOf: levelOf,
    buildBackup: buildBackup,
    applyBackup: applyBackup,
  };
})();
