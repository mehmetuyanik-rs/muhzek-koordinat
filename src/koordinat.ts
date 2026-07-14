import proj4 from "proj4";

/* Koordinat dönüşüm çekirdeği — ED50 ↔ ITRF/TUREF (≈WGS84).
   Datum geçişi: EPSG:1784 "ED50 to WGS 84 (30)" Türkiye ortalama parametreleri
   (-84.1, -101.8, -129.7 m; rz 0.468″; 1.05 ppm). Duyarlık metre mertebesidir;
   tapu/kadastro hassasiyeti pafta bazlı (hücresel) parametre ister (BÖHHBÜY).
   ITRF96/TUREF pratikte WGS84 ile çakışık kabul edilir (haritacılık düzeyi). */

export const ED50_TOWGS84 = "-84.1,-101.8,-129.7,0,0,0.468,1.05";

export type Datum = "ed50" | "itrf";
export type SistemTuru = "cografi" | "tm3" | "utm6";

export type KoordinatSistemi = {
  datum: Datum;
  tur: SistemTuru;
  /* Projeksiyonlu sistemlerde dilim orta meridyeni (derece) */
  dilim: number;
};

export const TM3_DILIMLERI = [27, 30, 33, 36, 39, 42, 45] as const;
export const UTM6_DILIMLERI = [27, 33, 39, 45] as const;

export const DATUM_ADLARI: Record<Datum, string> = {
  ed50: "ED50 (Avrupa Datumu 1950)",
  itrf: "ITRF / TUREF (≈WGS84)",
};

export const TUR_ADLARI: Record<SistemTuru, string> = {
  cografi: "Coğrafi (enlem/boylam)",
  tm3: "3° TM (Gauss-Krüger)",
  utm6: "6° UTM",
};

export function sistemEtiketi(s: KoordinatSistemi): string {
  const datum = s.datum === "ed50" ? "ED50" : "ITRF/TUREF";
  if (s.tur === "cografi") return `${datum} Coğrafi`;
  const tur = s.tur === "tm3" ? "3° TM" : "6° UTM";
  return `${datum} ${tur} (OM ${s.dilim}°)`;
}

function projTanimi(s: KoordinatSistemi): string {
  const datum =
    s.datum === "ed50"
      ? `+ellps=intl +towgs84=${ED50_TOWGS84}`
      : "+ellps=GRS80 +towgs84=0,0,0";
  if (s.tur === "cografi") return `+proj=longlat ${datum} +no_defs`;
  const k = s.tur === "tm3" ? 1 : 0.9996;
  return `+proj=tmerc +lat_0=0 +lon_0=${s.dilim} +k=${k} +x_0=500000 +y_0=0 ${datum} +units=m +no_defs`;
}

const WGS84 = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs";

/* ---------- Girdi ayrıştırma ---------- */

export type GirdiNokta = {
  ad: string;
  /* Kaynak sisteme göre: coğrafi → enlem/boylam (derece);
     projeksiyonlu → saga (Y/doğu) / yukari (X/kuzey) metre. */
  v1: number;
  v2: number;
};

export type AyristirmaSonucu = {
  noktalar: GirdiNokta[];
  hatalar: string[];
  /* Girdiden sezilen sistem türü (ilk geçerli satırdan) */
  tahmin?: { tur: SistemTuru; not: string };
};

/* "39°55'14.7\"K", "39:55:14.7", "39d55m14.7s" → ondalık derece */
function dmsCoz(ham: string): number | null {
  const metin = ham.trim().replace(",", ".");
  const duz = Number(metin);
  if (metin !== "" && Number.isFinite(duz)) return duz;
  const m = metin.match(
    /^(-?\d+(?:\.\d+)?)[°d:\s]\s*(\d+(?:\.\d+)?)?['′m:\s]?\s*(\d+(?:\.\d+)?)?["″s]?\s*([KGDBNSEW])?$/i
  );
  if (!m) return null;
  const derece = Number(m[1]);
  const dakika = m[2] ? Number(m[2]) : 0;
  const saniye = m[3] ? Number(m[3]) : 0;
  if (dakika >= 60 || saniye >= 60) return null;
  let deger = Math.abs(derece) + dakika / 60 + saniye / 3600;
  if (derece < 0) deger = -deger;
  const yon = m[4]?.toUpperCase();
  if (yon === "G" || yon === "S" || yon === "B" || yon === "W") deger = -Math.abs(deger);
  return deger;
}

/* Satırı belirteçlere ayırır. Satırda boşluk/;/tab varsa rakamlar arası
   virgül ondalık ayracı sayılır ("4204673,25 456123,75"); yoksa virgül
   ayraçtır ("39.93,32.85"). */
function satiriBol(satir: string): string[] {
  let s = satir.trim();
  if (/[\s;]/.test(s)) {
    s = s.replace(/(\d),(\d)/g, "$1.$2");
  }
  return s.split(/[;,\t]+|\s+/).filter(Boolean);
}

export function girdiyiAyristir(metin: string): AyristirmaSonucu {
  const noktalar: GirdiNokta[] = [];
  const hatalar: string[] = [];
  let tahmin: AyristirmaSonucu["tahmin"];

  const satirlar = metin.split(/\r?\n/);
  satirlar.forEach((satir, i) => {
    if (!satir.trim()) return;
    if (noktalar.length >= 200) return; // makul üst sınır
    const parcalar = satiriBol(satir);
    if (parcalar.length < 2) {
      hatalar.push(`Satır ${i + 1}: en az iki değer bekleniyor`);
      return;
    }
    /* İlk belirteç sayı/DMS değilse nokta adıdır */
    let ad = "";
    let sayilar = parcalar;
    if (dmsCoz(parcalar[0]) === null) {
      ad = parcalar[0];
      sayilar = parcalar.slice(1);
    }
    /* DMS boşlukla yazılmışsa (39 55 14.7 32 51 12.1) 6 sayı → 2 DMS grubu */
    let a: number | null = null;
    let b: number | null = null;
    if (sayilar.length >= 6 && sayilar.slice(0, 6).every((t) => dmsCoz(t) !== null)) {
      const n = sayilar.slice(0, 6).map((t) => dmsCoz(t) as number);
      if (Math.abs(n[0]) <= 180 && n[1] < 60 && n[2] < 60 && Math.abs(n[3]) <= 180 && n[4] < 60 && n[5] < 60) {
        a = Math.sign(n[0] || 1) * (Math.abs(n[0]) + n[1] / 60 + n[2] / 3600);
        b = Math.sign(n[3] || 1) * (Math.abs(n[3]) + n[4] / 60 + n[5] / 3600);
      }
    }
    if (a === null || b === null) {
      if (sayilar.length < 2) {
        hatalar.push(`Satır ${i + 1}: iki koordinat değeri bulunamadı`);
        return;
      }
      a = dmsCoz(sayilar[0]);
      b = dmsCoz(sayilar[1]);
    }
    if (a === null || b === null) {
      hatalar.push(`Satır ${i + 1}: sayı okunamadı ("${satir.trim().slice(0, 40)}")`);
      return;
    }

    const cografiGibi = Math.abs(a) <= 90 && Math.abs(b) <= 90;
    if (!tahmin) {
      if (cografiGibi) {
        tahmin = { tur: "cografi", not: "Değerler derece aralığında — coğrafi koordinat sezildi." };
      } else {
        const saga = [a, b].find((v) => v >= 26000 && v < 3000000);
        const utmGibi = saga !== undefined && (saga < 370000 || saga > 630000);
        tahmin = {
          tur: utmGibi ? "utm6" : "tm3",
          not: utmGibi
            ? "Sağa değer 3° dilim aralığının dışında — 6° UTM sezildi."
            : "Metrik değerler — 3° TM (Gauss-Krüger) sezildi.",
        };
      }
    }

    if (cografiGibi) {
      /* Türkiye: enlem 35-43, boylam 25-45. Tekil atanabilenleri ata;
         ikisi de belirsizse girilen sıra enlem,boylam kabul edilir. */
      let enlem = a;
      let boylam = b;
      const enlemOlabilir = (v: number) => v >= 34 && v <= 44;
      if (!enlemOlabilir(a) && enlemOlabilir(b)) {
        enlem = b;
        boylam = a;
      }
      noktalar.push({ ad: ad || `N${noktalar.length + 1}`, v1: enlem, v2: boylam });
    } else {
      /* Projeksiyonlu: 3.5M-5M aralığı yukarı (X/kuzey), diğeri sağa (Y/doğu) */
      let yukari = a;
      let saga = b;
      if (b >= 3500000 && b <= 5000000 && !(a >= 3500000 && a <= 5000000)) {
        yukari = b;
        saga = a;
      }
      noktalar.push({ ad: ad || `N${noktalar.length + 1}`, v1: saga, v2: yukari });
    }
  });

  return { noktalar, hatalar, tahmin };
}

/* ---------- Dönüşüm ---------- */

export type DonusumSonucu = {
  ad: string;
  girdi1: number;
  girdi2: number;
  cikti1: number; // coğrafi → enlem; projeksiyonlu → sağa (Y)
  cikti2: number; // coğrafi → boylam; projeksiyonlu → yukarı (X)
  wgsEnlem: number;
  wgsBoylam: number;
  uyari?: string;
};

export function noktalariDonustur(
  noktalar: GirdiNokta[],
  kaynak: KoordinatSistemi,
  hedef: KoordinatSistemi
): { sonuclar: DonusumSonucu[]; hata?: string } {
  let kaynakDef: string;
  let hedefDef: string;
  try {
    kaynakDef = projTanimi(kaynak);
    hedefDef = projTanimi(hedef);
    proj4(kaynakDef, WGS84, [33, 39]); // tanımlar geçerli mi
  } catch {
    return { sonuclar: [], hata: "Koordinat sistemi tanımı oluşturulamadı." };
  }

  const sonuclar: DonusumSonucu[] = [];
  for (const n of noktalar) {
    try {
      /* proj4 sırası: coğrafi [boylam, enlem]; projeksiyonlu [sağa, yukarı] */
      const girdi: [number, number] =
        kaynak.tur === "cografi" ? [n.v2, n.v1] : [n.v1, n.v2];
      const [wgsBoylam, wgsEnlem] = proj4(kaynakDef, WGS84, girdi);
      const [h1, h2] = proj4(kaynakDef, hedefDef, girdi);
      const cikti1 = hedef.tur === "cografi" ? h2 : h1; // enlem | sağa
      const cikti2 = hedef.tur === "cografi" ? h1 : h2; // boylam | yukarı

      let uyari: string | undefined;
      if (!Number.isFinite(cikti1) || !Number.isFinite(cikti2)) {
        uyari = "Dönüşüm sonucu geçersiz — girdi sistemini kontrol edin.";
      } else if (
        wgsEnlem < 33 || wgsEnlem > 45 || wgsBoylam < 23 || wgsBoylam > 47
      ) {
        uyari = "Nokta Türkiye sınırlarının dışına düştü — sistem/dilim seçimini kontrol edin.";
      } else if (
        hedef.tur !== "cografi" &&
        Math.abs(wgsBoylam - hedef.dilim) > (hedef.tur === "tm3" ? 2 : 3.6)
      ) {
        uyari = "Nokta seçilen hedef dilimin dışında — dilim orta meridyenini kontrol edin.";
      } else if (
        kaynak.tur !== "cografi" &&
        Math.abs(wgsBoylam - kaynak.dilim) > (kaynak.tur === "tm3" ? 2 : 3.6)
      ) {
        uyari = "Nokta kaynak dilimin dışında görünüyor — dilim seçimini kontrol edin.";
      }

      sonuclar.push({
        ad: n.ad,
        girdi1: n.v1,
        girdi2: n.v2,
        cikti1,
        cikti2,
        wgsEnlem,
        wgsBoylam,
        uyari,
      });
    } catch {
      sonuclar.push({
        ad: n.ad,
        girdi1: n.v1,
        girdi2: n.v2,
        cikti1: NaN,
        cikti2: NaN,
        wgsEnlem: NaN,
        wgsBoylam: NaN,
        uyari: "Bu nokta dönüştürülemedi.",
      });
    }
  }
  return { sonuclar };
}

/* ---------- Biçimleme ---------- */

export type CiktiBicimi = "ondalik" | "dms" | "metre";

export function dereceyiDmsYap(deger: number, eksen: "enlem" | "boylam"): string {
  const yon =
    eksen === "enlem" ? (deger >= 0 ? "K" : "G") : deger >= 0 ? "D" : "B";
  const mutlak = Math.abs(deger);
  const derece = Math.floor(mutlak);
  const dakikaTam = (mutlak - derece) * 60;
  const dakika = Math.floor(dakikaTam);
  const saniye = (dakikaTam - dakika) * 60;
  return `${derece}°${String(dakika).padStart(2, "0")}′${saniye.toFixed(3).padStart(6, "0")}″${yon}`;
}

export function ciktiyiBicimle(
  s: DonusumSonucu,
  hedefTur: SistemTuru,
  bicim: CiktiBicimi
): [string, string] {
  if (!Number.isFinite(s.cikti1) || !Number.isFinite(s.cikti2)) return ["—", "—"];
  if (hedefTur === "cografi") {
    if (bicim === "dms")
      return [dereceyiDmsYap(s.cikti1, "enlem"), dereceyiDmsYap(s.cikti2, "boylam")];
    return [s.cikti1.toFixed(8), s.cikti2.toFixed(8)];
  }
  return [s.cikti1.toFixed(3), s.cikti2.toFixed(3)];
}
