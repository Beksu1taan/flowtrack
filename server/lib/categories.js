// Категории и встроенный словарь мерчантов Казахстана.
// Порядок правил важен: более конкретные (Яндекс Еда) идут раньше общих (Яндекс).

const EXPENSE_CATEGORIES = [
  "food", // кафе, рестораны, доставка еды
  "groceries", // продуктовые магазины
  "transport", // такси, общественный транспорт, топливо
  "shopping", // маркетплейсы, одежда, техника
  "utilities", // коммуналка, связь, интернет
  "health", // аптеки, клиники
  "entertainment", // кино, подписки, игры
  "education", // курсы, учёба, книги
  "beauty", // салоны, косметика
  "transfers", // переводы людям
  "cash", // снятие наличных
  "other",
];

const INCOME_CATEGORIES = ["salary", "transfer_in", "cashback", "other_income"];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

// [регулярка по нормализованному описанию, категория]
const MERCHANT_RULES = [
  // Яндекс: сначала конкретные сервисы, потом общий «Яндекс» = такси
  [/yandex ?(eda|eats|food)|яндекс ?еда/, "food"],
  [/yandex ?lavka|яндекс ?лавка|lavka/, "groceries"],
  [/yandex ?(plus|music|kinopoisk)|яндекс ?(плюс|музыка)|kinopoisk|кинопоиск/, "entertainment"],
  [/yandex ?market|яндекс ?маркет/, "shopping"],
  [/yandex|яндекс|yango/, "transport"],

  // Маркетплейсы банков — раньше общего «market»
  [/kaspi ?(магазин|shop|market)|halyk ?market|jusan ?shop|wildberries|вайлдберриз|ozon|озон/, "shopping"],

  // Доставка еды и кафе
  [/glovo|wolt|chocofood|choco ?food|starbucks|kfc|burger ?king|mcdonald|макдональдс|coffee ?boom|del ?papa|dodo|додо|papa ?john|hardee|salam ?bro|tanuki|sushi|суши|pizza|пицц|cafe|кафе|coffee|кофе|restaurant|ресторан|bar |doner|донер|шаурм|lanzhou|bahandi|bahroma|kaspi ?gid|gippo|ресто/, "food"],

  // Продукты
  [/magnum|магнум|small|смолл|galmart|галмарт|ramstore|рамстор|anvar|анвар|arbuz|арбуз|metro ?cash|toimart|той ?март|interfood|green ?market|супермаркет|minimarket|минимаркет|market|маркет|азык|продукт/, "groceries"],

  // Транспорт и топливо
  [/indrive|indriver|uber|bolt|onay|онай|avtobys|автобыс|taxi|такси|metro ?almaty|qazaq ?oil|helios|гелиос|sinooil|sinoil|gazprom|газпром|kazmunaygas|казмунайгаз|petrol|азс|parking|парковк|ktzh|ктж|temir ?zholy|air ?astana|fly ?arystan|scat|aviata|chocotravel/, "transport"],

  // Покупки
  [/lamoda|technodom|технодом|sulpak|сулпак|mechta|мечта|alser|алсер|flip|zara|h&m|lc ?waikiki|defacto|adidas|nike|ikea|leroy|aliexpress|temu|shein|магазин/, "shopping"],

  // Коммуналка и связь
  [/beeline|билайн|kcell|кселл|activ|актив|tele2|теле2|altel|алтел|kazakhtelecom|казахтелеком|almatyenergosbyt|алматыэнергосбыт|alseco|алсеко|ивц|ivc|энергосбыт|водоканал|газ ?сервис|kazakhgaz|коммунал|tvplus|id ?net|интернет/, "utilities"],

  // Здоровье
  [/аптек|apteka|pharm|фарм|europharma|еврофарм|sadykhan|садыхан|biosfera|биосфера|invitro|инвитро|олимп|olymp|клиник|clinic|медицин|med |стоматолог|dental/, "health"],

  // Развлечения и подписки
  [/kinopark|кинопарк|chaplin|чаплин|cinema|кино|netflix|spotify|steam|playstation|xbox|apple\.com|itunes|google ?(play|one|youtube)|youtube|ivi|okko|chatgpt|openai|anthropic|claude|discord|twitch|боулинг|bowling|aqua|аквапарк/, "entertainment"],

  // Образование
  [/coursera|udemy|stepik|skillbox|geekbrains|university|университет|narxoz|нархоз|kbtu|кбту|satbayev|сатпаев|knigi|книг|meloman|меломан|школа|school|курс/, "education"],

  // Красота
  [/barber|барбер|салон|salon|beauty|бьюти|золотое ?яблоко|letual|летуаль|sephora|маникюр|nail/, "beauty"],
];

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[*_.,/\\|"'`()[\]{}:;#№+]/g, " ")
    .replace(/\d{4,}/g, " ") // номера карт, терминалов, телефонов
    .replace(/\s+/g, " ")
    .trim();
}

// Ключ мерчанта для правил и кэша: без городов, стран и мусора.
// \b не работает с кириллицей, поэтому границы слова через \p{L}
const NOISE = /(?<![\p{L}\d])(almaty|алматы|astana|астана|nur-sultan|shymkent|шымкент|karaganda|караганда|kz|kaz|kazakhstan|казахстан|too|тоо|ип|ip|llp|ao|ао)(?![\p{L}\d])/gu;
function merchantKey(text) {
  return normalize(text).replace(NOISE, " ").replace(/\s+/g, " ").trim().slice(0, 120);
}

// Категория по словарю или null.
function matchDictionary(text) {
  const norm = normalize(text);
  for (const [re, cat] of MERCHANT_RULES) {
    if (re.test(norm)) return cat;
  }
  return null;
}

// Категория по правилам пользователя или null. rules: [{pattern, category}]
function matchUserRules(text, rules) {
  const key = merchantKey(text);
  if (!key) return null;
  // Более длинный шаблон — более точный
  const sorted = [...(rules || [])].sort((a, b) => b.pattern.length - a.pattern.length);
  for (const r of sorted) {
    if (r.pattern && key.includes(r.pattern)) return r.category;
  }
  return null;
}

module.exports = {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  ALL_CATEGORIES,
  normalize,
  merchantKey,
  matchDictionary,
  matchUserRules,
};
