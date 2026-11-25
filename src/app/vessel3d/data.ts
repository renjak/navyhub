/* Static ship data for the 3D module of KRI ALAMANG-644.
   Rooms come from the general-arrangement deck plans (navigation, main and lower deck);
   rooms whose label could not be read on the plans are left out on purpose.
   Coordinates are metres: x from the transom forward, y to port, z up from the keel. */

export type Deck = "atas" | "utama" | "bawah";
export type RoomType = "operasi" | "teknik" | "akomodasi" | "gudang" | "layanan" | "sanitasi" | "senjata" | "lorong" | "terbatas";
export type Room = { id: string; n: string; deck: Deck; x0: number; x1: number; side: "F" | "P" | "S"; type: RoomType };
export type SysId = "gps" | "nav" | "kom" | "mesin" | "bbm" | "aw" | "senjata" | "geladak";
export type Part = { id: string; n: string; sys: SysId; p: [number, number, number]; cat: "SEWACO" | "PLATFORM"; loc: string };
export type Post = { id: string; n: string; room: string | null; p: [number, number, number] };
export type Mode = "status" | "telemetri" | "kerusakan" | "tangki" | "geladak" | "jaga" | "putar-ulang" | "latihan" | "sambut";
export type Rgb = [number, number, number];

export const MODES: Array<[Mode, string, string]> = [
  ["status", "Status", "Status sistem"],
  ["telemetri", "Telemetri", "Arah & kecepatan"],
  ["kerusakan", "Kerusakan", "Tandai di kapal"],
  ["tangki", "Tangki", "BBM & air tawar"],
  ["geladak", "Geladak", "Lapisan & ruangan"],
  ["jaga", "Jaga", "Pos jaga hari ini"],
  ["putar-ulang", "Putar ulang", "Jejak pelayaran"],
  ["latihan", "Latihan", "Latihan peran"],
  ["sambut", "Sambut", "Welcome aboard"]
];

export const DECKN: Record<Deck, string> = { atas: "Navigation deck", utama: "Main deck", bawah: "Lower deck" };

const R = (id: string, n: string, deck: Deck, x0: number, x1: number, side: Room["side"], type: RoomType): Room => ({ id, n, deck, x0, x1, side, type });
export const ROOMS: Room[] = [
  R("ceruk_b", "Ceruk buritan & steering gear", "bawah", 0.3, 1.8, "F", "teknik"),
  R("gud_bP", "Gudang buritan kiri", "bawah", 1.8, 4.3, "P", "gudang"),
  R("gud_bS", "Gudang buritan kanan", "bawah", 1.8, 4.3, "S", "gudang"),
  R("mesin", "Ruang mesin", "bawah", 4.3, 10.75, "F", "teknik"),
  R("panel", "Ruang panel control", "bawah", 10.75, 12.4, "P", "teknik"),
  R("inverter", "Ruang inverter", "bawah", 10.75, 12.4, "S", "teknik"),
  R("kopP", "Ruang tidur Kopaska", "bawah", 12.4, 15.8, "P", "akomodasi"),
  R("kopS", "Ruang tidur Kopaska", "bawah", 12.4, 15.8, "S", "akomodasi"),
  R("abkP", "Ruang tidur ABK", "bawah", 15.8, 20.7, "P", "akomodasi"),
  R("abkS", "Ruang tidur regu ABK", "bawah", 15.8, 20.7, "S", "akomodasi"),
  R("kompas", "Compass room & suku cadang", "bawah", 20.7, 25.7, "P", "teknik"),
  R("tanggaB", "Tangga & lorong", "bawah", 20.7, 25.7, "S", "lorong"),
  R("perbekalan", "Gudang perbekalan", "bawah", 25.7, 28.9, "P", "gudang"),
  R("amunisi", "Gudang amunisi", "bawah", 25.7, 28.9, "S", "terbatas"),
  R("toiletB", "Toilet anggota", "bawah", 28.9, 30.1, "F", "sanitasi"),
  R("gunroom", "Gun room", "bawah", 31.0, 34.7, "F", "senjata"),
  R("bahari", "Gudang bahari haluan", "bawah", 34.7, 36.2, "F", "gudang"),
  R("ceruk_h", "Ceruk haluan", "bawah", 36.2, 39.4, "F", "teknik"),
  R("dapur", "Ruang dapur", "utama", 10.3, 12.4, "P", "layanan"),
  R("personel", "Ruang personel", "utama", 14.1, 16.6, "P", "akomodasi"),
  R("cic", "CIC room", "utama", 16.6, 23.3, "P", "operasi"),
  R("palaksa", "Ruang Palaksa", "utama", 23.3, 25.7, "P", "akomodasi"),
  R("perwira", "Ruang perwira", "utama", 26.9, 29.1, "P", "akomodasi"),
  R("co2", "Ruang botol CO2", "utama", 10.3, 11.2, "S", "teknik"),
  R("mandi", "Kamar mandi", "utama", 14.1, 15.2, "S", "sanitasi"),
  R("lounge", "Ruang lounge perwira", "utama", 15.2, 20.7, "S", "akomodasi"),
  R("pantry", "Pantry", "utama", 20.7, 23.3, "S", "layanan"),
  R("radarR", "Radar room", "utama", 23.3, 25.7, "S", "operasi"),
  R("komandan", "Ruang Komandan", "utama", 26.9, 29.1, "S", "akomodasi"),
  R("gudAkom", "Gudang akomodasi haluan", "utama", 29.1, 31.0, "F", "gudang"),
  R("hv", "HV room", "atas", 17.4, 23.1, "P", "teknik"),
  R("radiokom", "Ruang radio komunikasi", "atas", 17.4, 21.0, "S", "operasi"),
  R("tanggaA", "Tangga", "atas", 21.0, 23.1, "S", "lorong"),
  R("anjungan", "Ruang anjungan", "atas", 23.1, 28.2, "F", "operasi")
];
export const ROOM: Record<string, Room> = Object.fromEntries(ROOMS.map(r => [r.id, r]));

export const TYPEC: Record<RoomType, Rgb> = { operasi: [.5, .72, .95], teknik: [.96, .72, .3], akomodasi: [.42, .82, .7], gudang: [.72, .64, .95], layanan: [.95, .62, .8], sanitasi: [.6, .66, .74], senjata: [1, .5, .52], lorong: [.45, .52, .6], terbatas: [.36, .4, .47] };
export const TYPEN: Record<RoomType, string> = { operasi: "Operasi", teknik: "Teknik", akomodasi: "Akomodasi", gudang: "Gudang", layanan: "Layanan", sanitasi: "Sanitasi", senjata: "Senjata", lorong: "Lorong & tangga", terbatas: "Terbatas" };

const P = (id: string, n: string, sys: SysId, p: [number, number, number], cat: Part["cat"], loc: string): Part => ({ id, n, sys, p, cat, loc });
export const PARTS: Part[] = [
  P("gps", "Antena GPS", "gps", [16.9, 0, 17.4], "SEWACO", "Tiang utama"),
  P("radar", "Radar navigasi", "nav", [22.15, 0, 8.8], "SEWACO", "Atap anjungan"),
  P("radar2", "Radar kedua", "nav", [24.4, 0, 8.15], "SEWACO", "Atap anjungan"),
  P("eo", "Sensor penjejak", "nav", [20.4, 0, 11.0], "SEWACO", "Tiang utama, platform 1"),
  P("lamp", "Lampu sorot", "nav", [27.1, 1.25, 8.1], "SEWACO", "Atap anjungan"),
  P("satcom", "SATCOM", "kom", [15.9, -1.4, 7.3], "SEWACO", "Geladak atas buritan"),
  P("radio", "Peralatan radio", "kom", [19.2, -1.2, 6.4], "SEWACO", "Ruang radio komunikasi"),
  P("m1", "Mesin utama 1 (kiri)", "mesin", [8.9, 1.55, 1.7], "PLATFORM", "Ruang mesin"),
  P("m2", "Mesin utama 2 (tengah)", "mesin", [8.9, 0, 1.7], "PLATFORM", "Ruang mesin"),
  P("m3", "Mesin utama 3 (kanan)", "mesin", [8.9, -1.55, 1.7], "PLATFORM", "Ruang mesin"),
  P("p1", "Baling-baling kiri", "mesin", [1.68, 1.55, -0.05], "PLATFORM", "Buritan, bawah air"),
  P("p2", "Baling-baling tengah", "mesin", [1.68, 0, -0.1], "PLATFORM", "Buritan, bawah air"),
  P("p3", "Baling-baling kanan", "mesin", [1.68, -1.55, -0.05], "PLATFORM", "Buritan, bawah air"),
  P("kemudi", "Mesin kemudi", "mesin", [1.0, 0, 2.2], "PLATFORM", "Ceruk buritan"),
  P("gun", "Meriam haluan", "senjata", [34.4, 0, 5.0], "SEWACO", "Geladak haluan"),
  P("mgP", "Senapan mesin kiri", "senjata", [12.3, 2.4, 6.6], "SEWACO", "Geladak atas buritan"),
  P("mgS", "Senapan mesin kanan", "senjata", [12.3, -2.4, 6.6], "SEWACO", "Geladak atas buritan"),
  P("rl1", "Peluncur roket 1", "senjata", [5.0, 0, 4.6], "SEWACO", "Geladak utama buritan"),
  P("rl2", "Peluncur roket 2", "senjata", [6.25, 0, 4.6], "SEWACO", "Geladak utama buritan"),
  P("rhib", "Sekoci RHIB", "geladak", [2.1, 0, 4.1], "PLATFORM", "Geladak utama buritan"),
  P("crane", "Derek sekoci", "geladak", [1.5, 1.6, 5.4], "PLATFORM", "Geladak utama buritan"),
  P("windlass", "Jangkar & windlass", "geladak", [38.9, 0, 4.3], "PLATFORM", "Geladak haluan")
];
export const PART: Record<string, Part> = Object.fromEntries(PARTS.map(p => [p.id, p]));
export const assetCode = (p: Part) => "3D-" + p.id.toUpperCase();

export const SYS: Array<{ id: SysId; n: string; mode: Mode; p: [number, number, number] }> = [
  { id: "gps", n: "GPS", mode: "telemetri", p: [16.9, 0, 17.6] },
  { id: "nav", n: "Navigasi & sensor", mode: "kerusakan", p: [22.15, 0, 9.3] },
  { id: "kom", n: "Komunikasi", mode: "kerusakan", p: [15.9, -1.4, 7.6] },
  { id: "mesin", n: "Propulsi", mode: "kerusakan", p: [8.9, 0, 2.6] },
  { id: "bbm", n: "Tangki BBM", mode: "tangki", p: [15.7, 0, 1.0] },
  { id: "aw", n: "Tangki air tawar", mode: "tangki", p: [23.3, 0, 1.0] },
  { id: "senjata", n: "Persenjataan", mode: "kerusakan", p: [34.4, 0, 5.7] },
  { id: "geladak", n: "Geladak & sekoci", mode: "kerusakan", p: [3.5, 0, 5.6] }
];

/* Only the Perwira Jaga post has a data source today (daily_watch_assignments). */
export const POSTS: Post[] = [
  { id: "pj", n: "Perwira jaga", room: "anjungan", p: [25.5, 0.8, 6.6] },
  { id: "jm", n: "Juru mudi", room: "anjungan", p: [26.8, -0.7, 6.6] },
  { id: "cic", n: "Operator CIC", room: "cic", p: [19.9, 1.6, 4.4] },
  { id: "rd", n: "Operator radio", room: "radiokom", p: [19.2, -1.2, 6.4] },
  { id: "ms", n: "Jaga mesin", room: "panel", p: [11.6, 1.6, 2.0] },
  { id: "gd", n: "Jaga geladak", room: null, p: [8.0, -2.0, 3.9] }
];

/* Tank positions are schematic: the drawings do not show the tanks. */
export const TANKS = [
  { id: "bbm" as const, n: "Tangki BBM (HSD)", short: "BBM", category: "BBM", x0: 10.9, x1: 20.6, y: 1.25, z0: 0.36, z1: 1.0, col: [.96, .66, .24] as Rgb },
  { id: "aw" as const, n: "Tangki air tawar", short: "Air tawar", category: "Air Tawar", x0: 21.0, x1: 25.6, y: 1.2, z0: 0.36, z1: 1.0, col: [.35, .68, 1] as Rgb }
];

export const DRILLC: Record<string, Rgb> = { api: [1, .45, .18], bocor: [.25, .62, 1], asap: [.78, .8, .84] };
export const DRILLN: Record<string, string> = { api: "Kebakaran", bocor: "Kebocoran", asap: "Asap" };

export type TrackPoint = { t: number; e: number; n: number; cog: number | null; sog: number | null };
/* Demo voyage, clearly labelled in the UI: relative nautical miles east/north over two hours. */
export const DEMO_TRACK: TrackPoint[] = (() => {
  const wp = [[0, 0], [0.8, 1.6], [2.6, 3.2], [5.0, 3.6], [7.0, 2.4], [7.4, 0.4], [5.6, -1.0], [3.0, -0.8], [1.2, -0.3], [0.1, 0.05]];
  const pts: number[][] = [];
  for (let i = 0; i < wp.length - 1; i++) {
    const p0 = wp[Math.max(i - 1, 0)], p1 = wp[i], p2 = wp[i + 1], p3 = wp[Math.min(i + 2, wp.length - 1)];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      pts.push([0, 1].map(d => .5 * (2 * p1[d] + (-p0[d] + p2[d]) * t + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * t2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * t3)));
    }
  }
  pts.push(wp[wp.length - 1]);
  const t0 = Date.UTC(2026, 0, 1, 0, 0), dt = 2 * 3600e3 / (pts.length - 1);
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dE = b[0] - a[0], dN = b[1] - a[1], span = (Math.min(pts.length - 1, i + 1) - Math.max(0, i - 1)) * dt / 3600e3;
    return { t: t0 + i * dt, e: p[0], n: p[1], cog: (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360, sog: Math.hypot(dE, dN) / span };
  });
})();
export const DEMO_LOGS: Array<[number, string]> = [[0, "Lepas tali, keluar alur"], [0.2, "Latihan peran kebakaran"], [0.45, "Uji kecepatan"], [0.7, "Latihan orang jatuh ke laut"], [1, "Kembali, sandar"]];

/* Convert GPS rows to a local track in nautical miles around the first fix. */
export function gpsTrack(rows: Array<{ position_at: string; latitude: number; longitude: number; speed_knots: number | null; course_degrees: number | null }>): TrackPoint[] {
  if (!rows.length) return [];
  const lat0 = rows[0].latitude, lon0 = rows[0].longitude, k = Math.cos(lat0 * Math.PI / 180);
  const pts = rows.map(r => ({ t: new Date(r.position_at).getTime(), e: (r.longitude - lon0) * 60 * k, n: (r.latitude - lat0) * 60, cog: r.course_degrees, sog: r.speed_knots }));
  return pts.map((p, i) => {
    if (p.cog != null && p.sog != null) return p;
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    const dE = b.e - a.e, dN = b.n - a.n, hours = (b.t - a.t) / 3600e3;
    return { ...p, cog: p.cog ?? (Math.hypot(dE, dN) > 1e-6 ? (Math.atan2(dE, dN) * 180 / Math.PI + 360) % 360 : null), sog: p.sog ?? (hours > 0 ? Math.hypot(dE, dN) / hours : null) };
  });
}
export function trackAt(track: TrackPoint[], f: number): TrackPoint {
  const n = track.length - 1;
  if (n <= 0) return track[0];
  const x = Math.min(n - 1e-6, Math.max(0, f * n)), i = Math.floor(x), t = x - i, a = track[i], b = track[i + 1];
  const lerp = (u: number, v: number) => u + (v - u) * t;
  return { t: lerp(a.t, b.t), e: lerp(a.e, b.e), n: lerp(a.n, b.n), cog: t < .5 ? a.cog : b.cog, sog: a.sog != null && b.sog != null ? lerp(a.sog, b.sog) : (a.sog ?? b.sog) };
}
