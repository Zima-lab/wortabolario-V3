/* Wortabolario — LOGICA APP (v3)
   I dati del vocabolario sono in data.js, caricato prima di questo file. */

/* ---------- MOTORE DI CONIUGAZIONE TEDESCA ----------
   Genera l'intero paradigma verbale (Indikativ, Konjunktiv, Imperativ, forme
   impersonali) a partire dai dati già presenti in VERBI (inf, pres, pra, perf),
   più una piccola tabella di metadati per gli ~20 verbi riflessivi/separabili/
   irregolari. Verificato riga per riga contro la tabella di flessione LEO. */

const PRON_AKK = ["mich","dich","sich","uns","euch","sich"];
const PRON_DAT = ["mir","dir","sich","uns","euch","sich"];
const CONJ_PERSONS = ["ich","du","er/sie/es","wir","ihr","sie"];

const VERB_META = {
  "sich waschen": { reflexive:"akk" },
  "sich anziehen": { reflexive:"akk" },
  "sich hinlegen": { reflexive:"akk" },
  "sich interessieren": { reflexive:"akk" },
  "sich aufregen": { reflexive:"akk" },
  "sich die Hände waschen": { reflexive:"dat" },
  "sich die Zähne putzen": { reflexive:"dat" },
  "sich etwas kaufen": { reflexive:"dat" }
};

function deUmlaut(s){ return s.replace(/ä/g,"a").replace(/ö/g,"o").replace(/ü/g,"u"); }
function umlaut(s){
  const idxAu = s.lastIndexOf("au");
  if (idxAu !== -1) return s.slice(0,idxAu) + "äu" + s.slice(idxAu+2);
  const idxA = s.lastIndexOf("a"), idxO = s.lastIndexOf("o"), idxU = s.lastIndexOf("u");
  const idx = Math.max(idxA, idxO, idxU);
  if (idx === -1) return s;
  const ch = s[idx];
  const rep = ch === "a" ? "ä" : ch === "o" ? "ö" : "ü";
  return s.slice(0,idx) + rep + s.slice(idx+1);
}
function deriveDuPresent(pres){
  if (pres.endsWith("et")) return pres.slice(0,-2) + "est";
  if (pres.endsWith("t")){
    const before = pres.slice(0,-1);
    if (/[sßz]$/.test(before)) return pres;
    return before + "st";
  }
  if (pres.endsWith("d")) return pres.slice(0,-1) + "st";
  if (/[sßz]$/.test(pres)) return pres + "t";
  return pres + "st";
}
function needsEpenthesis(stem){
  const last = stem[stem.length-1];
  const prev = stem[stem.length-2];
  if (last === "d" || last === "t") return true;
  if ((last === "n" || last === "m") && prev && /[bcdfgkpqtvwxz]/.test(prev)) return true;
  return false;
}
function ihrFromUnchangedStem(stem){ return stem + (needsEpenthesis(stem) ? "et" : "t"); }
function deriveDuPreteritum(pra){
  const last = pra[pra.length-1];
  if (last === "d" || last === "t") return pra + "est";
  if (last === "s" || last === "ß" || last === "z") return pra + "t";
  return pra + "st";
}
function deriveIhrPreteritum(pra){
  const last = pra[pra.length-1];
  if (last === "d" || last === "t") return pra + "et";
  return pra + "t";
}
function deriveWirSiePreteritum(pra){
  const last = pra[pra.length-1];
  return pra + (last === "e" ? "n" : "en");
}
function weakEndings(stem){ return [stem+"e", stem+"est", stem+"e", stem+"en", stem+"et", stem+"en"]; }
function stemExtractPres(pres){
  if (pres.endsWith("et")) return pres.slice(0,-2);
  if (pres.endsWith("t")) return pres.slice(0,-1);
  if (pres.endsWith("d")) return pres.slice(0,-1);
  return pres;
}

const K2_STEM_OVERRIDE = {
  bringen:"brächt", denken:"dächt", kennen:"kennt", wissen:"wüsst", rennen:"rennt",
  können:"könnt", müssen:"müsst", dürfen:"dürft", mögen:"möcht", helfen:"hülf",
  haben:"hätt", werden:"würd"
};
const IRREGULAR_PRESENT = {
  sein: ["bin","bist","ist","sind","seid","sind"],
  haben: ["habe","hast","hat","haben","habt","haben"],
  tun: ["tue","tust","tut","tun","tut","tun"]
};
const MODAL_LIKE = new Set(["können","müssen","wollen","sollen","dürfen","mögen","wissen"]);
const IMPERATIV_OVERRIDE = {
  sein: { du:"sei", ihr:"seid", wir:"seien wir" },
  haben: { du:"hab/habe", ihr:"habt", wir:"haben wir" },
  werden: { du:"werde", ihr:"werdet", wir:"werden wir" },
  tun: { du:"tu/tue", ihr:"tut", wir:"tun wir" },
  wissen: { du:"wisse", ihr:"wisst", wir:"wissen wir" },
  können:null, müssen:null, wollen:null, sollen:null, dürfen:null, mögen:null
};
const PARTIZIP1_OVERRIDE = {
  anfangen:"anfangend", anrufen:"anrufend", aufstehen:"aufstehend", einladen:"einladend",
  "sich anziehen":"sich anziehend", "sich hinlegen":"sich hinlegend",
  sein:"seiend", tun:"tuend"
};
const SEPARABLE_PREFIXES = new Set(["an","auf","ein","aus","mit","nach","vor","zu","weg","zurück",
  "ab","bei","her","hin","los","fest","statt","teil","wieder","zusammen","um","über","unter","durch","heim"]);

function buildParadigm(v, meta){
  meta = meta || {};
  const reflexive = meta.reflexive || null;
  const pronTable = reflexive === "dat" ? PRON_DAT : PRON_AKK;
  const isModal = MODAL_LIKE.has(v.inf);
  const irregularKey = IRREGULAR_PRESENT[v.inf] ? v.inf : null;

  const presClean = v.pres.includes(" / ") ? v.pres.split(" / ")[0] : v.pres;
  const presTokens = presClean.split(" ");
  const praTokens = v.pra.split(" ");
  const perfTokens = v.perf.split(" ");

  const coreErPres = presTokens[0];
  const restPres = presTokens.slice(1);
  const coreErPra = praTokens[0];
  const restPra = praTokens.slice(1);
  let auxWord = perfTokens[0];
  if (auxWord.includes("/")) auxWord = auxWord.split("/")[0];
  const participle = perfTokens[perfTokens.length-1];
  const restPerf = perfTokens.slice(1,-1);

  const infCore = v.inf.replace(/^sich\s+/, "");
  const infWords = infCore.split(" ");
  let lastInfWord = infWords[infWords.length-1];
  const nonSichRestPres = presTokens.slice(1).filter(t => t !== "sich");
  const candidatePrefix = nonSichRestPres[nonSichRestPres.length-1];
  if (candidatePrefix && SEPARABLE_PREFIXES.has(candidatePrefix) && lastInfWord.startsWith(candidatePrefix)) {
    lastInfWord = lastInfWord.slice(candidatePrefix.length);
  }
  const unchangedStemFull = lastInfWord.endsWith("en") ? lastInfWord.slice(0,-2) : lastInfWord.slice(0,-1);

  function substitute(tokens, personIdx){
    return tokens.map(t => t === "sich" ? pronTable[personIdx] : t).join(" ");
  }
  function attach(core, tokens, personIdx){
    const rest = substitute(tokens, personIdx);
    return rest ? core + " " + rest : core;
  }

  let coreFormsPres;
  if (irregularKey) {
    coreFormsPres = IRREGULAR_PRESENT[irregularKey];
  } else if (isModal) {
    const duPres = deriveDuPresent(coreErPres);
    const wirPres = unchangedStemFull + "en";
    coreFormsPres = [coreErPres, duPres, coreErPres, wirPres, ihrFromUnchangedStem(unchangedStemFull), wirPres];
  } else {
    const duPres = deriveDuPresent(coreErPres);
    const ichPres = unchangedStemFull + "e";
    const wirPres = unchangedStemFull + "en";
    coreFormsPres = [ichPres, duPres, coreErPres, wirPres, ihrFromUnchangedStem(unchangedStemFull), wirPres];
  }
  const praesens = coreFormsPres.map((f,i) => attach(f, restPres, i));

  const duPra = deriveDuPreteritum(coreErPra);
  const ihrPra = deriveIhrPreteritum(coreErPra);
  const wirSiePra = deriveWirSiePreteritum(coreErPra);
  const coreFormsPra = [coreErPra, duPra, coreErPra, wirSiePra, ihrPra, wirSiePra];
  const praeteritum = coreFormsPra.map((f,i) => attach(f, restPra, i));

  const auxPresForms = auxWord === "ist" ? IRREGULAR_PRESENT.sein : IRREGULAR_PRESENT.haben;
  const perfekt = auxPresForms.map((a,i) => [a, substitute(restPerf,i), participle].filter(Boolean).join(" "));
  const auxPraForms = auxWord === "ist"
    ? ["war","warst","war","waren","wart","waren"]
    : ["hatte","hattest","hatte","hatten","hattet","hatten"];
  const plusq = auxPraForms.map((a,i) => [a, substitute(restPerf,i), participle].filter(Boolean).join(" "));

  const werdenPres = ["werde","wirst","wird","werden","werdet","werden"];
  const futurI = werdenPres.map((w,i) => [w, reflexive?pronTable[i]:null, infCore].filter(Boolean).join(" "));
  const auxInfinitive = auxWord === "ist" ? "sein" : "haben";
  const futurII = werdenPres.map((w,i) => [w, substitute(restPerf,i), participle, auxInfinitive].filter(Boolean).join(" "));

  const k1Stem = v.inf === "sein" ? null : unchangedStemFull;
  const k1PresForms = v.inf === "sein" ? ["sei","seiest","sei","seien","seiet","seien"] : weakEndings(k1Stem);
  const konjIPraesens = k1PresForms.map((f,i) => attach(f, restPres, i));
  const auxK1 = auxWord === "ist" ? ["sei","seiest","sei","seien","seiet","seien"] : weakEndings("hab");
  const konjIPerfekt = auxK1.map((a,i) => [a, substitute(restPerf,i), participle].filter(Boolean).join(" "));

  let k2Stem;
  if (K2_STEM_OVERRIDE[v.inf]) k2Stem = K2_STEM_OVERRIDE[v.inf];
  else if (v.inf === "sein") k2Stem = null;
  else if (coreErPra.endsWith("te")) k2Stem = null;
  else k2Stem = umlaut(coreErPra);
  const k2CoreForms = k2Stem ? weakEndings(k2Stem) : (v.inf === "sein" ? weakEndings(umlaut(coreErPra)) : coreFormsPra);
  const konjIIPraeteritum = k2CoreForms.map((f,i) => attach(f, restPra, i));
  const auxK2 = auxWord === "ist" ? weakEndings("wär") : weakEndings("hätt");
  const konjIIPlusq = auxK2.map((a,i) => [a, substitute(restPerf,i), participle].filter(Boolean).join(" "));

  const werdenK1Forms = weakEndings("werd");
  const werdenK2Forms = weakEndings("würd");
  const konjFuturI = werdenK1Forms.map((w1,i) => {
    const combo = w1 + "/" + werdenK2Forms[i];
    return [combo, reflexive?pronTable[i]:null, infCore].filter(Boolean).join(" ");
  });
  const konjFuturII = werdenK1Forms.map((w1,i) => {
    const combo = w1 + "/" + werdenK2Forms[i];
    return [combo, substitute(restPerf,i), participle, auxInfinitive].filter(Boolean).join(" ");
  });

  let imperativ = null;
  if (IMPERATIV_OVERRIDE[v.inf] !== undefined) {
    const ov = IMPERATIV_OVERRIDE[v.inf];
    if (ov !== null) {
      imperativ = {
        du: attach(ov.du, restPres, 1),
        ihr: attach(ov.ihr, restPres, 4),
        wir: [ov.wir.split(" ")[0], "wir", substitute(restPres,3)].filter(Boolean).join(" "),
        Sie: [ov.wir.split(" ")[0], "Sie", substitute(restPres,5)].filter(Boolean).join(" ")
      };
    }
  } else if (!isModal) {
    const presStem = stemExtractPres(coreErPres);
    let duForms;
    const deUml = deUmlaut(presStem);
    if (deUml === unchangedStemFull && presStem !== unchangedStemFull) {
      duForms = [unchangedStemFull, unchangedStemFull+"e"];
    } else if (presStem !== unchangedStemFull) {
      duForms = [presStem];
    } else {
      if (needsEpenthesis(unchangedStemFull)) duForms = [unchangedStemFull+"e"];
      else duForms = [unchangedStemFull, unchangedStemFull+"e"];
    }
    const duRest = substitute(restPres, 1);
    const duStr = duForms.join("/") + (duRest ? " " + duRest : "");
    const ihrStr = attach(ihrFromUnchangedStem(unchangedStemFull), restPres, 4);
    const wirStr = [unchangedStemFull+"en", "wir", substitute(restPres,3)].filter(Boolean).join(" ");
    const sieStr = [unchangedStemFull+"en", "Sie", substitute(restPres,5)].filter(Boolean).join(" ");
    imperativ = { du: duStr, ihr: ihrStr, wir: wirStr, Sie: sieStr };
  }

  let partizipPraesens;
  if (PARTIZIP1_OVERRIDE[v.inf]) partizipPraesens = PARTIZIP1_OVERRIDE[v.inf];
  else if (reflexive) {
    const extra = restPres.filter(t => t !== "sich").join(" ");
    partizipPraesens = "sich " + (extra ? extra + " " : "") + unchangedStemFull + "end";
  } else {
    partizipPraesens = infCore + "d";
  }

  return {
    praesens, perfekt, praeteritum, plusq, futurI, futurII,
    konjIPraesens, konjIPerfekt, konjIIPraeteritum, konjIIPlusq, konjFuturI, konjFuturII,
    imperativ, partizipPraesens, partizipPerfekt: participle
  };
}

/* ---------- NORMALIZZAZIONE IN UN UNICO ARRAY ---------- */

let uid = 0;
const ENTRIES = [];

VERBI.forEach(v => {
  ENTRIES.push({
    id: "v"+(uid++), type: "verbo",
    de: v.inf, it: v.it, en: v.en, catLabel: v.cat,
    fields: [ ["Präsens", v.pres], ["Präteritum", v.pra], ["Perfekt", v.perf] ],
    rows: [], enRows: [],
    note: v.note, enNote: v.enNote,
    ex: v.ex, enEx: v.enex,
    raw: v
  });
});

SOSTANTIVI.forEach(s => {
  ENTRIES.push({
    id: "s"+(uid++), type: "sostantivo",
    de: s.de, it: s.it, en: s.en, catLabel: s.cat,
    fields: [ ["Articolo", s.de.split(" ")[0]], ["Plurale", s.pl] ],
    rows: [], enRows: [],
    note: "", enNote: "",
    ex: s.ex, enEx: s.enex
  });
});

AGGETTIVI.forEach(a => {
  ENTRIES.push({
    id: "a"+(uid++), type: "aggettivo",
    de: a.de, it: a.it, en: a.en, catLabel: a.cat,
    fields: [ ["Comparativo", a.comp], ["Superlativo", a.sup], ["Contrario", a.opp] ],
    rows: [], enRows: [],
    note: "", enNote: "",
    ex: [], enEx: []
  });
});

GRAMMATICA.forEach(g => {
  ENTRIES.push({
    id: "g"+(uid++), type: "grammatica",
    de: g.de, it: g.it, en: g.en, catLabel: g.cat,
    fields: [],
    rows: g.rows, enRows: g.enRows,
    note: g.note, enNote: g.enNote,
    ex: g.ex, enEx: g.enEx
  });
});

FRASI.forEach(([de, it, en]) => {
  ENTRIES.push({
    id: "f"+(uid++), type: "frase",
    de: de, it: it, en: en, catLabel: "frase utile",
    fields: [], rows: [], enRows: [],
    note: "", enNote: "",
    ex: [], enEx: []
  });
});

DETTI.forEach(([de, it, lit, en, enLit]) => {
  ENTRIES.push({
    id: "d"+(uid++), type: "detto",
    de: de, it: it, en: en, catLabel: "detto",
    fields: [], rows: [], enRows: [],
    note: lit, enNote: enLit,
    ex: [], enEx: []
  });
});

/* ---------- LINGUA (IT / EN) ---------- */

let lang = localStorage.getItem("wortabolario_lang") || "it";

const CAT_EN = {
  "casa":"home", "lavoro":"work", "famiglia":"family", "città":"city", "varie":"miscellaneous",
  "cibo":"food", "salute":"health", "corpo":"body", "arte":"art", "scuola":"school",
  "ausiliare":"auxiliary", "modale":"modal", "movimento":"motion", "percezione":"perception",
  "comunicazione":"communication", "quotidiano":"everyday", "mentale":"mental", "posizione":"position",
  "riflessivo":"reflexive", "aggettivo":"adjective", "avverbio":"adverb",
  "casi":"cases", "pronomi":"pronouns", "reggenza":"verb government", "sintassi":"syntax",
  "verbi con preposizione":"verbs with prepositions",
  "tempi verbali":"verb tenses", "connettori":"connectors", "aggettivi":"adjectives",
  "modali":"modal verbs", "preposizioni":"prepositions", "verbi":"verbs",
  "frase utile":"useful phrase", "detto":"saying"
};

const FIELD_LABELS_EN = { "Articolo":"Article", "Plurale":"Plural", "Comparativo":"Comparative", "Superlativo":"Superlative", "Contrario":"Opposite" };

function trCat(cat){ return lang === "en" ? (CAT_EN[cat] || cat) : cat; }
function trFieldLabel(label){ return lang === "en" ? (FIELD_LABELS_EN[label] || label) : label; }

function L(e){
  if(lang === "en"){
    return { it: e.en || e.it, fields: e.fields, rows: e.enRows, note: e.enNote, ex: e.enEx, catLabel: trCat(e.catLabel) };
  }
  return { it: e.it, fields: e.fields, rows: e.rows, note: e.note, ex: e.ex, catLabel: e.catLabel };
}

const UI_STRINGS = {
  it: {
    subtitle: "Corso tedesco · vocabolario tedesco ↔ italiano — verbi, sostantivi, aggettivi, grammatica",
    placeholder: "Cerca in tedesco o in italiano… (es. 'Wohnung', 'appartamento', 'helfen')",
    clearAria: "Cancella ricerca",
    today: "Oggi",
    cardsOfDay: "Le carte del giorno",
    cardVerbo: "Verbo del giorno", cardParola: "Parola del giorno", cardFrase: "Frase del giorno", cardDetto: "Detto del giorno",
    countSuffix: " voci",
    emptyPrefix: "Nessuna voce trovata per \"", emptySuffix: "\".",
    conjBtn: "Tutte le coniugazioni", conjTitle: "Coniugazione completa", conjClose: "Chiudi", conjNoImperativ: "I verbi modali non hanno un imperativo naturale in tedesco moderno.",
    favAria: "Aggiungi ai preferiti", favAriaOn: "Rimuovi dai preferiti", favChip: "Preferiti",
    learnedTag: "imparata",
    recentTitle: "Riprendi da dove eri",
    progressLabel: (n, tot) => `Hai imparato ${n} ${n===1?"parola":"parole"} su ${tot}`,
    reviewBtn: "Ripassa con le flashcard",
    flashTitle: "Flashcard", flashTap: "Tocca la carta per vedere la traduzione",
    flashKnow: "La sapevo", flashDont: "Da ripassare",
    flashEmpty: "Nessuna carta da ripassare in questa selezione. Aggiungi qualche preferito o cambia filtro!",
    flashDoneTitle: "Ripasso completato!",
    flashDoneMsg: (ok, ko) => `${ok} ${ok===1?"parola saputa":"parole sapute"} · ${ko} da rivedere`,
    flashRestart: "Ricomincia", flashCloseBtn: "Chiudi",
    flashSrcFav: "solo preferiti", flashSrcAll: "tutte le voci",
    dueBtn: (n) => `Da ripassare oggi (${n})`,
    dueAllDone: "Nessuna parola in scadenza oggi — ottimo!",
    /* Sostituisce i 5 pallini ●○○○○ sul retro della flashcard: sembravano
       l'indicatore di un carosello e il loro senso non era leggibile. */
    srsInfo: (lv, giorni) => `Livello ${lv} di 5 · ` + (
      giorni <= 0 ? "da ripassare oggi"
      : giorni === 1 ? "la rivedrai domani"
      : `la rivedrai tra ${giorni} giorni`),
    speakAria: "Ascolta la pronuncia",
    genusBtn: "der · die · das",
    genusTitle: "Quiz: der, die o das?",
    genusPrompt: "Scegli l'articolo giusto",
    genusPlural: "Plurale",
    genusDoneTitle: "Quiz finito!",
    genusDoneMsg: (ok, tot) => `${ok} su ${tot} corretti`,
    genusPerfect: "Perfetto! Genere di ferro.",
    genusGood: "Bene! Le sbagliate finiscono nel ripasso.",
    genusMeh: "Il genere si impara col colore: riprova!",
    bignamiLink: (p) => `Scheda nel Bignami (pag. ${p})`,
    sortOrig: "Ordine originale", sortAZ: "A → Z", sortZA: "Z → A",
    tabHome: "Casa", tabSearch: "Cerca", tabPractice: "Esercizi", tabFavs: "Preferiti",
    streakTitle: "Giorni di studio consecutivi",
    streakLabel: (n) => `${n} ${n===1?"giorno":"giorni"} di fila`,
    streakStart: "Studia oggi per iniziare la serie!",
    exTitle: "Allenati",
    exDue: "Ripasso di oggi",
    exDueDesc: (n) => n > 0 ? `${n} ${n===1?"parola":"parole"} in scadenza` : "Tutto fatto per oggi",
    exFlash: "Flashcard", exFlashDesc: "Carte DE ↔ IT con ripetizione spaziata",
    exGenus: "der · die · das", exGenusDesc: "Indovina l'articolo giusto",
    exConj: "Coniugazione", exConjDesc: "Scrivi tu la forma verbale richiesta",
    exWww: "wurde · würde · werden", exWwwDesc: "Scegli la forma giusta nella frase",
    wwTitle: "Quiz: wurde, würde o werden?",
    wwPrompt: "Completa la frase con la forma giusta",
    wwPerfect: "Perfetto! Fatti, ipotesi e futuro sono al loro posto.",
    wwGood: "Bene! Le sbagliate finiscono nel ripasso.",
    wwMeh: "Ricorda il trucco dell'Umlaut e riprova!",
    backupTitle: "I tuoi progressi", backupHint: "Esporta un backup di preferiti, parole imparate e ripassi, o importalo su un altro dispositivo.",
    backupExport: "Esporta", backupImport: "Importa",
    importOk: "Progressi importati! L'app ora si ricarica.",
    importErr: "File non valido: scegli un backup esportato da Wortabolario.",
    cqTitle: "Quiz di coniugazione",
    cqPrompt: (tense, person) => `Scrivi il <b>${tense}</b> per <b>${person}</b>`,
    cqPlaceholder: "Scrivi la forma…",
    cqCheck: "Controlla", cqNext: "Avanti →", cqSkip: "Non lo so", quizBack: "← Indietro",
    cqRight: "Giusto!", cqWrongIs: "La forma giusta è",
    cqDoneTitle: "Quiz finito!", cqDoneMsg: (ok, tot) => `${ok} su ${tot} corrette`,
    cqPerfect: "Perfetto! Coniugazioni di ferro.",
    cqGood: "Bene! Le sbagliate finiscono nel ripasso.",
    cqMeh: "Le coniugazioni si domano con la pratica: riprova!",
    emptyFavs: "Non hai ancora preferiti. Tocca la stella accanto a una parola per salvarla qui.",
    footer: "Voci di grammatica e verbi tratte dai PDF della cartella \"Corso tedesco B1-1\" (Präteritum, verbi riflessivi, Futur, TEKAMOLO, i 4 casi, Relativpronomen, Plusquamperfekt, Nebensatz mit nachdem, Infinitiv als Nomen), integrate con vocabolario generale di livello B1, con la lista verbi forti di <a href=\"https://deutschlernerblog.de\" target=\"_blank\" rel=\"noopener\">deutschlernerblog.de</a> e verificate su <a href=\"https://dict.leo.org/tedesco-italiano/\" target=\"_blank\" rel=\"noopener\">dict.leo.org</a>, <a href=\"https://it.langenscheidt.com/tedesco-italiano/\" target=\"_blank\" rel=\"noopener\">Langenscheidt</a> e <a href=\"https://it.pons.com/traduzione\" target=\"_blank\" rel=\"noopener\">PONS</a>. Per approfondimenti: <a href=\"https://www.duden.de/\" target=\"_blank\" rel=\"noopener\">Duden</a>."
  },
  en: {
    subtitle: "German course · German ↔ English vocabulary — verbs, nouns, adjectives, grammar",
    placeholder: "Search in German or English… (e.g. 'Wohnung', 'apartment', 'helfen')",
    clearAria: "Clear search",
    today: "Today",
    cardsOfDay: "Cards of the day",
    cardVerbo: "Verb of the day", cardParola: "Word of the day", cardFrase: "Phrase of the day", cardDetto: "Saying of the day",
    countSuffix: " entries",
    emptyPrefix: "No entry found for \"", emptySuffix: "\".",
    conjBtn: "All conjugations", conjTitle: "Full conjugation", conjClose: "Close", conjNoImperativ: "Modal verbs have no natural imperative in modern German.",
    favAria: "Add to favourites", favAriaOn: "Remove from favourites", favChip: "Favourites",
    learnedTag: "learned",
    recentTitle: "Pick up where you left off",
    progressLabel: (n, tot) => `You have learned ${n} ${n===1?"word":"words"} out of ${tot}`,
    reviewBtn: "Review with flashcards",
    flashTitle: "Flashcards", flashTap: "Tap the card to see the translation",
    flashKnow: "I knew it", flashDont: "Review again",
    flashEmpty: "No cards to review in this selection. Add some favourites or change the filter!",
    flashDoneTitle: "Review complete!",
    flashDoneMsg: (ok, ko) => `${ok} ${ok===1?"word known":"words known"} · ${ko} to review`,
    flashRestart: "Restart", flashCloseBtn: "Close",
    flashSrcFav: "favourites only", flashSrcAll: "all entries",
    dueBtn: (n) => `Due today (${n})`,
    dueAllDone: "No words due today — great job!",
    srsInfo: (lv, days) => `Level ${lv} of 5 · ` + (
      days <= 0 ? "due for review today"
      : days === 1 ? "you'll see it again tomorrow"
      : `you'll see it again in ${days} days`),
    speakAria: "Hear the pronunciation",
    genusBtn: "der · die · das",
    genusTitle: "Quiz: der, die or das?",
    genusPrompt: "Pick the right article",
    genusPlural: "Plural",
    genusDoneTitle: "Quiz finished!",
    genusDoneMsg: (ok, tot) => `${ok} out of ${tot} correct`,
    genusPerfect: "Perfect! Rock-solid genders.",
    genusGood: "Nice! Missed ones go into your review pile.",
    genusMeh: "Gender sticks with colour — try again!",
    bignamiLink: (p) => `See the Bignami sheet (p. ${p})`,
    sortOrig: "Original order", sortAZ: "A → Z", sortZA: "Z → A",
    tabHome: "Home", tabSearch: "Search", tabPractice: "Practice", tabFavs: "Favourites",
    streakTitle: "Consecutive study days",
    streakLabel: (n) => `${n} ${n===1?"day":"days"} in a row`,
    streakStart: "Study today to start your streak!",
    exTitle: "Practice",
    exDue: "Today's review",
    exDueDesc: (n) => n > 0 ? `${n} ${n===1?"word":"words"} due` : "All done for today",
    exFlash: "Flashcards", exFlashDesc: "DE ↔ EN cards with spaced repetition",
    exGenus: "der · die · das", exGenusDesc: "Guess the right article",
    exConj: "Conjugation", exConjDesc: "Type the requested verb form yourself",
    exWww: "wurde · würde · werden", exWwwDesc: "Pick the right form in the sentence",
    wwTitle: "Quiz: wurde, würde or werden?",
    wwPrompt: "Complete the sentence with the right form",
    wwPerfect: "Perfect! Facts, hypotheses and future all in place.",
    wwGood: "Well done! Wrong ones go to review.",
    wwMeh: "Remember the umlaut trick and try again!",
    backupTitle: "Your progress", backupHint: "Export a backup of favourites, learned words and reviews, or import it on another device.",
    backupExport: "Export", backupImport: "Import",
    importOk: "Progress imported! The app will now reload.",
    importErr: "Invalid file: choose a backup exported from Wortabolario.",
    cqTitle: "Conjugation quiz",
    cqPrompt: (tense, person) => `Type the <b>${tense}</b> for <b>${person}</b>`,
    cqPlaceholder: "Type the form…",
    cqCheck: "Check", cqNext: "Next →", cqSkip: "I don't know", quizBack: "← Back",
    cqRight: "Correct!", cqWrongIs: "The right form is",
    cqDoneTitle: "Quiz finished!", cqDoneMsg: (ok, tot) => `${ok} out of ${tot} correct`,
    cqPerfect: "Perfect! Rock-solid conjugations.",
    cqGood: "Nice! Missed ones go into your review pile.",
    cqMeh: "Conjugations yield to practice — try again!",
    emptyFavs: "No favourites yet. Tap the star next to a word to save it here.",
    footer: "Grammar and verb entries drawn from the PDFs in the \"Corso tedesco B1-1\" folder (Präteritum, reflexive verbs, Futur, TEKAMOLO, the 4 cases, Relativpronomen, Plusquamperfekt, nachdem-clauses, Infinitiv als Nomen), combined with general B1-level vocabulary, with the strong-verb list from <a href=\"https://deutschlernerblog.de\" target=\"_blank\" rel=\"noopener\">deutschlernerblog.de</a> and checked against <a href=\"https://dict.leo.org/tedesco-italiano/\" target=\"_blank\" rel=\"noopener\">dict.leo.org</a>, <a href=\"https://it.langenscheidt.com/tedesco-italiano/\" target=\"_blank\" rel=\"noopener\">Langenscheidt</a> and <a href=\"https://it.pons.com/traduzione\" target=\"_blank\" rel=\"noopener\">PONS</a>. For further reading: <a href=\"https://www.duden.de/\" target=\"_blank\" rel=\"noopener\">Duden</a>."
  }
};

function applyStaticStrings(){
  const s = UI_STRINGS[lang];
  document.getElementById("subTitle").textContent = s.subtitle;
  searchEl().placeholder = s.placeholder;
  document.getElementById("clearBtn").setAttribute("aria-label", s.clearAria);
  document.getElementById("footerNote").innerHTML = s.footer;
  const verEl = document.getElementById("appVersion");
  if(verEl && typeof APP_VERSION !== "undefined") verEl.textContent = "Wortabolario " + APP_VERSION;
  document.documentElement.lang = lang;
  document.querySelectorAll(".lang-toggle .lang-opt").forEach(el=>{
    el.classList.toggle("active", el.dataset.lang === lang);
  });
  const conjCloseBtn = document.getElementById("conjClose");
  if(conjCloseBtn) conjCloseBtn.setAttribute("aria-label", s.conjClose);
  const cqCloseBtn = document.getElementById("cqClose");
  if(cqCloseBtn) cqCloseBtn.setAttribute("aria-label", s.conjClose);
  document.querySelectorAll(".tabbar .tab-lb").forEach(el => {
    if(s[el.dataset.tl]) el.textContent = s[el.dataset.tl];
  });
}

/* ---------- TEMA (chiaro / scuro) ---------- */

/* Default: segue il tema del sistema (chiaro/scuro); la scelta manuale lo sovrascrive. */
let theme = localStorage.getItem("wortabolario_theme") ||
  (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");

function applyTheme(){
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute("content", theme === "dark" ? "#10141c" : "#1b2340");
  document.querySelectorAll(".theme-toggle .lang-opt").forEach(el=>{
    el.classList.toggle("active", el.dataset.theme === theme);
  });
}

/* ---------- STATO UI ---------- */

let activeType = "tutti";
const TYPE_LABELS_IT = { tutti:"Tutti", verbo:"Verbi", sostantivo:"Sostantivi", aggettivo:"Aggettivi", grammatica:"Grammatica", frase:"Frasi", detto:"Detti" };
const TYPE_LABELS_EN = { tutti:"All", verbo:"Verbs", sostantivo:"Nouns", aggettivo:"Adjectives", grammatica:"Grammar", frase:"Phrases", detto:"Sayings" };
function TL(t){ return (lang === "en" ? TYPE_LABELS_EN : TYPE_LABELS_IT)[t]; }
const openIds = new Set();
let activeSuggestion = -1;
let sortMode = localStorage.getItem("wortabolario_sort") || "orig";

/* ---------- PREFERITI, IMPARATE, RECENTI (persistenti) ---------- */

function loadIdSet(key){
  try { return new Set(JSON.parse(localStorage.getItem(key) || "[]")); }
  catch(e){ return new Set(); }
}
const favIds = loadIdSet("wortabolario_favs");
const learnedIds = loadIdSet("wortabolario_learned");
function saveIdSet(key, set){ localStorage.setItem(key, JSON.stringify([...set])); }

let recentIds = [];
try { recentIds = JSON.parse(localStorage.getItem("wortabolario_recent") || "[]"); } catch(e){}
function pushRecent(id){
  recentIds = [id, ...recentIds.filter(x => x !== id)].slice(0, 8);
  localStorage.setItem("wortabolario_recent", JSON.stringify(recentIds));
}

function toggleFav(id){
  if(favIds.has(id)) favIds.delete(id); else favIds.add(id);
  saveIdSet("wortabolario_favs", favIds);
}
function setLearned(id, on){
  if(on) learnedIds.add(id); else learnedIds.delete(id);
  saveIdSet("wortabolario_learned", learnedIds);
}

/* ---------- SRS (ripetizione spaziata, sistema Leitner) ----------
   Ogni parola ha un livello 1-5. Se la sai, sale di livello e la rivedi
   più in là (1→3→7→21→60 giorni); se la sbagli torna a livello 0 e
   riappare subito tra le "da ripassare oggi". */

const SRS_INTERVALS = [1, 3, 7, 21, 60];
let srsData = {};
try { srsData = JSON.parse(localStorage.getItem("wortabolario_srs") || "{}"); } catch(e){}
function saveSrs(){ localStorage.setItem("wortabolario_srs", JSON.stringify(srsData)); }
function todayIdx(){ return Math.floor(Date.now() / 86400000); }

// migrazione: le parole già "imparate" prima dell'SRS partono da livello 1
let srsMigrated = false;
learnedIds.forEach(id => {
  if(!srsData[id]){ srsData[id] = { lv: 1, due: todayIdx() + 1 }; srsMigrated = true; }
});
if(srsMigrated) saveSrs();

function srsAnswer(id, ok){
  bumpStreak();   // ogni risposta conta come studio del giorno
  const cur = srsData[id] || { lv: 0, due: todayIdx() };
  if(ok){
    cur.lv = Math.min(cur.lv + 1, 5);
    cur.due = todayIdx() + SRS_INTERVALS[cur.lv - 1];
  } else {
    cur.lv = 0;
    cur.due = todayIdx();
  }
  srsData[id] = cur;
  saveSrs();
  setLearned(id, ok);
}
function dueEntries(){
  const t = todayIdx();
  return ENTRIES.filter(e => srsData[e.id] && srsData[e.id].due <= t);
}

/* ---------- STREAK (giorni di studio consecutivi) ----------
   Si incrementa al primo esercizio del giorno; se salti un giorno riparte da 1.
   È il meccanismo "non rompere la catena": motiva ad aprire l'app ogni giorno. */

let streak = { last: 0, count: 0 };
try { streak = JSON.parse(localStorage.getItem("wortabolario_streak") || '{"last":0,"count":0}'); } catch(e){}
function bumpStreak(){
  const t = todayIdx();
  if(streak.last === t) return;
  streak.count = (streak.last === t - 1) ? streak.count + 1 : 1;
  streak.last = t;
  localStorage.setItem("wortabolario_streak", JSON.stringify(streak));
}
function streakCount(){
  const t = todayIdx();
  // la serie è "viva" se hai studiato oggi o ieri; altrimenti è azzerata
  return (streak.last === t || streak.last === t - 1) ? streak.count : 0;
}

/* ---------- BACKUP: ESPORTA / IMPORTA PROGRESSI ----------
   Tutto lo stato vive in localStorage, che il browser può cancellare:
   il backup JSON protegge mesi di studio e permette il passaggio di dispositivo. */

const BACKUP_KEYS = ["wortabolario_favs","wortabolario_learned","wortabolario_recent","wortabolario_srs",
  "wortabolario_streak","wortabolario_lang","wortabolario_theme","wortabolario_sort","wortabolario_flashdir"];

function exportProgress(){
  const data = { app: "wortabolario", version: 3, date: new Date().toISOString() };
  BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if(v !== null) data[k] = v; });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "wortabolario-progressi-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function importProgress(file){
  const s = UI_STRINGS[lang];
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if(data.app !== "wortabolario") throw new Error("not a wortabolario backup");
      BACKUP_KEYS.forEach(k => { if(typeof data[k] === "string") localStorage.setItem(k, data[k]); });
      alert(s.importOk);
      location.reload();
    } catch(err){
      alert(s.importErr);
    }
  };
  reader.readAsText(file);
}

/* ---------- ICONE (stile SF Symbols) ----------
   Disegni a tratto su griglia 24×24, monocromi: ereditano il colore del testo
   con `currentColor`, quindi funzionano da soli in tema chiaro e scuro.
   Tratto 1.7 con terminali arrotondati, come le icone di sistema iOS. */

const ICONS = {
  home:    '<path d="M3.2 10.4 12 3.3l8.8 7.1"/><path d="M5.6 9.5V19a1.6 1.6 0 0 0 1.6 1.6h9.6A1.6 1.6 0 0 0 18.4 19V9.5"/><path d="M9.7 20.6v-5.2a1 1 0 0 1 1-1h2.6a1 1 0 0 1 1 1v5.2"/>',
  search:  '<circle cx="10.8" cy="10.8" r="6.6"/><path d="M15.6 15.6 20.8 20.8"/>',
  target:  '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="4.3"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
  star:     '<path d="m12 3.9 2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.92l-5.1 2.68.98-5.68L3.75 9.9l5.7-.83z"/>',
  starFill: '<path d="m12 3.9 2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.92l-5.1 2.68.98-5.68L3.75 9.9l5.7-.83z" fill="currentColor"/>',
  clock:   '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.1V12l3.1 1.9"/>',
  cards:   '<rect x="7.2" y="7.2" width="13.6" height="13.6" rx="3"/><path d="M17 4.2H6.2A2.9 2.9 0 0 0 3.3 7.1v10.6"/>',
  dice:    '<rect x="4" y="4" width="16" height="16" rx="4"/><circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none"/><circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none"/>',
  pencil:  '<path d="M4.6 19.4h3.5L19 8.9a2.05 2.05 0 0 0-2.9-2.9L5.5 16.5z"/><path d="m14.7 7.7 2.9 2.9"/>',
  speaker: '<path d="M4.2 9.4h3.1L11.4 6v12L7.3 14.6H4.2z"/><path d="M14.9 9.7a3.9 3.9 0 0 1 0 4.6"/><path d="M17.5 7.4a7.4 7.4 0 0 1 0 9.2"/>',
  chevron: '<path d="M9.7 5.6 16 12l-6.3 6.4"/>',
  arrowUp: '<path d="M12 19.6V5.2"/><path d="M5.9 11.3 12 5.2l6.1 6.1"/>',
  close:   '<path d="m6.6 6.6 10.8 10.8"/><path d="M17.4 6.6 6.6 17.4"/>',
  sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 2.9v2.2M12 18.9v2.2M21.1 12h-2.2M5.1 12H2.9M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"/>',
  moon:    '<path d="M20.3 14.7A8.6 8.6 0 1 1 9.3 3.7a6.9 6.9 0 0 0 11 11z"/>',
  export:  '<path d="M12 3.6v10.8"/><path d="M7.6 10 12 14.4 16.4 10"/><path d="M4.6 17.2v1.6a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-1.6"/>',
  import:  '<path d="M12 14.4V3.6"/><path d="M7.6 8 12 3.6 16.4 8"/><path d="M4.6 17.2v1.6a2 2 0 0 0 2 2h10.8a2 2 0 0 0 2-2v-1.6"/>',
  flame:   '<path d="M12 2.9c.5 3-1 4.5-2.4 5.9-1.3 1.3-2.5 2.7-2.5 4.9a5.4 5.4 0 0 0 10.8 0c0-2.2-1-3.6-2-4.7-.2 1-.8 1.7-1.6 1.9.4-3.1-1.2-6.2-2.3-8z"/>',
  book:    '<path d="M12 7.2v12.3"/><path d="M12 7.2C10.4 5.9 8.4 5.2 6.1 5.2H4v12.3h2.1c2.3 0 4.3.7 5.9 2"/><path d="M12 7.2c1.6-1.3 3.6-2 5.9-2H20v12.3h-2.1c-2.3 0-4.3.7-5.9 2"/>',
  check:   '<path d="m5.4 12.4 4.4 4.4 8.8-9.6"/>',
  rotate:  '<path d="M3.8 12a8.2 8.2 0 1 0 2.6-6"/><path d="M3.4 4.4v4.2h4.2"/>',
  checkSeal: '<circle cx="12" cy="12" r="8.4"/><path d="m8.2 12.2 2.7 2.7 5-5.4"/>',
};

/** Restituisce l'SVG di un'icona. `cls` aggiunge classi CSS per la dimensione. */
function ic(name, cls){
  const p = ICONS[name];
  if(!p) return "";
  return `<svg class="ic ${cls || ""}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${p}</svg>`;
}

/** Riempie gli elementi statici marcati con data-icon (tab bar, chiusure, temi). */
function paintStaticIcons(){
  document.querySelectorAll("[data-icon]").forEach(el => {
    if(el.dataset.iconDone) return;
    el.innerHTML = ic(el.dataset.icon);
    el.dataset.iconDone = "1";
  });
}

/* ---------- AUDIO (pronuncia tedesca via speechSynthesis) ---------- */

const canSpeak = typeof window !== "undefined" && "speechSynthesis" in window;
function speak(text){
  if(!canSpeak) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "de-DE";
  u.rate = 0.95;
  const deVoice = window.speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith("de"));
  if(deVoice) u.voice = deVoice;
  window.speechSynthesis.speak(u);
}
function speakBtnHtml(text, cls){
  if(!canSpeak) return "";
  const aria = (UI_STRINGS[lang] || UI_STRINGS.it).speakAria;
  return `<button type="button" class="speak-btn ${cls || ""}" data-say="${text.replace(/"/g, "&quot;")}" aria-label="${aria}" title="${aria}">${ic("speaker")}</button>`;
}
function bindSpeakBtns(root){
  (root || document).querySelectorAll(".speak-btn").forEach(b => {
    if(b.dataset.bound) return;
    b.dataset.bound = "1";
    b.addEventListener("click", (ev) => { ev.stopPropagation(); speak(b.dataset.say); });
  });
}

/* ---------- COLLEGAMENTO AL BIGNAMI (PDF, pagina per pagina) ---------- */

const BIGNAMI_PDF = "Grammatica_Tedesca_B1_Bignami.pdf";
const BIGNAMI_PDF_EN = "German_Grammar_B1_Bignami_EN.pdf";
/* Stesso layout e stessa numerazione di pagina in entrambe le lingue:
   BIGNAMI_PAGES vale per tutti e due i PDF. */
function bignamiPdf(){ return lang === "en" ? BIGNAMI_PDF_EN : BIGNAMI_PDF; }
const BIGNAMI_PAGES = {
  /* Sezione A · I casi e i pronomi (pp. 2-15) */
  "Interrogativpronomen": 2,
  "Der/die/das — Artikel nach Kasus": 3,
  "Personalpronomen nei casi": 3,
  "Possessivpronomen": 3,
  "Verben mit Dativ": 3,
  "Nominativ/Akkusativ/Dativ — il trucco": 4,
  "Relativpronomen": 5,
  "Infinitiv mit zu": 6,
  "Verbi modali: mai zu davanti all'infinito": 6,
  "Reflexivpronomen (Akk./Dat.)": 7,
  "Riflessivo + parte del corpo: mich o mir?": 7,
  "Adjektivdeklination — le desinenze": 8,
  "nicht brauchen zu": 9,
  "Indefinitpronomen": 10,
  "Infinitiv als Nomen": 11,
  "Adjektivendungen im Genitiv": 12,
  "Adjektive ohne Artikel — Nullartikel": 13,
  "Partizip I & II als Adjektiv": 14,
  "n-Deklination": 15,
  /* Sezione B · Preposizioni e verbi (pp. 16-21) */
  "Auf, über, als, mit, bei, zu": 16,
  "mit · zu · von — sempre dativo": 16,
  "Pronominaladverb: wo(r)+ / da(r)+": 17,
  "Verben mit Präpositionen": 18,
  "telefonieren mit vs. anrufen": 18,
  "Präposition + dass-Satz": 19,
  "sonst": 20,
  "Präpositionen mit Genitiv": 21,
  /* Sezione C · Congiunzioni e Nebensätze (pp. 22-32) */
  "Nebensatz mit bevor": 22,
  "um...zu / damit": 23,
  "nicht nur... sondern auch": 23,
  "Konjunktionaladverbien vs Subjunktionen": 24,
  "Connettori doppi": 24,
  "als / wenn / wann": 26,
  "seit/seitdem und bis": 26,
  "Verben mit doppelter Bedeutung": 27,
  "Coppie che si confondono: lernen · laufen · üben": 27,
  "Wenn das Komma die Bedeutung ändert": 28,
  "Nebensatz mit während": 29,
  "Nebensatz mit nachdem": 30,
  "entweder … oder": 31,
  "Relativsätze: Präposition, wo, was": 32,
  /* Sezione D · Tempi verbali (pp. 33-38) */
  "Präteritum: verbi forti, misti, irregolari": 33,
  "Futur I — werden + Infinitiv": 34,
  "Futur II": 34,
  "Konjunktiv II": 35,
  "Das Passiv": 36,
  "Plusquamperfekt": 37,
  "Passiv mit Modalverben": 38,
  /* Sezione E · Struttura della frase (pp. 39-41) */
  "Tekamolo": 39,
  "Komparativ & Superlativ": 40,
  "Comparativi irregolari: viel · gern · gut": 40,
  "Adjektivdeklination + Komparativ/Superlativ": 41,
  /* Sezione F · Luogo e direzione (pp. 42-43) */
  "Wohin? / Wo? — i nomi geografici": 42,
  "an · in · auf · zu/bei — dove vai / dove sei": 43,
  "am Montag · in der Nacht — le preposizioni di tempo": 43,
  /* Appendice (p. 44) */
  "wurde · würde · werden — le differenze": 44
};

/* ---------- SEZIONI DEL BIGNAMI (A-F) ----------
   La sezione si ricava dalla pagina del PDF: così la vista grammatica
   dell'app rispecchia l'indice del Bignami, con gli stessi colori. */
function bignamiSection(e){
  const p = BIGNAMI_PAGES[e.de];
  if(!p) return null;
  if(p <= 15) return "A";
  if(p <= 21) return "B";
  if(p <= 32) return "C";
  if(p <= 38) return "D";
  if(p <= 41) return "E";
  if(p <= 43) return "F";
  return "AP";
}
const SEC_ORDER = ["A","B","C","D","E","F","AP"];
const SEC_LABELS = {
  A: { it: "I casi e i pronomi",            en: "Cases and pronouns" },
  B: { it: "Preposizioni e verbi",          en: "Prepositions and verbs" },
  C: { it: "Congiunzioni e Nebensätze",     en: "Conjunctions and subordinate clauses" },
  D: { it: "Tempi verbali",                 en: "Verb tenses" },
  E: { it: "Struttura della frase",         en: "Sentence structure" },
  F: { it: "Luogo e direzione",             en: "Place and direction" },
  AP:{ it: "Appendice",                     en: "Appendix" }
};
/* Colore di sezione come nel PDF: A/E navy, B/F teal, C arancio, D prugna, Appendice ardesia */
const SEC_COLOR = { A: "a", B: "b", C: "c", D: "d", E: "a", F: "b", AP: "ap" };

/* Articolo colorato per genere (der/die/das) — aiuta a memorizzare il genere */
function genusChip(e){
  if(e.type !== "sostantivo") return null;
  const art = e.de.split(" ")[0].toLowerCase();
  if(art !== "der" && art !== "die" && art !== "das") return null;
  return { art, rest: e.de.slice(art.length + 1) };
}

const searchEl = () => document.getElementById("search");

function typeCount(t){
  if(t === "tutti") return ENTRIES.length;
  if(t === "preferiti") return favIds.size;
  return ENTRIES.filter(e => e.type === t).length;
}

function renderFilters(){
  const host = document.getElementById("typeFilters");
  const s = UI_STRINGS[lang];
  const types = ["tutti","verbo","sostantivo","aggettivo","grammatica","frase","detto"];
  const chips = types.map(t =>
    `<button class="chip ${activeType===t?'active':''}" data-t="${t}" aria-pressed="${activeType===t}">${TL(t)}<span class="chip-n">${typeCount(t)}</span></button>`
  );
  chips.push(`<button class="chip chip-fav ${activeType==='preferiti'?'active':''}" data-t="preferiti" aria-pressed="${activeType==='preferiti'}">${ic("star","ic-sm")}${s.favChip}<span class="chip-n">${favIds.size}</span></button>`);
  host.innerHTML = chips.join("") + `
    <select id="sortSel" aria-label="Ordinamento">
      <option value="orig" ${sortMode==='orig'?'selected':''}>${s.sortOrig}</option>
      <option value="az" ${sortMode==='az'?'selected':''}>${s.sortAZ}</option>
      <option value="za" ${sortMode==='za'?'selected':''}>${s.sortZA}</option>
    </select>`;
  host.querySelectorAll(".chip").forEach(b=>{
    b.addEventListener("click", ()=>{ activeType = b.dataset.t; renderFilters(); updateView(); });
  });
  document.getElementById("sortSel").addEventListener("change", (ev)=>{
    sortMode = ev.target.value;
    localStorage.setItem("wortabolario_sort", sortMode);
    updateView();
  });
}

/* Ricerca tollerante: normalizza gli umlaut (ü→u, ß→ss) e, se non trova nulla,
   accetta 1 errore di battitura (distanza di Levenshtein ≤ 1) sulle parole chiave. */
function normSearch(s){ return deUmlaut(s.toLowerCase()).replace(/ß/g, "ss"); }

function lev1(a, b){
  if(a === b) return true;
  const la = a.length, lb = b.length;
  if(Math.abs(la - lb) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while(i < la && j < lb){
    if(a[i] === b[j]){ i++; j++; continue; }
    if(++edits > 1) return false;
    if(la > lb) i++;
    else if(lb > la) j++;
    else { i++; j++; }
  }
  return edits + (la - i) + (lb - j) <= 1;
}

function matches(entry, q){
  if(!q) return true;
  const hay = [
    entry.de, entry.it, entry.en, entry.catLabel,
    ...entry.fields.map(f=>f[1]),
    ...entry.rows.map(r=>r[0]+" "+r[1]), ...entry.enRows.map(r=>r[0]+" "+r[1]),
    ...entry.ex.flat(), ...entry.enEx.flat()
  ].join(" ").toLowerCase();
  if(hay.includes(q)) return true;
  const nq = normSearch(q);
  if(normSearch(hay).includes(nq)) return true;
  if(nq.length < 4) return false;   // niente fuzzy su query cortissime: troppi falsi positivi
  return [entry.de, entry.it, entry.en || ""].join(" ").toLowerCase()
    .split(/[\s,.;:()'"!?\/–—-]+/)
    .some(w => w.length >= 3 && lev1(normSearch(w), nq));
}

function renderEntry(e){
  const t = L(e);
  const s = UI_STRINGS[lang];
  const isOpen = openIds.has(e.id);
  let fieldsHtml = "";
  if(t.fields.length){
    fieldsHtml = `<div class="fields">` + t.fields.filter(f=>f[1]).map(f=>`
      <div class="field"><span class="k">${trFieldLabel(f[0])}</span><b>${f[1]}</b></div>
    `).join("") + `</div>`;
  }
  let rowsHtml = "";
  if(t.rows.length){
    rowsHtml = `<div class="rows">` + t.rows.map(r=>`
      <div class="row"><div class="rk">${r[0]}</div><div class="rv">${r[1]}</div></div>
    `).join("") + `</div>`;
  }
  let exHtml = "";
  if(t.ex.length){
    exHtml = `<div class="examples">` + t.ex.map(pair=>`
      <div class="example"><div class="de-ex">${pair[0]}</div><div class="it-ex">${pair[1]}</div></div>
    `).join("") + `</div>`;
  }
  const noteHtml = t.note ? `<div class="note">${t.note}</div>` : "";
  const bigPage = e.type === "grammatica" ? BIGNAMI_PAGES[e.de] : null;
  const bignamiHtml = bigPage
    ? `<a class="bignami-link" href="${bignamiPdf()}#page=${bigPage}" target="_blank" rel="noopener">${ic("book","ic-sm")}${s.bignamiLink(bigPage)}</a>`
    : "";
  const conjBtnHtml = e.type === "verbo"
    ? `<button type="button" class="conj-btn" data-vid="${e.id}">${ic("pencil","ic-sm")}${UI_STRINGS[lang].conjBtn}</button>`
    : "";
  const g = genusChip(e);
  const deHtml = g
    ? `<span class="de"><span class="genus genus-${g.art}" title="${g.art === 'der' ? 'maschile' : g.art === 'die' ? 'femminile' : 'neutro'}">${g.art}</span> ${g.rest}</span>`
    : `<span class="de">${e.de}</span>`;
  const isFav = favIds.has(e.id);
  const isLearned = learnedIds.has(e.id);
  return `
    <div class="entry ${isOpen?'open':''}" data-id="${e.id}">
      <div class="entry-head">
        <div class="left">
          <span class="badge ${e.type}">${TL(e.type)}</span>
          ${deHtml}
          <span class="it">${t.it}</span>
          ${isLearned ? `<span class="learned-tag" title="${s.learnedTag}">${ic("check")}</span>` : ""}
        </div>
        ${e.type !== "grammatica" ? speakBtnHtml(e.de) : (canSpeak ? '<span class="icon-spacer" aria-hidden="true"></span>' : "")}
        <button type="button" class="fav-btn ${isFav?'on':''}" data-fid="${e.id}" aria-label="${isFav ? s.favAriaOn : s.favAria}" aria-pressed="${isFav}">${isFav ? ic("starFill") : ic("star")}</button>
        <span class="chev">${ic('chevron')}</span>
      </div>
      <div class="entry-body">
        ${fieldsHtml}
        ${rowsHtml}
        ${exHtml}
        ${noteHtml}
        ${bignamiHtml}
        ${conjBtnHtml}
      </div>
    </div>
  `;
}

/* ---------- PANNELLO "TUTTE LE CONIUGAZIONI" ---------- */

function conjRows(forms){
  return forms.map((f,i) => `<div class="conj-row"><span class="conj-p">${CONJ_PERSONS[i]}</span><span class="conj-f">${f}</span></div>`).join("");
}
function conjCard(label, forms){
  return `<div class="conj-card"><h4>${label}</h4>${conjRows(forms)}</div>`;
}
function conjImpRow(label, form){
  return form ? `<div class="conj-row"><span class="conj-p">${label}</span><span class="conj-f">${form}</span></div>` : "";
}

function renderConjugationPanel(entryId){
  const entry = ENTRIES.find(e => e.id === entryId);
  if(!entry || !entry.raw) return;
  const v = entry.raw;
  const meta = VERB_META[v.inf] || {};
  const p = buildParadigm(v, meta);
  const s = UI_STRINGS[lang];
  const t = L(entry);

  const body = document.getElementById("conjBody");
  body.innerHTML = `
    <div class="conj-verbhead">
      <span class="badge verbo">${TL("verbo")}</span>
      <span class="de">${v.inf}</span>
      <span class="it">${t.it}</span>
    </div>
    <section class="conj-section">
      <h3 class="conj-sectitle">Indikativ</h3>
      <div class="conj-grid">
        ${conjCard("Präsens", p.praesens)}
        ${conjCard("Perfekt", p.perfekt)}
        ${conjCard("Präteritum", p.praeteritum)}
        ${conjCard("Plusquamperfekt", p.plusq)}
        ${conjCard("Futur I", p.futurI)}
        ${conjCard("Futur II", p.futurII)}
      </div>
    </section>
    <section class="conj-section">
      <h3 class="conj-sectitle">Konjunktiv</h3>
      <div class="conj-grid">
        ${conjCard("Konjunktiv I – Präsens", p.konjIPraesens)}
        ${conjCard("Konjunktiv I – Perfekt", p.konjIPerfekt)}
        ${conjCard("Konjunktiv II – Präteritum", p.konjIIPraeteritum)}
        ${conjCard("Konjunktiv II – Plusquamperfekt", p.konjIIPlusq)}
        ${conjCard("Konjunktiv I/II – Futur I", p.konjFuturI)}
        ${conjCard("Konjunktiv I/II – Futur II", p.konjFuturII)}
      </div>
    </section>
    <section class="conj-section">
      <h3 class="conj-sectitle">Imperativ</h3>
      <div class="conj-grid">
        <div class="conj-card">
          <h4>Präsens</h4>
          ${p.imperativ ? [
            conjImpRow("(du)", p.imperativ.du),
            conjImpRow("(wir)", p.imperativ.wir),
            conjImpRow("(ihr)", p.imperativ.ihr),
            conjImpRow("(Sie)", p.imperativ.Sie)
          ].join("") : `<div class="conj-note">${s.conjNoImperativ}</div>`}
        </div>
      </div>
    </section>
    <section class="conj-section">
      <h3 class="conj-sectitle">Unpersönliche Zeiten</h3>
      <div class="conj-grid">
        <div class="conj-card"><h4>Partizip Präsens</h4><div class="conj-row"><span class="conj-f">${p.partizipPraesens}</span></div></div>
        <div class="conj-card"><h4>Partizip Perfekt</h4><div class="conj-row"><span class="conj-f">${p.partizipPerfekt}</span></div></div>
      </div>
    </section>
  `;
  document.getElementById("conjTitle").textContent = s.conjTitle + ": " + v.inf;
  document.getElementById("conjOverlay").classList.add("open");
  document.body.classList.add("conj-lock");
}

function closeConjPanel(){
  document.getElementById("conjOverlay").classList.remove("open");
  document.body.classList.remove("conj-lock");
}

function sortList(list){
  if(sortMode === "orig") return list;
  const key = e => e.de.replace(/^(der|die|das)\s+/i, "").toLowerCase();
  const sorted = [...list].sort((a,b) => key(a).localeCompare(key(b), "de"));
  return sortMode === "za" ? sorted.reverse() : sorted;
}

function renderResults(){
  const q = searchEl().value.trim().toLowerCase();
  const s = UI_STRINGS[lang];
  const type = resultsOverride || activeType;
  let list = ENTRIES.filter(e =>
    type === "tutti" ? true :
    type === "preferiti" ? favIds.has(e.id) :
    e.type === type);
  list = sortList(list.filter(e => matches(e, q)));
  document.getElementById("count").textContent = list.length + " / " + ENTRIES.length + s.countSuffix;
  const host = document.getElementById("results");
  if(list.length === 0){
    host.innerHTML = type === "preferiti" && !q
      ? `<div class="empty"><div class="empty-ic">${ic("star")}</div>${s.emptyFavs}</div>`
      : `<div class="empty"><div class="empty-ic">${ic("search")}</div>${s.emptyPrefix}${q}${s.emptySuffix}</div>`;
    return;
  }
  /* Vista grammatica senza ricerca: raggruppata per sezioni A-F come il Bignami */
  if(type === "grammatica" && !q){
    const bySec = {};
    list.forEach(e => { const k = bignamiSection(e) || "A"; (bySec[k] = bySec[k] || []).push(e); });
    host.innerHTML = SEC_ORDER.filter(k => bySec[k]).map(k => {
      const items = bySec[k].slice().sort((x,y) => (BIGNAMI_PAGES[x.de] || 99) - (BIGNAMI_PAGES[y.de] || 99));
      return `
      <section class="gsec-group gsec-group-${SEC_COLOR[k]}">
        <div class="gsec gsec-${SEC_COLOR[k]}">
          <span class="gsec-code">${k}</span>
          <span class="gsec-title">${SEC_LABELS[k][lang === "en" ? "en" : "it"]}</span>
          <span class="gsec-n">${items.length}</span>
        </div>
        ${items.map(renderEntry).join("")}
      </section>`;
    }).join("");
  } else {
    host.innerHTML = list.map(renderEntry).join("");
  }
  host.querySelectorAll(".entry-head").forEach(h=>{
    h.addEventListener("click", (ev)=>{
      if(ev.target.closest(".fav-btn")) return;
      const entryEl = h.closest(".entry");
      const id = entryEl.dataset.id;
      if(openIds.has(id)) openIds.delete(id); else { openIds.add(id); pushRecent(id); }
      entryEl.classList.toggle("open");
    });
  });
  host.querySelectorAll(".fav-btn").forEach(b=>{
    b.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      toggleFav(b.dataset.fid);
      const on = favIds.has(b.dataset.fid);
      b.classList.toggle("on", on);
      b.innerHTML = on ? ic("starFill") : ic("star");   // innerHTML: il contenuto è un SVG
      b.setAttribute("aria-pressed", on);
      b.setAttribute("aria-label", on ? s.favAriaOn : s.favAria);
      renderFilters();
      if(type === "preferiti" && !on) renderResults();
    });
  });
  bindSpeakBtns(host);
  host.querySelectorAll(".conj-btn").forEach(b=>{
    b.addEventListener("click", ()=>{ renderConjugationPanel(b.dataset.vid); });
  });
}

/* ---------- DATA DI OGGI, IN TEDESCO ---------- */

const WEEKDAYS_IT = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
const WEEKDAYS_EN = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const WEEKDAYS_DE = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const MONTHS_IT = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MONTHS_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

const DE_UNITS = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const DE_UNITS_STANDALONE = ["null","eins","zwei","drei","vier","fünf","sechs","sieben","acht","neun"];
const DE_TEENS = ["zehn","elf","zwölf","dreizehn","vierzehn","fünfzehn","sechzehn","siebzehn","achtzehn","neunzehn"];
const DE_TENS = ["", "", "zwanzig","dreißig","vierzig","fünfzig","sechzig","siebzig","achtzig","neunzig"];

function deTwoDigits(n){
  if(n < 10) return DE_UNITS_STANDALONE[n];
  if(n < 20) return DE_TEENS[n-10];
  const t = Math.floor(n/10), u = n%10;
  return u === 0 ? DE_TENS[t] : DE_UNITS[u] + "und" + DE_TENS[t];
}
function deThreeDigits(n){
  const h = Math.floor(n/100), rest = n%100;
  let s = h > 0 ? (h===1 ? "" : DE_UNITS[h]) + "hundert" : "";
  if(rest > 0) s += deTwoDigits(rest);
  return s || "null";
}
function germanNumberWord(n){
  if(n === 0) return "null";
  if(n < 100) return deTwoDigits(n);
  if(n < 1000) return deThreeDigits(n);
  const th = Math.floor(n/1000), rest = n%1000;
  let s = (th===1 ? "" : DE_UNITS[th]) + "tausend";
  if(rest > 0) s += deThreeDigits(rest);
  return s;
}
function capitalize(w){ return w.charAt(0).toUpperCase() + w.slice(1); }

function renderDateStrip(){
  const now = new Date();
  const wd = now.getDay(), day = now.getDate(), month = now.getMonth(), year = now.getFullYear();
  const WD = lang === "en" ? WEEKDAYS_EN : WEEKDAYS_IT;
  const MO = lang === "en" ? MONTHS_EN : MONTHS_IT;
  return `
    <div class="date-strip">
      <div class="date-cell">
        <div class="date-it">${WD[wd]}</div>
        <div class="date-de">${WEEKDAYS_DE[wd]}</div>
      </div>
      <div class="date-cell">
        <div class="date-it">${day}</div>
        <div class="date-de">${capitalize(germanNumberWord(day))}</div>
      </div>
      <div class="date-cell">
        <div class="date-it">${MO[month]}</div>
        <div class="date-de">${MONTHS_DE[month]}</div>
      </div>
      <div class="date-cell">
        <div class="date-it">${year}</div>
        <div class="date-de">${capitalize(germanNumberWord(year))}</div>
      </div>
    </div>
  `;
}

/* ---------- DASHBOARD "OGGI" ---------- */

function dayIndex(){ return Math.floor(Date.now() / 86400000); }

function pickOfDay(type, offset){
  const pool = ENTRIES.filter(e => e.type === type);
  if(pool.length === 0) return null;
  return pool[(dayIndex() + offset) % pool.length];
}

function renderHome(){
  const s = UI_STRINGS[lang];
  const verbo = pickOfDay("verbo", 0);
  const parolaPool = ENTRIES.filter(e => e.type === "sostantivo" || e.type === "aggettivo");
  const parola = parolaPool.length ? parolaPool[(dayIndex() + 17) % parolaPool.length] : null;
  const frase = pickOfDay("frase", 5);
  const detto = pickOfDay("detto", 11);

  const cards = [
    { label: s.cardVerbo, e: verbo },
    { label: s.cardParola, e: parola },
    { label: s.cardFrase, e: frase },
    { label: s.cardDetto, e: detto }
  ].filter(c => c.e);

  const host = document.getElementById("home");

  const nLearned = learnedIds.size, nTot = ENTRIES.length;
  const pct = nTot ? Math.round(nLearned / nTot * 100) : 0;
  const nDue = dueEntries().length;
  /* Card "Oggi": un unico pannello con ripasso del giorno, serie e "riprendi" —
     tutto ciò che serve per la sessione quotidiana in un posto solo. */
  const recents = recentIds.map(id => ENTRIES.find(e => e.id === id)).filter(Boolean);
  const progressHtml = `
    <div class="progress-card today-panel">
      <div class="progress-top">
        <span class="today-panel-title">${ic("sun","ic-sm")}${s.today}</span>
        <span class="streak-chip" title="${s.streakTitle}">${ic("flame","ic-sm")}${streakCount() > 0 ? s.streakLabel(streakCount()) : s.streakStart}</span>
      </div>
      <div class="progress-track" role="progressbar" aria-valuenow="${nLearned}" aria-valuemin="0" aria-valuemax="${nTot}">
        <div class="progress-fill" style="width:${Math.max(pct, nLearned > 0 ? 2 : 0)}%"></div>
      </div>
      <span class="progress-label">${s.progressLabel(nLearned, nTot)}</span>
      <div class="progress-actions">
        ${nDue > 0
          ? `<button type="button" class="review-btn due-btn" id="dueBtn">${ic("clock","ic-sm")}${s.dueBtn(nDue)}</button>`
          : `<span class="due-done">${ic("check","ic-sm")}${s.dueAllDone}</span>`}
      </div>
      ${recents.length ? `
      <div class="resume-row">
        <span class="resume-label">${s.recentTitle}</span>
        <div class="recent-strip">
          ${recents.map(e => `<button type="button" class="recent-chip" data-id="${e.id}"><span class="rc-de">${e.de}</span><span class="rc-it">${L(e).it}</span></button>`).join("")}
        </div>
      </div>` : ""}
    </div>`;

  host.innerHTML = `
    ${renderDateStrip()}
    ${progressHtml}
    <p class="eyebrow">${s.cardsOfDay}</p>
    <div class="today-grid">
      ${cards.map(c => {
        const t = L(c.e);
        return `
        <div class="today-card" data-id="${c.e.id}" tabindex="0" role="button" aria-label="${c.label}: ${c.e.de}">
          <div class="cardlabel">${c.label}</div>
          <span class="badge ${c.e.type}">${TL(c.e.type)}</span>
          <h3>${c.e.de}</h3>
          <div class="it">${t.it}</div>
          ${t.ex.length ? `<div class="extra">"${t.ex[0][0]}"</div>` : ""}
        </div>
      `;}).join("")}
    </div>
    <div class="backup-card">
      <div class="backup-info"><b>${s.backupTitle}</b><span>${s.backupHint}</span></div>
      <div class="backup-btns">
        <button type="button" id="expBtn">${ic("export","ic-sm")}${s.backupExport}</button>
        <button type="button" id="impBtn">${ic("import","ic-sm")}${s.backupImport}</button>
      </div>
    </div>
    <input type="file" id="impFile" accept=".json,application/json" hidden>
  `;
  host.querySelectorAll(".today-card").forEach(card => {
    const open = () => selectEntry(card.dataset.id);
    card.addEventListener("click", open);
    card.addEventListener("keydown", (ev) => { if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); open(); } });
  });
  host.querySelectorAll(".recent-chip").forEach(ch => {
    ch.addEventListener("click", () => selectEntry(ch.dataset.id));
  });
  const rb = document.getElementById("reviewBtn");
  if(rb) rb.addEventListener("click", () => openFlashcards());
  const db = document.getElementById("dueBtn");
  if(db) db.addEventListener("click", () => openFlashcards("due"));
  const gb = document.getElementById("genusBtn");
  if(gb) gb.addEventListener("click", () => openGenusQuiz());
  const eb = document.getElementById("expBtn");
  if(eb) eb.addEventListener("click", exportProgress);
  const ib = document.getElementById("impBtn"), inFile = document.getElementById("impFile");
  if(ib && inFile){
    ib.addEventListener("click", () => inFile.click());
    inFile.addEventListener("change", () => { if(inFile.files[0]) importProgress(inFile.files[0]); });
  }
}

/* ---------- NAVIGAZIONE A TAB (Casa · Cerca · Esercizi · Preferiti) ----------
   Ogni funzione è raggiungibile con un tap dal bordo inferiore (zona del pollice). */

let currentTab = "home";
let resultsOverride = null;   // la tab Preferiti forza il filtro senza toccare quello di Cerca

function renderExercises(){
  const s = UI_STRINGS[lang];
  const host = document.getElementById("exercises");
  const nDue = dueEntries().length;
  const cards = [
    { id: "exDue",   ic: "clock",  name: s.exDue,   desc: s.exDueDesc(nDue), cls: nDue > 0 ? "ex-hot" : "" },
    { id: "exFlash", ic: "cards",  name: s.exFlash, desc: s.exFlashDesc },
    { id: "exGenus", ic: "dice",   name: s.exGenus, desc: s.exGenusDesc },
    { id: "exConj",  ic: "pencil", name: s.exConj,  desc: s.exConjDesc },
    { id: "exWww",   ic: "book",   name: s.exWww,   desc: s.exWwwDesc }
  ];
  host.innerHTML = `
    <p class="eyebrow">${s.exTitle}</p>
    <div class="ex-grid">
      ${cards.map(c => `
        <button type="button" class="ex-card ${c.cls || ""}" id="${c.id}">
          <span class="ex-ic">${ic(c.ic)}</span>
          <span class="ex-name">${c.name}</span>
          <span class="ex-desc">${c.desc}</span>
        </button>`).join("")}
    </div>`;
  document.getElementById("exDue").addEventListener("click", () => openFlashcards("due"));
  document.getElementById("exFlash").addEventListener("click", () => openFlashcards());
  document.getElementById("exGenus").addEventListener("click", () => openGenusQuiz());
  document.getElementById("exConj").addEventListener("click", () => openConjQuiz());
  document.getElementById("exWww").addEventListener("click", () => openWwQuiz());
}

function setTab(t){
  currentTab = t;
  document.querySelectorAll(".tabbar .tab").forEach(b => {
    const on = b.dataset.tab === t;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on);
  });
  updateView();
  window.scrollTo({ top: 0 });
}

function updateView(){
  const showHome = currentTab === "home";
  const showEx = currentTab === "esercizi";
  const showSearch = currentTab === "cerca";
  const showFav = currentTab === "preferiti";
  document.getElementById("home").style.display = showHome ? "" : "none";
  document.getElementById("exercises").style.display = showEx ? "" : "none";
  document.querySelector(".searchbar").style.display = showSearch ? "" : "none";
  document.getElementById("typeFilters").style.display = showSearch ? "" : "none";
  document.getElementById("results").style.display = (showSearch || showFav) ? "" : "none";
  if(showHome) renderHome();
  if(showEx) renderExercises();
  if(showSearch){ resultsOverride = null; renderResults(); }
  if(showFav){ resultsOverride = "preferiti"; renderResults(); }
}

/* ---------- SUGGERIMENTI DI RICERCA (tendina) ---------- */

function rankEntries(q){
  const starts = [], rest = [];
  ENTRIES.forEach(e => {
    const de = e.de.toLowerCase(), it = e.it.toLowerCase(), en = (e.en||"").toLowerCase();
    if(de.startsWith(q) || it.startsWith(q) || en.startsWith(q)) starts.push(e);
    else if(matches(e, q)) rest.push(e);
  });
  return [...starts, ...rest].slice(0, 8);
}

function renderSuggestions(){
  const q = searchEl().value.trim().toLowerCase();
  const list = document.getElementById("suggestList");
  activeSuggestion = -1;
  if(!q){
    list.hidden = true; list.innerHTML = "";
    searchEl().setAttribute("aria-expanded", "false");
    return;
  }
  const items = rankEntries(q);
  if(items.length === 0){
    list.hidden = true; list.innerHTML = "";
    searchEl().setAttribute("aria-expanded", "false");
    return;
  }
  list.hidden = false;
  searchEl().setAttribute("aria-expanded", "true");
  list.innerHTML = items.map((e, i) => {
    const t = L(e);
    return `
    <div class="suggest-item" role="option" id="sugg-${i}" data-id="${e.id}">
      <span class="badge ${e.type}">${TL(e.type)}</span>
      <span class="sde">${e.de}</span>
      <span class="sit">${t.it}</span>
    </div>
  `;}).join("");
  list.querySelectorAll(".suggest-item").forEach(el => {
    el.addEventListener("mousedown", (ev) => { ev.preventDefault(); selectEntry(el.dataset.id); });
  });
}

function updateActiveSuggestion(items){
  items.forEach((el, i) => el.classList.toggle("active", i === activeSuggestion));
  if(activeSuggestion >= 0){
    searchEl().setAttribute("aria-activedescendant", items[activeSuggestion].id);
    items[activeSuggestion].scrollIntoView({ block: "nearest" });
  } else {
    searchEl().removeAttribute("aria-activedescendant");
  }
}

function closeSuggestions(){
  const list = document.getElementById("suggestList");
  list.hidden = true;
  searchEl().setAttribute("aria-expanded", "false");
  activeSuggestion = -1;
}

/* Selezione di una voce (da tendina, da scheda "Oggi", o da tastiera):
   porta l'utente dritto al risultato, senza fargli scorrere l'intera lista. */
function selectEntry(id){
  const e = ENTRIES.find(x => x.id === id);
  if(!e) return;
  searchEl().value = e.de;
  document.getElementById("clearBtn").hidden = false;
  closeSuggestions();
  activeType = "tutti";
  renderFilters();
  setTab("cerca");   // il dettaglio di una voce vive nella tab Cerca
  openIds.add(e.id);
  pushRecent(e.id);
  requestAnimationFrame(() => {
    const el = document.querySelector(`.entry[data-id="${id}"]`);
    if(el){
      el.classList.add("open");
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

/* ---------- EVENTI ---------- */

searchEl().addEventListener("input", () => {
  document.getElementById("clearBtn").hidden = searchEl().value.length === 0;
  renderSuggestions();
  updateView();
});

searchEl().addEventListener("focus", () => { if(searchEl().value.trim()) renderSuggestions(); });

searchEl().addEventListener("keydown", (ev) => {
  const list = document.getElementById("suggestList");
  if(list.hidden){
    return;
  }
  const items = Array.from(list.querySelectorAll(".suggest-item"));
  if(ev.key === "ArrowDown"){
    ev.preventDefault();
    activeSuggestion = Math.min(activeSuggestion + 1, items.length - 1);
    updateActiveSuggestion(items);
  } else if(ev.key === "ArrowUp"){
    ev.preventDefault();
    activeSuggestion = Math.max(activeSuggestion - 1, 0);
    updateActiveSuggestion(items);
  } else if(ev.key === "Enter"){
    if(activeSuggestion >= 0 && items[activeSuggestion]){
      ev.preventDefault();
      selectEntry(items[activeSuggestion].dataset.id);
    }
  } else if(ev.key === "Escape"){
    closeSuggestions();
  }
});

document.getElementById("clearBtn").addEventListener("click", () => {
  searchEl().value = "";
  document.getElementById("clearBtn").hidden = true;
  closeSuggestions();
  updateView();
  searchEl().focus();
});

document.addEventListener("click", (ev) => {
  const wrap = document.querySelector(".search-input-wrap");
  if(wrap && !wrap.contains(ev.target)) closeSuggestions();
});

document.getElementById("langToggle").addEventListener("click", () => {
  lang = lang === "it" ? "en" : "it";
  localStorage.setItem("wortabolario_lang", lang);
  applyStaticStrings();
  renderFilters();
  renderHome();
  updateView();
  if(searchEl().value.trim()) renderSuggestions();
});

document.getElementById("themeToggle").addEventListener("click", () => {
  theme = theme === "light" ? "dark" : "light";
  localStorage.setItem("wortabolario_theme", theme);
  applyTheme();
});

document.getElementById("conjClose").addEventListener("click", closeConjPanel);
document.getElementById("conjOverlay").addEventListener("click", (ev) => {
  if(ev.target.id === "conjOverlay") closeConjPanel();
});
document.addEventListener("keydown", (ev) => {
  if(ev.key === "Escape" && document.getElementById("conjOverlay").classList.contains("open")) closeConjPanel();
});

/* ---------- FLASHCARD (ripasso attivo) ---------- */

let flashDeck = [], flashIdx = 0, flashOk = 0, flashKo = 0, flashFlipped = false, flashSource = "auto";
/* Direzione: "deit" = riconoscimento (vedi il tedesco), "itde" = produzione (vedi la traduzione,
   devi ricordare il tedesco) — più difficile e più efficace per fissare le parole. */
let flashDir = localStorage.getItem("wortabolario_flashdir") || "deit";

function buildDeck(){
  let pool;
  if(flashSource === "due"){
    pool = dueEntries();
  } else if(flashSource === "fav" || (flashSource === "auto" && activeType === "preferiti")){
    pool = ENTRIES.filter(e => favIds.has(e.id));
    flashSource = "fav";
  } else {
    pool = ENTRIES.filter(e => activeType === "tutti" || activeType === "preferiti" || e.type === activeType);
    flashSource = "all";
  }
  // prima le non imparate, poi mescola (ma nel mazzo "da ripassare" contano tutte)
  if(flashSource !== "due"){
    const fresh = pool.filter(e => !learnedIds.has(e.id));
    pool = fresh.length >= 5 ? fresh : pool;
  }
  const deck = [...pool];
  for(let i = deck.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.slice(0, 20);
}

function openFlashcards(src){
  flashSource = src || "auto";
  flashDeck = buildDeck();
  flashIdx = 0; flashOk = 0; flashKo = 0; flashFlipped = false;
  document.getElementById("flashOverlay").classList.add("open");
  document.body.classList.add("conj-lock");
  renderFlash();
}
function closeFlashcards(){
  document.getElementById("flashOverlay").classList.remove("open");
  document.body.classList.remove("conj-lock");
  renderFilters();
  updateView();
}

function renderFlash(){
  const s = UI_STRINGS[lang];
  const body = document.getElementById("flashBody");
  document.getElementById("flashTitle").textContent = s.flashTitle +
    (flashDeck.length ? ` · ${Math.min(flashIdx + 1, flashDeck.length)} / ${flashDeck.length}` : "");

  if(flashDeck.length === 0){
    body.innerHTML = `<div class="empty"><div class="empty-ic">${ic("cards")}</div>${s.flashEmpty}</div>`;
    return;
  }
  if(flashIdx >= flashDeck.length){
    body.innerHTML = `
      <div class="flash-done">
        <div class="flash-done-ic">${ic("checkSeal")}</div>
        <h3>${s.flashDoneTitle}</h3>
        <p>${s.flashDoneMsg(flashOk, flashKo)}</p>
        <div class="flash-actions">
          <button type="button" class="conj-btn" id="flashRestart">${s.flashRestart}</button>
          <button type="button" class="flash-secondary" id="flashEnd">${s.flashCloseBtn}</button>
        </div>
      </div>`;
    document.getElementById("flashRestart").addEventListener("click", () => openFlashcards(flashSource));
    document.getElementById("flashEnd").addEventListener("click", closeFlashcards);
    return;
  }

  const e = flashDeck[flashIdx];
  const t = L(e);
  const g = genusChip(e);
  const deHtml = g ? `<span class="genus genus-${g.art}">${g.art}</span> ${g.rest}` : e.de;
  const backExtra = t.ex && t.ex.length ? `<div class="flash-ex">"${t.ex[0][0]}"<br><span>${t.ex[0][1]}</span></div>` : "";

  // direzione: cosa mostra il fronte e cosa il retro
  const trLabel = lang === "en" ? "EN" : "IT";
  const spk = speakBtnHtml(e.de, "flash-speak");
  /* Stato del ripasso a intervalli, in chiaro. Solo per le parole già
     incontrate: su una parola nuova non c'è ancora niente da dire. */
  const srs = srsData[e.id];
  const lv = (srs && srs.lv) || 0;
  const lvHtml = lv > 0
    ? `<div class="srs-lv">${ic("clock", "ic-sm")}${s.srsInfo(lv, (srs.due || 0) - todayIdx())}</div>`
    : "";
  const front = flashDir === "deit"
    ? `<div class="flash-word">${deHtml}</div>${spk}`
    : `<div class="flash-word flash-word-tr">${t.it}</div>`;
  const back = flashDir === "deit"
    ? `<div class="flash-word-sm">${e.de}</div><div class="flash-tr">${t.it}</div>${backExtra}${lvHtml}`
    : `<div class="flash-word-sm">${t.it}</div><div class="flash-tr flash-tr-de">${deHtml}</div>${spk}${backExtra}${lvHtml}`;

  body.innerHTML = `
    <div class="flash-topbar">
      <div class="flash-progress"><div class="flash-progress-fill" style="width:${(flashIdx / flashDeck.length) * 100}%"></div></div>
      <div class="flash-dir" id="flashDir" role="group" aria-label="Direzione flashcard">
        <button type="button" class="flash-dir-opt ${flashDir==='deit'?'active':''}" data-dir="deit" aria-pressed="${flashDir==='deit'}">DE → ${trLabel}</button>
        <button type="button" class="flash-dir-opt ${flashDir==='itde'?'active':''}" data-dir="itde" aria-pressed="${flashDir==='itde'}">${trLabel} → DE</button>
      </div>
    </div>
    <div class="flash-card ${flashFlipped ? 'flipped' : ''}" id="flashCard" tabindex="0" role="button" aria-label="${s.flashTap}">
      <div class="flash-inner">
        <div class="flash-face flash-front">
          <span class="badge ${e.type}">${TL(e.type)}</span>
          ${front}
          <div class="flash-hint">${s.flashTap}</div>
        </div>
        <div class="flash-face flash-back">
          ${back}
        </div>
      </div>
    </div>
    <div class="flash-actions ${flashFlipped ? '' : 'hidden'}">
      <button type="button" class="flash-btn flash-no" id="flashNo">${ic("rotate","ic-sm")}${s.flashDont}</button>
      <button type="button" class="flash-btn flash-yes" id="flashYes">${ic("check","ic-sm")}${s.flashKnow}</button>
    </div>`;

  document.querySelectorAll("#flashDir .flash-dir-opt").forEach(b => {
    b.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if(b.dataset.dir === flashDir) return;
      flashDir = b.dataset.dir;
      localStorage.setItem("wortabolario_flashdir", flashDir);
      flashFlipped = false;
      renderFlash();
    });
  });

  bindSpeakBtns(body);
  const card = document.getElementById("flashCard");
  const flip = (ev) => {
    if(ev && ev.target && ev.target.closest(".speak-btn")) return;
    flashFlipped = !flashFlipped; renderFlash();
  };
  card.addEventListener("click", flip);
  card.addEventListener("keydown", (ev) => { if(ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); flip(); } });

  const nyes = document.getElementById("flashYes"), nno = document.getElementById("flashNo");
  if(nyes) nyes.addEventListener("click", () => {
    srsAnswer(e.id, true); flashOk++;      // SRS: sale di livello, la rivedrai più in là
    flashIdx++; flashFlipped = false; renderFlash();
  });
  if(nno) nno.addEventListener("click", () => {
    srsAnswer(e.id, false); flashKo++;     // SRS: torna a livello 0, in scadenza oggi
    flashDeck.push(e); // la carta torna in fondo al mazzo
    flashIdx++; flashFlipped = false; renderFlash();
  });
}

document.getElementById("flashClose").addEventListener("click", closeFlashcards);
document.getElementById("flashOverlay").addEventListener("click", (ev) => {
  if(ev.target.id === "flashOverlay") closeFlashcards();
});
document.addEventListener("keydown", (ev) => {
  if(ev.key === "Escape" && document.getElementById("flashOverlay").classList.contains("open")) closeFlashcards();
});

/* ---------- QUIZ DER / DIE / DAS ---------- */

let genusDeck = [], genusIdx = 0, genusOk = 0, genusLock = false, genusAnswers = [];

function openGenusQuiz(){
  const nouns = ENTRIES.filter(e => genusChip(e));
  for(let i = nouns.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [nouns[i], nouns[j]] = [nouns[j], nouns[i]];
  }
  genusDeck = nouns.slice(0, 15);
  genusIdx = 0; genusOk = 0; genusLock = false; genusAnswers = [];
  document.getElementById("genusOverlay").classList.add("open");
  document.body.classList.add("conj-lock");
  renderGenus();
}
function closeGenusQuiz(){
  document.getElementById("genusOverlay").classList.remove("open");
  document.body.classList.remove("conj-lock");
  updateView();
}

function renderGenus(){
  const s = UI_STRINGS[lang];
  const body = document.getElementById("genusBody");
  document.getElementById("genusTitle").textContent = s.genusTitle +
    (genusDeck.length && genusIdx < genusDeck.length ? ` · ${genusIdx + 1} / ${genusDeck.length}` : "");

  if(genusIdx >= genusDeck.length){
    const msg = genusOk === genusDeck.length ? s.genusPerfect : (genusOk >= genusDeck.length * 0.7 ? s.genusGood : s.genusMeh);
    body.innerHTML = `
      <div class="flash-done">
        <div class="flash-done-ic">${ic(genusOk === genusDeck.length ? "checkSeal" : "dice")}</div>
        <h3>${s.genusDoneTitle}</h3>
        <p>${s.genusDoneMsg(genusOk, genusDeck.length)}<br>${msg}</p>
        <div class="flash-actions">
          <button type="button" class="conj-btn" id="genusRestart">${s.flashRestart}</button>
          <button type="button" class="flash-secondary" id="genusEnd">${s.flashCloseBtn}</button>
        </div>
      </div>`;
    document.getElementById("genusRestart").addEventListener("click", openGenusQuiz);
    document.getElementById("genusEnd").addEventListener("click", closeGenusQuiz);
    return;
  }

  const e = genusDeck[genusIdx];
  const g = genusChip(e);
  const t = L(e);
  const plural = (e.fields.find(f => f[0] === "Plurale") || [])[1];
  const chosen = genusAnswers[genusIdx];   // definito = domanda già risposta (revisione)

  body.innerHTML = `
    <div class="flash-progress"><div class="flash-progress-fill" style="width:${(genusIdx / genusDeck.length) * 100}%"></div></div>
    <div class="genus-question">
      <div class="genus-word" id="genusWord">${g.rest}</div>
      <div class="genus-hint">${s.genusPrompt}</div>
      <div class="genus-answer" id="genusAnswer"></div>
    </div>
    <div class="genus-btns" id="genusBtns">
      <button type="button" class="genus-opt genus-opt-der" data-a="der">der</button>
      <button type="button" class="genus-opt genus-opt-die" data-a="die">die</button>
      <button type="button" class="genus-opt genus-opt-das" data-a="das">das</button>
    </div>
    <div class="genus-nav" id="genusNav">
      ${genusIdx > 0 ? `<button type="button" class="flash-secondary genus-back">${s.quizBack}</button>` : ""}
    </div>`;

  if(chosen){
    /* Stato "risposto" (dopo il clic o tornando indietro): soluzione visibile,
       opzioni bloccate — punteggio e SRS non vengono toccati di nuovo. */
    body.querySelectorAll(".genus-opt").forEach(o => {
      if(o.dataset.a === g.art) o.classList.add("right");
      else if(o.dataset.a === chosen) o.classList.add("wrong");
      o.disabled = true;
    });
    const ans = document.getElementById("genusAnswer");
    ans.innerHTML = `<span class="genus genus-${g.art}">${g.art}</span> <b>${g.rest}</b> — ${t.it}` +
      (plural ? `<span class="genus-pl"> · ${s.genusPlural}: ${plural}</span>` : "");
    ans.classList.add("show");
    /* Il pulsante audio sta accanto alla PAROLA GRANDE, non alla riga della
       soluzione. Compare solo ora che hai risposto: prima leggerebbe
       "der Bereich" e ti regalerebbe l'articolo. La pronuncia non parte mai
       da sola ed è ripetibile quante volte vuoi. */
    const word = document.getElementById("genusWord");
    word.insertAdjacentHTML("beforeend", speakBtnHtml(`${g.art} ${g.rest}`, "quiz-speak"));
    bindSpeakBtns(word);
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "conj-btn genus-next";
    nextBtn.textContent = s.cqNext;
    nextBtn.addEventListener("click", () => { genusIdx++; genusLock = false; renderGenus(); });
    document.getElementById("genusNav").appendChild(nextBtn);
  } else {
    body.querySelectorAll(".genus-opt").forEach(b => {
      b.addEventListener("click", () => {
        if(genusLock) return;
        genusLock = true;
        const right = b.dataset.a === g.art;
        if(right){ genusOk++; bumpStreak(); }
        else srsAnswer(e.id, false);   // genere sbagliato → la parola finisce nel ripasso
        genusAnswers[genusIdx] = b.dataset.a;
        genusLock = false;
        renderGenus();   // ri-renderizza in stato "risposto": soluzione + Avanti/Indietro
      });
    });
  }
  const backBtn = body.querySelector(".genus-back");
  if(backBtn) backBtn.addEventListener("click", () => { genusLock = false; genusIdx--; renderGenus(); });
}

document.getElementById("genusClose").addEventListener("click", closeGenusQuiz);
document.getElementById("genusOverlay").addEventListener("click", (ev) => {
  if(ev.target.id === "genusOverlay") closeGenusQuiz();
});
document.addEventListener("keydown", (ev) => {
  if(ev.key === "Escape" && document.getElementById("genusOverlay").classList.contains("open")) closeGenusQuiz();
});

/* ---------- QUIZ DI CONIUGAZIONE (produzione attiva) ----------
   Riusa buildParadigm: mostra verbo + tempo + persona, e l'utente SCRIVE la forma.
   Allenamento di produzione (non solo riconoscimento): il salto di qualità del B1.
   Le forme sbagliate entrano nell'SRS e ricompaiono nel ripasso di oggi. */

let cqDeck = [], cqIdx = 0, cqOk = 0, cqAnswered = false;
const CQ_TENSES = [["praesens","Präsens"],["praeteritum","Präteritum"],["perfekt","Perfekt"]];

function openConjQuiz(){
  const verbs = ENTRIES.filter(e => e.type === "verbo" && e.raw);
  for(let i = verbs.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [verbs[i], verbs[j]] = [verbs[j], verbs[i]];
  }
  cqDeck = verbs.slice(0, 10).map(e => {
    const p = buildParadigm(e.raw, VERB_META[e.raw.inf] || {});
    const [key, label] = CQ_TENSES[Math.floor(Math.random() * CQ_TENSES.length)];
    const pi = Math.floor(Math.random() * CONJ_PERSONS.length);
    return { e, tense: label, person: CONJ_PERSONS[pi], answer: p[key][pi] };
  });
  cqIdx = 0; cqOk = 0; cqAnswered = false;
  document.getElementById("cqOverlay").classList.add("open");
  document.body.classList.add("conj-lock");
  renderConjQuiz();
}
function closeConjQuiz(){
  document.getElementById("cqOverlay").classList.remove("open");
  document.body.classList.remove("conj-lock");
  updateView();
}

function cqNorm(s){ return s.toLowerCase().replace(/\s+/g, " ").trim(); }
/* Accetta la risposta sia con sia senza pronome: "hilfst" e "du hilfst" sono entrambe giuste. */
function cqStripPronoun(ans, person){
  const prons = person === "er/sie/es" ? ["er","sie","es"] : [person];
  for(const p of prons){
    if(ans.startsWith(p + " ")) return ans.slice(p.length + 1);
  }
  return ans;
}

function renderConjQuiz(){
  const s = UI_STRINGS[lang];
  const body = document.getElementById("cqBody");
  document.getElementById("cqTitle").textContent = s.cqTitle +
    (cqDeck.length && cqIdx < cqDeck.length ? ` · ${cqIdx + 1} / ${cqDeck.length}` : "");

  if(cqIdx >= cqDeck.length){
    const msg = cqOk === cqDeck.length ? s.cqPerfect : (cqOk >= cqDeck.length * 0.7 ? s.cqGood : s.cqMeh);
    body.innerHTML = `
      <div class="flash-done">
        <div class="flash-done-ic">${ic(cqOk === cqDeck.length ? "checkSeal" : "pencil")}</div>
        <h3>${s.cqDoneTitle}</h3>
        <p>${s.cqDoneMsg(cqOk, cqDeck.length)}<br>${msg}</p>
        <div class="flash-actions">
          <button type="button" class="conj-btn" id="cqRestart">${s.flashRestart}</button>
          <button type="button" class="flash-secondary" id="cqEnd">${s.flashCloseBtn}</button>
        </div>
      </div>`;
    document.getElementById("cqRestart").addEventListener("click", openConjQuiz);
    document.getElementById("cqEnd").addEventListener("click", closeConjQuiz);
    return;
  }

  const q = cqDeck[cqIdx];
  const t = L(q.e);
  body.innerHTML = `
    <div class="flash-progress"><div class="flash-progress-fill" style="width:${(cqIdx / cqDeck.length) * 100}%"></div></div>
    <div class="cq-question">
      <div class="cq-verb">${q.e.de} <span class="cq-it">${t.it}</span></div>
      <div class="cq-task">${s.cqPrompt(q.tense, q.person)}</div>
      <input type="text" id="cqInput" class="cq-input" placeholder="${s.cqPlaceholder}"
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" lang="de">
      <div class="cq-feedback" id="cqFeedback"></div>
    </div>
    <div class="flash-actions">
      <button type="button" class="flash-secondary" id="cqSkipBtn">${s.cqSkip}</button>
      <button type="button" class="flash-btn flash-yes" id="cqCheckBtn">${s.cqCheck}</button>
    </div>`;

  const input = document.getElementById("cqInput");
  const fb = document.getElementById("cqFeedback");
  const checkBtn = document.getElementById("cqCheckBtn");
  const skipBtn = document.getElementById("cqSkipBtn");
  input.focus();

  const reveal = (right) => {
    if(cqAnswered) return;
    cqAnswered = true;
    bumpStreak();
    /* Niente audio automatico: il pulsante legge la forma completa
       (pronome + verbo) e si può premere quante volte serve. */
    const spk = speakBtnHtml(`${q.person} ${q.answer}`, "quiz-speak");
    if(right){
      cqOk++;
      fb.innerHTML = `<span class="cq-right">${ic("check","ic-sm")}${s.cqRight}</span> <b>${q.person} ${q.answer}</b>${spk}`;
    } else {
      srsAnswer(q.e.id, false);   // la forma sbagliata finisce nel ripasso di oggi
      fb.innerHTML = `<span class="cq-wrong">${s.cqWrongIs}</span> <b>${q.person} ${q.answer}</b>${spk}`;
    }
    fb.classList.add("show", right ? "ok" : "ko");
    bindSpeakBtns(fb);
    input.disabled = true;
    skipBtn.hidden = true;
    checkBtn.textContent = s.cqNext;
  };
  const submit = () => {
    if(cqAnswered){
      cqIdx++; cqAnswered = false; renderConjQuiz();
      return;
    }
    const user = cqStripPronoun(cqNorm(input.value), q.person);
    if(!user){ input.focus(); return; }
    reveal(user === cqNorm(q.answer));
  };
  checkBtn.addEventListener("click", submit);
  skipBtn.addEventListener("click", () => reveal(false));
  input.addEventListener("keydown", (ev) => { if(ev.key === "Enter"){ ev.preventDefault(); submit(); } });
}

document.getElementById("cqClose").addEventListener("click", closeConjQuiz);
document.getElementById("cqOverlay").addEventListener("click", (ev) => {
  if(ev.target.id === "cqOverlay") closeConjQuiz();
});
document.addEventListener("keydown", (ev) => {
  if(ev.key === "Escape" && document.getElementById("cqOverlay").classList.contains("open")) closeConjQuiz();
});

/* ---------- QUIZ wurde · würde · werden (Appendice del Bignami, p. 44) ----------
   Frase con il buco: si sceglie tra le tre "anime" di werden, coniugate per la
   persona della frase. Ogni soluzione spiega PERCHÉ (il marcatore nella frase).
   Stesso pattern del quiz genus: niente timer, Avanti/Indietro, revisione
   senza ritoccare punteggio/SRS. Errore → la voce Appendice entra nel ripasso. */

const WW_ITEMS = [
  { q:"Ich ___ gern nach Berlin fahren.", opts:["wurde","würde","werde"], a:"würde",
    why:{it:"desiderio (gern) → Konjunktiv II", en:"wish (gern) → Konjunktiv II"} },
  { q:"Er ___ 2010 Arzt.", opts:["wurde","würde","wird"], a:"wurde",
    why:{it:"fatto reale del passato (2010) → Präteritum", en:"real past fact (2010) → Präteritum"} },
  { q:"Das Haus ___ 1990 gebaut.", opts:["wurde","würde","wird"], a:"wurde",
    why:{it:"Passiv al passato (1990)", en:"past passive (1990)"} },
  { q:"___ du mir bitte helfen?", opts:["Wurdest","Würdest","Wirst"], a:"Würdest",
    why:{it:"richiesta gentile (bitte) → Konjunktiv II", en:"polite request (bitte) → Konjunktiv II"} },
  { q:"Morgen ___ ich 30 Jahre alt.", opts:["wurde","würde","werde"], a:"werde",
    why:{it:"futuro certo (morgen) → werden", en:"certain future (morgen) → werden"} },
  { q:"An deiner Stelle ___ ich warten.", opts:["wurde","würde","werde"], a:"würde",
    why:{it:"consiglio/ipotesi (an deiner Stelle) → Konjunktiv II", en:"advice/hypothesis (an deiner Stelle) → Konjunktiv II"} },
  { q:"Das Brot ___ jeden Morgen frisch gebacken.", opts:["wurde","würde","wird"], a:"wird",
    why:{it:"Passiv al presente: abitudine (jeden Morgen)", en:"present passive: habit (jeden Morgen)"} },
  { q:"Er ___ reich, wenn er mehr arbeitete.", opts:["wurde","würde","wird"], a:"würde",
    why:{it:"ipotesi con wenn → Konjunktiv II", en:"hypothesis with wenn → Konjunktiv II"} },
  { q:"Sie ___ letztes Jahr Mutter.", opts:["wurde","würde","wird"], a:"wurde",
    why:{it:"fatto reale (letztes Jahr) → Präteritum", en:"real fact (letztes Jahr) → Präteritum"} },
  { q:"Wir ___ nächstes Jahr bestimmt nach Spanien fliegen.", opts:["wurden","würden","werden"], a:"werden",
    why:{it:"piano certo (bestimmt) → Futur I", en:"certain plan (bestimmt) → Futur I"} },
  { q:"Die Berliner Mauer ___ 1989 geöffnet.", opts:["wurde","würde","wird"], a:"wurde",
    why:{it:"Passiv al passato (1989)", en:"past passive (1989)"} },
  { q:"___ Sie bitte das Fenster schließen?", opts:["Wurden","Würden","Werden"], a:"Würden",
    why:{it:"cortesia con Sie → Konjunktiv II", en:"politeness with Sie → Konjunktiv II"} }
];
/* colore per "anima": wurd- teal (fatto), ü prugna (ipotesi), il resto navy (presente/futuro) */
function wwOptClass(opt){
  if(opt.includes("ü") || opt.includes("Ü")) return "ww-plum";
  if(opt.toLowerCase().startsWith("wurd")) return "ww-teal";
  return "ww-navy";
}
function wwEntry(){
  return ENTRIES.find(e => e.type === "grammatica" && e.de.startsWith("wurde · würde · werden"));
}

let wwDeck = [], wwIdx = 0, wwOk = 0, wwAnswers = [], wwLock = false;

function openWwQuiz(){
  const items = WW_ITEMS.slice();
  for(let i = items.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  wwDeck = items.slice(0, 10);
  wwIdx = 0; wwOk = 0; wwAnswers = []; wwLock = false;
  document.getElementById("wwOverlay").classList.add("open");
  document.body.classList.add("conj-lock");
  renderWw();
}
function closeWwQuiz(){
  document.getElementById("wwOverlay").classList.remove("open");
  document.body.classList.remove("conj-lock");
  updateView();
}

function renderWw(){
  const s = UI_STRINGS[lang];
  const body = document.getElementById("wwBody");
  document.getElementById("wwTitle").textContent = s.wwTitle +
    (wwDeck.length && wwIdx < wwDeck.length ? ` · ${wwIdx + 1} / ${wwDeck.length}` : "");

  if(wwIdx >= wwDeck.length){
    const msg = wwOk === wwDeck.length ? s.wwPerfect : (wwOk >= wwDeck.length * 0.7 ? s.wwGood : s.wwMeh);
    body.innerHTML = `
      <div class="flash-done">
        <div class="flash-done-ic">${ic(wwOk === wwDeck.length ? "checkSeal" : "book")}</div>
        <h3>${s.cqDoneTitle}</h3>
        <p>${s.cqDoneMsg(wwOk, wwDeck.length)}<br>${msg}</p>
        <div class="flash-actions">
          <button type="button" class="conj-btn" id="wwRestart">${s.flashRestart}</button>
          <button type="button" class="flash-secondary" id="wwEnd">${s.flashCloseBtn}</button>
        </div>
      </div>`;
    document.getElementById("wwRestart").addEventListener("click", openWwQuiz);
    document.getElementById("wwEnd").addEventListener("click", closeWwQuiz);
    return;
  }

  const it = wwDeck[wwIdx];
  const chosen = wwAnswers[wwIdx];   // definito = domanda già risposta (revisione)

  body.innerHTML = `
    <div class="flash-progress"><div class="flash-progress-fill" style="width:${(wwIdx / wwDeck.length) * 100}%"></div></div>
    <div class="genus-question">
      <div class="ww-sentence">${it.q.replace("___", '<span class="ww-gap">___</span>')}</div>
      <div class="genus-hint">${s.wwPrompt}</div>
      <div class="genus-answer" id="wwAnswer"></div>
    </div>
    <div class="genus-btns" id="wwBtns">
      ${it.opts.map(o => `<button type="button" class="genus-opt ww-opt ${wwOptClass(o)}" data-a="${o}">${o}</button>`).join("")}
    </div>
    <div class="genus-nav" id="wwNav">
      ${wwIdx > 0 ? `<button type="button" class="flash-secondary ww-back">${s.quizBack}</button>` : ""}
    </div>`;

  if(chosen){
    body.querySelectorAll(".ww-opt").forEach(o => {
      if(o.dataset.a === it.a) o.classList.add("right");
      else if(o.dataset.a === chosen) o.classList.add("wrong");
      o.disabled = true;
    });
    const ans = document.getElementById("wwAnswer");
    /* Il pulsante legge la frase completata, senza partire da solo. */
    ans.innerHTML = `<b>${it.q.replace("___", it.a)}</b>${speakBtnHtml(it.q.replace("___", it.a), "quiz-speak")}` +
      `<br><span class="ww-why">${it.why[lang === "en" ? "en" : "it"]}</span>`;
    ans.classList.add("show");
    bindSpeakBtns(ans);
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "conj-btn genus-next";
    nextBtn.textContent = s.cqNext;
    nextBtn.addEventListener("click", () => { wwIdx++; wwLock = false; renderWw(); });
    document.getElementById("wwNav").appendChild(nextBtn);
  } else {
    body.querySelectorAll(".ww-opt").forEach(b => {
      b.addEventListener("click", () => {
        if(wwLock) return;
        wwLock = true;
        const right = b.dataset.a === it.a;
        if(right){ wwOk++; bumpStreak(); }
        else {
          const g = wwEntry();
          if(g) srsAnswer(g.id, false);   // errore → la voce Appendice va in ripasso
        }
        wwAnswers[wwIdx] = b.dataset.a;
        wwLock = false;
        renderWw();   // ri-renderizza in stato "risposto": soluzione + perché + Avanti
      });
    });
  }
  const backBtn = body.querySelector(".ww-back");
  if(backBtn) backBtn.addEventListener("click", () => { wwLock = false; wwIdx--; renderWw(); });
}

document.getElementById("wwClose").addEventListener("click", closeWwQuiz);
document.getElementById("wwOverlay").addEventListener("click", (ev) => {
  if(ev.target.id === "wwOverlay") closeWwQuiz();
});
document.addEventListener("keydown", (ev) => {
  if(ev.key === "Escape" && document.getElementById("wwOverlay").classList.contains("open")) closeWwQuiz();
});

/* ---------- TORNA SU ---------- */

const backTopBtn = document.getElementById("backTop");
window.addEventListener("scroll", () => {
  backTopBtn.hidden = window.scrollY < 600;
}, { passive: true });
backTopBtn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

/* ---------- TAB BAR ---------- */

document.querySelectorAll(".tabbar .tab").forEach(b => {
  b.addEventListener("click", () => setTab(b.dataset.tab));
});

/* ---------- AVVIO ---------- */

paintStaticIcons();
applyStaticStrings();
applyTheme();
renderFilters();
updateView();
