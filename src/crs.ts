import proj4 from "proj4";

/* MuhzekCAD — çizim koordinatlarını (DXF X=sağa, Y=yukarı; genelde metre)
   ITRF96/TUREF veya ED50 zemin sistemlerinden WGS84 enlem/boylamına çevirir.
   Kullanıcı CRS'i ELLE seçer — dosya içeriğinden otomatik tespit yapılmaz
   (ölçek/dilim/datum belirsizliği; hatalı sezgi tehlikeli olur). */

export type CrsAdi =
  | "ham"
  | "tm27"
  | "tm30"
  | "tm33"
  | "tm36"
  | "tm39"
  | "tm42"
  | "tm45"
  | "utm35"
  | "utm36";

export const CRS_SIRALAMASI: CrsAdi[] = [
  "ham",
  "tm27",
  "tm30",
  "tm33",
  "tm36",
  "tm39",
  "tm42",
  "tm45",
  "utm35",
  "utm36",
];

export const CRS_ADLARI: Record<CrsAdi, string> = {
  ham: "Ham (dönüşümsüz — çizim birimi)",
  tm27: "ITRF96/TUREF 3° TM — Dilim 27",
  tm30: "ITRF96/TUREF 3° TM — Dilim 30",
  tm33: "ITRF96/TUREF 3° TM — Dilim 33",
  tm36: "ITRF96/TUREF 3° TM — Dilim 36",
  tm39: "ITRF96/TUREF 3° TM — Dilim 39",
  tm42: "ITRF96/TUREF 3° TM — Dilim 42",
  tm45: "ITRF96/TUREF 3° TM — Dilim 45",
  utm35: "ED50 UTM — Dilim 35",
  utm36: "ED50 UTM — Dilim 36",
};

const TM3_DILIMLERI: Record<string, number> = {
  tm27: 27,
  tm30: 30,
  tm33: 33,
  tm36: 36,
  tm39: 39,
  tm42: 42,
  tm45: 45,
};

const WGS84 = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs";

/* ED50 → WGS84 Türkiye ortalama parametreleri (bkz. ./koordinat.ts) */
const ED50_TOWGS84 = "-87,-98,-121";

function projTanimi(crs: CrsAdi): string | null {
  if (crs === "ham") return null;
  if (crs === "utm35" || crs === "utm36") {
    const dilim = crs === "utm35" ? 35 : 36;
    return `+proj=utm +zone=${dilim} +ellps=intl +towgs84=${ED50_TOWGS84} +units=m +no_defs`;
  }
  const dilim = TM3_DILIMLERI[crs];
  return `+proj=tmerc +lat_0=0 +lon_0=${dilim} +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs`;
}

/* Çizim koordinatını (x=sağa, y=yukarı) seçilen CRS'e göre WGS84 enlem/boylama
   çevirir. "ham" için (ve dönüşüm başarısızsa) null döner. */
export function koordinatDonustur(
  x: number,
  y: number,
  crs: CrsAdi
): { enlem: number; boylam: number } | null {
  const tanim = projTanimi(crs);
  if (!tanim) return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  try {
    const [boylam, enlem] = proj4(tanim, WGS84, [x, y]);
    if (!Number.isFinite(enlem) || !Number.isFinite(boylam)) return null;
    return { enlem, boylam };
  } catch {
    return null;
  }
}
