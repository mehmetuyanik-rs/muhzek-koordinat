# muhzek-koordinat

[![CI](https://github.com/mehmetuyanik-rs/muhzek-koordinat/actions/workflows/ci.yml/badge.svg)](https://github.com/mehmetuyanik-rs/muhzek-koordinat/actions/workflows/ci.yml)
[![Lisans: MIT](https://img.shields.io/badge/lisans-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)

**Türkiye jeodezik koordinat dönüşümleri** — `proj4` üstüne, Türkiye
haritacılık pratiğine göre hazırlanmış hazır tanımlar ve akıllı girdi
ayrıştırıcı. [MuhzekAI](https://muhzekai.com)'nin
[Koordinat Dönüştürücü](https://muhzekai.com/araclar/koordinat-donusturucu) ve
[MuhzekCAD](https://muhzekai.com/araclar/cad) araçlarında üretimde çalışan
çekirdektir.

> **EN:** Turkish geodetic coordinate transformations on top of proj4:
> ED50 ↔ ITRF96/TUREF datum shift (EPSG:1784 country-average parameters),
> 3° Transverse Mercator (Gauss-Krüger) and 6° UTM zones, plus a forgiving
> parser that accepts decimal degrees, DMS (`39°55'14.7"K`), decimal commas
> and easting/northing in any order. Production code from
> [muhzekai.com](https://muhzekai.com).

## Ne var?

- **`koordinat.ts`** — çekirdek:
  - ED50 ↔ ITRF/TUREF (≈WGS84) datum geçişi — EPSG:1784 Türkiye ortalama
    parametreleri (`-84.1, -101.8, -129.7 m; rz 0.468″; 1.05 ppm`)
  - Coğrafi / 3° TM (dilimler 27..45, k=1, x₀=500000) / 6° UTM (35-36)
  - `girdiyiAyristir()`: nokta adı + ondalık / DMS (`39°55'14.7"K`,
    `39 55 14.7`) / metrik; ondalık virgül, sağa-yukarı sırası ve
    coğrafi/metrik türü otomatik sezilir
  - `noktalariDonustur()`: toplu dönüşüm + Türkiye sınırı ve dilim aşımı
    uyarıları; `dereceyiDmsYap()` ile DMS çıktısı
- **`crs.ts`** — CAD/çizim koordinatını (x=sağa, y=yukarı) ITRF96 TM veya
  ED50 UTM kabul edip WGS84 enlem/boylama çeviren sade yardımcı
- **`yukseklik.ts`** *(tarayıcı)* — AWS açık "Terrarium" karolarından
  anahtarsız zemin kotu (~100 ms, tek PNG isteği; TR jeoit düzeltme notuyla)

## Kullanım

```ts
import { girdiyiAyristir, noktalariDonustur } from "muhzek-koordinat";

const { noktalar } = girdiyiAyristir("P1 4204673,25 456123,75");
const { sonuclar } = noktalariDonustur(
  noktalar,
  { datum: "ed50", tur: "tm3", dilim: 33 },   // kaynak: ED50 3° TM OM33
  { datum: "itrf", tur: "cografi", dilim: 33 } // hedef: ITRF coğrafi
);
console.log(sonuclar[0].cikti1, sonuclar[0].cikti2); // enlem, boylam
```

```ts
import { koordinatDonustur } from "muhzek-koordinat/crs";

koordinatDonustur(500342.14, 4432879.06, "tm33");
// → { enlem: 40.04..., boylam: 33.004... }
```

## Duyarlılık notu

Datum geçişi **Türkiye ortalama** parametreleriyledir — duyarlık metre
mertebesidir. Tapu/kadastro hassasiyeti isteyen işler BÖHHBÜY gereği pafta
bazlı (hücresel) parametre gerektirir. ITRF96/TUREF, haritacılık düzeyinde
WGS84 ile çakışık kabul edilir.

## Test

```bash
npm install && npm test
```

## Lisans

MIT — [muhzekai.com](https://muhzekai.com)'da canlı olarak çalışıyor.
