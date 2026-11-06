/* Great Days Index Snapshot: shared scoring and copy.
   One source for the dimension names, reads, engagements, lever reads, bands,
   and the first-move rule. assessment.html loads this file in the browser, and
   the Netlify functions require it to build the PDF, so the page and the PDF
   can never disagree. The statements and their anchor descriptions stay in
   assessment.html, which is the only place that needs them. */
(function (root) {
  var CORE_DIMS = [
  {
    "id": "direction",
    "lever": "Clarity",
    "name": "Direction and priorities",
    "eng": {
      "name": "Align",
      "href": "align.html"
    },
    "read": "Whether the organization knows where it is going, and whether that direction actually shapes decisions.",
    "n": 3
  },
  {
    "id": "change",
    "lever": "Clarity",
    "name": "Change readiness",
    "eng": {
      "name": "Navigate",
      "href": "navigate.html"
    },
    "read": "How the organization moves through seasons of change: deliberately, or bracing for impact.",
    "n": 4
  },
  {
    "id": "leaders",
    "lever": "Competency",
    "name": "How leaders grow people",
    "eng": {
      "name": "The Core",
      "href": "thecore.html"
    },
    "read": "Whether leading here means developing people, or just keeping the work moving.",
    "n": 3
  },
  {
    "id": "bench",
    "lever": "Competency",
    "name": "Leadership bench",
    "eng": {
      "name": "Elevate",
      "href": "elevate.html"
    },
    "read": "Whether the next generation of leaders is being built on purpose, or promoted and left to figure it out.",
    "n": 3
  },
  {
    "id": "team",
    "lever": "Chemistry",
    "name": "Leadership team health",
    "eng": {
      "name": "Align",
      "href": "align.html"
    },
    "read": "Whether the leadership team operates as one team, or as a collection of departments.",
    "n": 4
  },
  {
    "id": "culture",
    "lever": "Chemistry",
    "name": "Culture and retention",
    "eng": {
      "name": "The Core",
      "href": "thecore.html"
    },
    "read": "Whether the culture keeps the people you most want to keep.",
    "n": 3
  }
];
  var FOUNDER_DIM = {
  "id": "founder",
  "lever": null,
  "name": "Founder load",
  "eng": {
    "name": "Accelerate",
    "href": "accelerate.html"
  },
  "read": "How much of the organization still runs through you.",
  "n": 2
};
  var BOARD_DIM = {
  "id": "boarddim",
  "lever": null,
  "name": "Board and governance",
  "eng": {
    "name": "Healthy Boards",
    "href": "healthyboards.html"
  },
  "read": "Whether the board is governing, or attending.",
  "n": 4
};
  var LEVER_READS = {
  "Clarity": {
    "strong": "Direction is set and shaping decisions. Protect it as you grow.",
    "strained": "The direction exists, but it isn't governing the week-to-week yet.",
    "attn": "The organization is working hard without a shared answer to \"toward what?\""
  },
  "Competency": {
    "strong": "Leaders here grow people, and the bench shows it.",
    "strained": "Good leaders, uneven leadership. Development is happening by personality, not design.",
    "attn": "People are being managed, not led, and the bench is thin."
  },
  "Chemistry": {
    "strong": "The team is doing real work in the room together. That's rare, keep it.",
    "strained": "Polite is doing the work trust should be doing.",
    "attn": "The hard conversations are happening in hallways, and the organization can feel it."
  }
};
  var LEVERS = ['Clarity', 'Competency', 'Chemistry'];

  var BANDS = {
    strong:   { key: 'strong',   label: 'Strong',          cls: 'band-strong',   hex: '#0F3C61' },
    strained: { key: 'strained', label: 'Strained',        cls: 'band-strained', hex: '#F68623' },
    attn:     { key: 'attn',     label: 'Needs attention', cls: 'band-attn',     hex: '#C2571B' }
  };
  function band(avg) { return avg >= 4.25 ? BANDS.strong : (avg >= 3.25 ? BANDS.strained : BANDS.attn); }

  // The prequal answers decide which extra dimensions apply. Shared so the page
  // and the PDF always score the same set.
  var STATE_KEYS = ['orgtype', 'role', 'headcount', 'timing', 'priorfirm', 'ownerled', 'board'];
  function normalizeState(raw) {
    var s = {};
    STATE_KEYS.forEach(function (k) {
      var v = raw && raw[k];
      s[k] = (typeof v === 'string' && /^[A-Za-z0-9+_-]{1,20}$/.test(v)) ? v : null;
    });
    s.founderMod = s.role === 'founder' || (s.ownerled === 'yes' && (s.role === 'ceo' || s.role === 'founder'));
    s.boardMod = s.board === 'yes' || s.role === 'board';
    return s;
  }

  function dimsFor(state) {
    var list = CORE_DIMS.slice();
    if (state && state.founderMod) list.push(FOUNDER_DIM);
    if (state && state.boardMod) list.push(BOARD_DIM);
    return list;
  }

  // answers: { "<dimId>_<i>": 1..5 }. Returns null if any answer is missing or
  // out of range, so callers never score a partial Snapshot.
  function score(answers, state) {
    var dims = dimsFor(state).map(function (m) {
      var sum = 0;
      for (var i = 0; i < m.n; i++) {
        var v = Number(answers[m.id + '_' + i]);
        if (!(v >= 1 && v <= 5) || Math.round(v) !== v) return null;
        sum += v;
      }
      var avg = sum / m.n;
      return { id: m.id, lever: m.lever, name: m.name, eng: m.eng, read: m.read, avg: avg, band: band(avg) };
    });
    if (dims.some(function (d) { return d === null; })) return null;

    var levers = LEVERS.map(function (lv) {
      var lds = dims.filter(function (d) { return d.lever === lv; });
      var avg = lds.reduce(function (a, d) { return a + d.avg; }, 0) / lds.length;
      var b = band(avg);
      return { name: lv, avg: avg, band: b, read: LEVER_READS[lv][b.key] };
    });

    // First move: the lowest dimension, unless founder load is weak and close behind.
    var target = dims.reduce(function (a, b) { return b.avg < a.avg ? b : a; });
    var fd = dims.filter(function (d) { return d.id === 'founder'; })[0];
    if (fd && fd.avg <= 3 && fd.avg <= target.avg + 0.5) target = fd;

    // Lowest read first; ties keep the questionnaire order.
    var sorted = dims.map(function (d, i) { return { d: d, i: i }; })
      .sort(function (a, b) { return a.d.avg - b.d.avg || a.i - b.i; })
      .map(function (x) { return x.d; });

    var strained = dims.filter(function (d) { return d.band !== BANDS.strong; }).length;
    var summary = strained === 0
      ? 'A strong self-read across the board. The question the full Index answers: does your team see it the same way?'
      : strained === dims.length
        ? 'The Snapshot reads ' + dims.length + ' dimensions. All ' + dims.length + ' are carrying strain, and one points to your first move.'
        : 'The Snapshot reads ' + dims.length + ' dimensions. ' + strained + ' of them ' + (strained === 1 ? 'is' : 'are') + ' carrying strain, and one points to your first move.';

    return { dims: dims, sorted: sorted, levers: levers, target: target, strainedCount: strained, summary: summary };
  }

  // The sentence after the dimension's read in the first-move panel. When every
  // dimension is strong, "quietly taxing everything else" would be wrong, so that
  // case gets its own line (approved by Ben, November 5, 2026).
  // voice: 'your' on the page and customer PDF, 'the' on the team PDF.
  // itIs: "it's" on the page, "it is" in the PDF, matching each one's original copy.
  function firstMoveText(result, voice, itIs) {
    if (result.strainedCount === 0) {
      return { line: 'Every dimension came back strong. This was ' + voice + ' lowest read, which makes it the place to go deeper next.',
               lead: 'The engagement built for that is ' };
    }
    return { line: 'This came back as ' + voice + ' lowest read, which usually means ' + itIs + ' quietly taxing everything else.',
             lead: 'The engagement built for this moment is ' };
  }

  var api = { CORE_DIMS: CORE_DIMS, FOUNDER_DIM: FOUNDER_DIM, BOARD_DIM: BOARD_DIM, LEVER_READS: LEVER_READS,
              LEVERS: LEVERS, BANDS: BANDS, band: band, normalizeState: normalizeState, dimsFor: dimsFor, score: score, firstMoveText: firstMoveText };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GDLSnapshot = api;
})(typeof window !== 'undefined' ? window : this);
