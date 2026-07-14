import assert from "node:assert/strict";
import { girdiyiAyristir, noktalariDonustur, dereceyiDmsYap } from "../src/koordinat.ts";
import { koordinatDonustur } from "../src/crs.ts";

let gecen = 0;
function dogrula(ad: string, fn: () => void) {
  fn();
  gecen++;
  console.log(`  GEÇTİ: ${ad}`);
}

dogrula("metrik satır: ad + ondalık virgül + sağa/yukarı sırası", () => {
  const { noktalar, tahmin } = girdiyiAyristir("P1 4204673,25 456123,75");
  assert.equal(noktalar.length, 1);
  assert.equal(noktalar[0].ad, "P1");
  assert.equal(noktalar[0].v1, 456123.75); // sağa (Y/doğu)
  assert.equal(noktalar[0].v2, 4204673.25); // yukarı (X/kuzey)
  assert.equal(tahmin?.tur, "tm3");
});

dogrula("DMS satırı coğrafi sezilir", () => {
  const { noktalar, tahmin } = girdiyiAyristir(`39°55'14.7"K 32°51'12.1"D`);
  assert.equal(noktalar.length, 1);
  assert.equal(tahmin?.tur, "cografi");
  assert.ok(Math.abs(noktalar[0].v1 - 39.92075) < 1e-4);
  assert.ok(Math.abs(noktalar[0].v2 - 32.85336) < 1e-4);
});

dogrula("gidiş-dönüş < 1 cm (ITRF TM33 → coğrafi → TM33)", () => {
  const kaynak = { datum: "itrf", tur: "tm3", dilim: 33 } as const;
  const cografi = { datum: "itrf", tur: "cografi", dilim: 33 } as const;
  const p = [{ ad: "T", v1: 500342.14, v2: 4432879.06 }];
  const ileri = noktalariDonustur(p, kaynak, cografi).sonuclar[0];
  const geri = noktalariDonustur(
    [{ ad: "T", v1: ileri.cikti1, v2: ileri.cikti2 }],
    cografi,
    kaynak
  ).sonuclar[0];
  assert.ok(Math.abs(geri.cikti1 - 500342.14) < 0.01, `sağa farkı: ${geri.cikti1 - 500342.14}`);
  assert.ok(Math.abs(geri.cikti2 - 4432879.06) < 0.01, `yukarı farkı: ${geri.cikti2 - 4432879.06}`);
});

dogrula("ED50 → ITRF kayması ~100-300 m aralığında", () => {
  const p = [{ ad: "T", v1: 500000, v2: 4432000 }];
  const ed50 = { datum: "ed50", tur: "tm3", dilim: 33 } as const;
  const itrf = { datum: "itrf", tur: "tm3", dilim: 33 } as const;
  const s = noktalariDonustur(p, ed50, itrf).sonuclar[0];
  const kayma = Math.hypot(s.cikti1 - 500000, s.cikti2 - 4432000);
  assert.ok(kayma > 100 && kayma < 300, `kayma: ${kayma} m`);
});

dogrula("dilim dışı nokta uyarı üretir", () => {
  const p = [{ ad: "T", v1: 500000, v2: 4432000 }];
  const s = noktalariDonustur(
    p,
    { datum: "itrf", tur: "tm3", dilim: 33 },
    { datum: "itrf", tur: "tm3", dilim: 45 }
  ).sonuclar[0];
  assert.ok(s.uyari, "uyarı bekleniyordu");
});

dogrula("DMS biçimleme", () => {
  assert.equal(dereceyiDmsYap(39.92075, "enlem").endsWith("K"), true);
  assert.equal(dereceyiDmsYap(-32.5, "boylam").endsWith("B"), true);
});

dogrula("crs: TM33 çizim koordinatı → WGS84 (Ankara civarı)", () => {
  const s = koordinatDonustur(500342.14, 4432879.058, "tm33");
  assert.ok(s, "dönüşüm null döndü");
  assert.ok(s!.enlem > 39.8 && s!.enlem < 40.2, `enlem: ${s!.enlem}`);
  assert.ok(s!.boylam > 32.9 && s!.boylam < 33.1, `boylam: ${s!.boylam}`);
});

dogrula("crs: 'ham' null döner", () => {
  assert.equal(koordinatDonustur(100, 200, "ham"), null);
});

console.log(`\n${gecen} test GEÇTİ`);
