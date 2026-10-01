import { R } from "./vars";
import { kindChunks, KIND_WORDS, ROOM_WORDS } from "../../src/core/plate/kinds";
import { FX, GENRE_FX, fxMacro } from "../../src/core/plate/fx";
import { PLATE_CSS, PLATE_FIND, minCss } from "../../src/core/plate/style";
// The scene plate without the Ledger: the three-line header (🗓 … 🕰 HH:MM ☁
// condition · temp · wind / 📍 place / # Title) drawn as a living sky by display
// regex. With the Ledger installed the extension draws the full plate itself
// (src/core/plate), with every place's own drawings, before this regex runs, so
// this only fires for preset-only chats. It shares the stylesheet, sky accents
// and genre atmospheres, but draws every place as a town or a room.

export { PLATE_FIND, minCss };

const BAND = R`{{switch::$2::0::night::1::night::2::small::3::small::4::predawn::5::dawn::6::sunrise::7::morning::8::morning::9::morning::10::morning::11::midday::12::midday::13::midday::14::afternoon::15::afternoon::16::afternoon::17::golden::18::sunset::19::dusk::20::evening::21::evening::night}}`;
const WX = R`{{switch::$4::☀::clear::🌙::clear::✨::clear::🌤::fair::⛅::broken::🌥::broken::☁::overcast::🌦::showers::🌧::rain::⛈::storm::🌩::storm::🌨::snow::❄::snow::🧊::sleet::🌫::fog::🌬::wind::🌪::storm::🔥::heat::🌡::heat::{{if::{{matches::$5::storm|thunder::i}}}}storm{{else}}{{if::{{matches::$5::snow|blizzard::i}}}}snow{{else}}{{if::{{matches::$5::rain|drizzle|shower::i}}}}rain{{else}}{{if::{{matches::$5::fog|mist::i}}}}fog{{else}}{{if::{{matches::$5::overcast|cloud::i}}}}overcast{{else}}clear{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}}}`;
const INT = R`{{if::{{matches::$5::torrential|downpour|blizzard|driving::i}}}}torrential{{else}}{{if::{{matches::$5::heavy|hard|thick|dense::i}}}}heavy{{else}}{{if::{{matches::$5::light|drizzle|thin|fine|patchy::i}}}}light{{else}}moderate{{/if}}{{/if}}{{/if}}`;
const SEASON = R`{{if::{{matches::$1::spring::i}}}}spring{{else}}{{if::{{matches::$1::summer|midsummer::i}}}}summer{{else}}{{if::{{matches::$1::autumn|fall\b|harvest::i}}}}autumn{{else}}{{if::{{matches::$1::winter|midwinter|yule::i}}}}winter{{else}}{{if::{{matches::$1::\b(?:Mar|Apr|May)[a-z]*\b}}}}spring{{else}}{{if::{{matches::$1::\b(?:Jun|Jul|Aug)[a-z]*\b}}}}summer{{else}}{{if::{{matches::$1::\b(?:Sep|Oct|Nov)[a-z]*\b}}}}autumn{{else}}{{if::{{matches::$1::\b(?:Dec|Jan|Feb)[a-z]*\b}}}}winter{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}`;
const MOONPH = R`{{if::{{matches::$10::🌑|new moon::i}}}}44px{{else}}{{if::{{matches::$10::🌒|waxing crescent::i}}}}26px{{else}}{{if::{{matches::$10::🌓|first quarter::i}}}}18px{{else}}{{if::{{matches::$10::🌔|waxing gibbous::i}}}}8px{{else}}{{if::{{matches::$10::🌖|waning gibbous::i}}}}-8px{{else}}{{if::{{matches::$10::🌗|last quarter|third quarter::i}}}}-18px{{else}}{{if::{{matches::$10::🌘|waning crescent::i}}}}-26px{{else}}0px{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}{{/if}}`;
const WIND = R`{{setvar::alm_wd::{{upper::{{regex::^.*?\bwind[ \t]+(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)\b.*$::$$1::$5::i}}}}}}{{switch::{{getvar::alm_wd}}::N::180::NNE::202::NE::225::ENE::247::E::270::ESE::292::SE::315::SSE::337::S::0::SSW::22::SW::45::WSW::67::W::90::WNW::112::NW::135::NNW::157::90}}`;
const TEMP = R`{{setvar::alm_tc::{{regex::^.*?(-?\d{1,3})[ \t]*°[ \t]*C\b.*$::$$1::$5::i}}}}{{if::{{matches::{{getvar::alm_tc}}::^-?\d+$}}}}--t:clamp(0,calc(({{getvar::alm_tc}} + 10) / 50),1);{{/if}}`;
// Condition pills: split "heavy rain · 9°C · wind SW" into glass pills; wind gets an arrow.
const PILLS = R`{{regex::[ \t]*[·•|][ \t]*::</span><span class="gl">::{{regex::(-?\d{1,3})[ \t]*°[ \t]*([CF])\b::<i class="thermo"></i>$$1°$$2::{{regex::\bwind[ \t]+([NSEW]{1,3})\b::<i class="wind">➤</i> $$1::$5::i}}::i}}::g}}`;

// ── Room or outdoors, and seeds ─────────────────────────────────────────────
const GENRE = `{{default::{{getchatvar::alm_ui_lead}}::drama}}`;
const word = (w: string) => R`\b(?:${w})(?:s|es)?(?![a-z])`;
const ROOMS = [...ROOM_WORDS.map(([, w]) => w), "room|interior|inside|indoors|hall"].join("|");
const OUTDOORS = KIND_WORDS.filter(([k]) => ["space", "rooftop", "graveyard", "ruins", "castle"].includes(k)).map(([, w]) => w).join("|");
const LAST = R`{{regex::^.*›[ \t]*::::$11}}`;
const isRoom = (t: string, other: string) => `{{if::{{matches::${t}::${word(OUTDOORS)}::i}}}}town{{else}}{{if::{{matches::${t}::${word(ROOMS)}::i}}}}r_home{{else}}${other}{{/if}}{{/if}}`;
const KIND = R`{{setvar::alm_pk::${isRoom(LAST, isRoom("$11", "town"))}}}`;
/** Place seed: stable for one 📍 path, different between most paths. */
const SEED = R`{{calc::{{len::$11}} * 7 + {{len::{{regex::[^aeiouy]::::$11::gi}}}} * 13 + {{len::${LAST}}} * 3 + 1}}`;
/** Scene seed: changes with the title and the hour. */
const SCENE = R`{{calc::{{len::$12}} * 5 + {{len::{{regex::[^aeiou]::::$12::gi}}}} * 11 + $2 * 7}}`;
const sd = `{{getvar::alm_sd}}`;
const SETUP = R`${KIND}{{setvar::alm_sd::${SEED}}}{{setvar::alm_ss::${SCENE}}}{{setvar::alm_bd::${BAND}}}{{setvar::alm_wk::${WX}}}` +
  `{{setvar::alm_fx::${fxMacro("{{getvar::alm_ss}}", "{{getvar::alm_bd}}", "{{getvar::alm_wk}}", "{{getvar::alm_pk}}")}}}`;

const chunkSwitch = (key: string, entries: [string, string][]) => `{{switch::${key}::${entries.map(([k, c]) => `${k}::${minCss(c)} `).join("::")}::}}`;
const FX_CSS = chunkSwitch(`{{getvar::alm_fx}}`, Object.entries(FX).filter(([, c]) => c).map(([k, c]) => [k, c.replaceAll("&", `[data-fx=${k}]`)]));
const GENRE_CSS = chunkSwitch(GENRE, Object.entries(GENRE_FX).map(([k, c]) => [k, c.replaceAll("&", `[data-genre=${k}]`)]));
const ART = kindChunks().filter((c) => c.key === "town-0" || c.key === "r_home-0");
const ART_CSS = chunkSwitch(`{{getvar::alm_pk}}-0`, ART.map((c) => [c.key, c.css]));

export const PLATE_REPLACE =
  "\n" + SETUP + R`<div class="p" data-k="{{getvar::alm_pk}}-0" data-place="{{getvar::alm_pk}}" data-band="{{getvar::alm_bd}}" data-wx="{{getvar::alm_wk}}" data-int="${INT}" data-season="${SEASON}" data-genre="${GENRE}" ` +
  R`data-flip="{{mod::{{len::${LAST}}}::2}}" data-tint="{{mod::{{floor::{{calc::${sd} / 4}}}}::5}}" data-frame="{{mod::{{floor::{{calc::${sd} / 3}}}}::5}}" data-lay="{{mod::{{calc::{{len::$12}} * 3 + {{len::{{regex::[^aeiou]::::$12::gi}}}}}}::5}}" data-fx="{{getvar::alm_fx}}" ` +
  `style="--h:calc($2 + $3 / 60);{{if::$6}}--rise:calc($6 + $7 / 60);--set:calc($8 + $9 / 60);{{/if}}--ph:${MOONPH};--wd:${WIND};${TEMP}--ox:calc(({{mod::{{calc::${sd} * 37}}::240}} - 120) * 1px);--kbo:{{mod::{{calc::${sd} * 29}}::100}}%"><style>${minCss(PLATE_CSS)}${ART_CSS}${FX_CSS}${GENRE_CSS}</style>` +
  R`<div class="scene"><div class="l sky"></div><div class="l wash"></div><div class="l glow"></div><div class="l stars"></div><div class="l fx"></div><div class="l fx2"></div><div class="l rays"></div><div class="l sun"></div><div class="l moon"></div><div class="l clouds"></div><div class="l clouds2"></div><div class="l gx"></div><div class="l kx2"></div><div class="l ground"></div>` +
  R`<div class="far land"></div><div class="l water"></div><div class="l glint"></div><div class="l mglint"></div><div class="refl land"></div><div class="mid land"></div><div class="lit land"></div><div class="l kx"></div><div class="near land"></div><div class="fg land"></div>` +
  R`<div class="l fog"></div><div class="l windl"></div><div class="l heat"></div><div class="l rain"></div><div class="l rain r2"></div><div class="l snow"></div><div class="l snow big"></div><div class="l flash"></div></div>` +
  R`<div class="l room wall"></div><div class="l room walldim"></div><div class="l room wain"></div><div class="l room lamp"></div><div class="wf"></div><div class="room ra"></div><div class="room rb"></div><div class="room rc"></div><div class="room rd"></div><div class="l room spill"></div><div class="l room motes"></div><div class="l room roomflash"></div>` +
  R`<div class="l scrim"></div><div class="l grade"></div><div class="l grain"></div><div class="l frame"></div>` +
  R`<div class="top"><span class="crumb">{{regex::[ \t]*›[ \t]*([^›]*)$::<span>›</span> <b>$$1</b>::{{regex::[ \t]*›[ \t]*(?=[^›]*›)::<span>›</span> ::$11::g}}}}</span><span class="dial"><i class="mk"></i><span>{{if::{{lt::$2::10}}}}0{{/if}}$2:$3</span></span></div>` +
  R`<div class="title"><span class="kicker">{{regex::^\s*((?:Day|Dia|Día|Jour|Tag)\s*\d+).*$::$$1::$1::i}}{{if::{{getchatvar::alm_ui_lead}}}} · {{replace::_:: ::{{getchatvar::alm_ui_lead}}}}{{/if}}</span><h3 class="ttl">$12</h3></div>` +
  R`<div class="strip"><span class="gl">🗓 {{regex::^\s*(?:(?:Day|Dia|Día|Jour|Tag)\s*\d+\s*[·•|,]\s*)?::::$1::i}}</span><span class="gl">{{if::$4}}$4 {{/if}}${PILLS}</span>{{if::$6}}<span class="gl">☀ $6:$7 – $8:$9</span>{{/if}}{{if::$10}}<span class="gl"><i class="mo"></i>$10</span>{{/if}}</div></div>` + "\n";
