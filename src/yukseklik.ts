/* Sanal Drone — parsel merkezinin zemin kotu (istemci tarafı).
   Kaynak: AWS açık veri "Terrarium" yükseklik karoları (anahtarsız, CORS açık).
   Neden gerekli: Google 3B karolarından yükseklik örneklemesi
   (sampleHeightMostDetailed) ancak karolar yüklenince döner; kamera da doğru
   yüksekliği bilmeden karoların yükleneceği yere bakamaz (tavuk-yumurta).
   Bu tek PNG isteği ~100 ms'de kadar tahmini kot verir; Cesium örneklemesi
   arka planda değeri rafine eder. */

export async function zeminYuksekligiM(lon: number, lat: number): Promise<number | null> {
  try {
    const z = 12;
    const n = 2 ** z;
    const xf = ((lon + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const yf = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    const x = Math.floor(xf);
    const y = Math.floor(yf);
    if (x < 0 || y < 0 || x >= n || y >= n) return null;

    const yanit = await fetch(
      `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!yanit.ok) return null;

    const bitmap = await createImageBitmap(await yanit.blob());
    const tuval = document.createElement("canvas");
    tuval.width = 256;
    tuval.height = 256;
    const ctx = tuval.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);
    const px = Math.min(255, Math.max(0, Math.floor((xf - x) * 256)));
    const py = Math.min(255, Math.max(0, Math.floor((yf - y) * 256)));
    const [r, g, b] = ctx.getImageData(px, py, 1, 1).data;

    const yukseklik = r * 256 + g + b / 256 - 32768;
    if (!Number.isFinite(yukseklik) || yukseklik < -500 || yukseklik > 9000) return null;

    /* Terrarium ortometrik (deniz seviyesi) kot verir; Cesium elipsoid ister.
       Türkiye'de jeoit ondülasyonu ~+37 m — kamera konumu için yeterli. */
    return yukseklik + 37;
  } catch {
    return null;
  }
}
