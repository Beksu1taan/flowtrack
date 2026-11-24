const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const p = require("../lib/privacy");

test("redactPII вырезает ФИО, ИИН, карты, счета, телефоны, email", () => {
  const text = `ВЫПИСКА по Kaspi Gold
ФИО: Сейтказы Айгерим Нурлановна
ИИН: 990101400123
Номер карты: 4400 4301 **** 1234, счёт KZ12 7220 0000 1234 5678
Телефон +7 707 123 45 67, почта aisha@mail.kz
02.09.24 - 2 350,00 ₸ Покупка Yandex.Go
03.09.24 - 15 000,00 ₸ Перевод Иванов Иван Иванович
04.09.24 - 1 000,00 ₸ Покупка Магазин *1234`;
  const out = p.redactPII(text);
  for (const leak of ["Айгерим Нурлановна", "990101400123", "4400 4301", "KZ12", "707 123", "aisha@mail.kz", "Иван Иванович", "*1234"]) {
    assert.ok(!out.includes(leak), "утечка: " + leak + "\n" + out);
  }
  assert.match(out, /- 2 350,00 ₸ Покупка Yandex\.Go/); // операции остаются
  assert.match(out, /- 15 000,00 ₸ Перевод \[ФИО\]/);
});

test("Распознавание людей и компаний", () => {
  for (const s of ["Айгерим Б.", "Иванов И.И.", "Arman K.", "Иванов Иван Иванович", "Сауле К."]) assert.ok(p.looksLikePerson(s), s);
  for (const s of ["Yandex.Go", "GLOVO ALMATY", "Kaspi Магазин", "Coffee BOOM", "ТОО Ромашка", "MAGNUM CASH&CARRY", "Small", "Банкомат Kaspi Bank"]) {
    assert.ok(!p.looksLikePerson(s), s);
  }
  assert.strictEqual(p.shortenPersonName("Иванов Иван Иванович"), "Иван И.");
  assert.strictEqual(p.shortenPersonName("Айгерим Б."), "Айгерим Б.");
  assert.strictEqual(p.shortenPersonName("Yandex.Go"), "Yandex.Go");
});

test("Шифрование AES-256-GCM", () => {
  process.env.DATA_KEY = crypto.randomBytes(32).toString("hex");
  assert.strictEqual(p.initEncryption(), true);
  const enc = p.encrypt("Перевод Айгерим Б.");
  assert.ok(enc.startsWith("enc:v1:"));
  assert.ok(!enc.includes("Айгерим"));
  assert.notStrictEqual(p.encrypt("x"), p.encrypt("x")); // разный IV
  assert.strictEqual(p.decrypt(enc), "Перевод Айгерим Б.");
  assert.strictEqual(p.decrypt("старая запись"), "старая запись");
  // подмена шифротекста обнаруживается
  const buf = Buffer.from(enc.slice(7), "base64"); buf[buf.length - 1] ^= 1;
  assert.strictEqual(p.decrypt("enc:v1:" + buf.toString("base64")), "[не удалось расшифровать]");
  delete process.env.DATA_KEY;
  p.initEncryption();
});
