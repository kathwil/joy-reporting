(function(){
const { ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, BarChart, ReferenceLine } = Recharts;

// ─── DATEN ────────────────────────────────────────────────────────────────────
// Eventdaten verifiziert gegen "joy-durchfuehrungen.csv" (Referenzliste).
// Wichtig: Ab 2026 läuft bei manchen Feiern das Subevent "JOY Youth Academy"
// parallel weiter. Der letzte Submission-Timestamp einer Datei ist deshalb NICHT
// zuverlässig das Durchführungsdatum — alle Daten unten wurden gegen die
// Referenzliste geprüft und, wo nötig, korrigiert (z.B. Mai 2026 = Fr, 01.05.2026;
// Jun 2026 = Fr, 05.06.2026; Sep 2026 = Fr, 04.09.2026).
//
// Metrik-Logik:
//   reg      = registriert UND erschienen (Check-in bestätigt)
//   walkin   = ohne Voranmeldung erschienen (erst ab Sep 2025 erfasst)
//   noshow   = vor Anmeldeschluss (16:00) registriert, aber nicht erschienen
//   total    = reg + walkin (tatsächlich anwesende Personen)
//   guestPct = Anteil der Anwesenden, die als Gast einer Buchung mitkamen
//   newPct   = Anteil neuer namentlicher Personen (chronologisch kumuliert)
//   survey   = im Post-Event-Bericht genannte Schätzung ("rund X Personen");
//              Erhebungsmethode dort nicht dokumentiert → nur grober Referenzwert
const DATA = [
  { name:"Nov 2024", reg:96, walkin:64, noshow:0, total:160, guestPct:40, newPct:100, survey:160, hasEC:false },
  { name:"Jan 2025", reg:83, walkin:0, noshow:0, total:83, guestPct:31, newPct:46, survey:110, hasEC:false },
  { name:"Feb 2025", reg:85, walkin:0, noshow:0, total:85, guestPct:36, newPct:50, survey:null, hasEC:false },
  { name:"Apr 2025", reg:62, walkin:0, noshow:0, total:62, guestPct:35, newPct:55, survey:135, hasEC:false },
  { name:"Mai 2025", reg:73, walkin:0, noshow:0, total:73, guestPct:45, newPct:29, survey:null, hasEC:false },
  { name:"Jun 2025", reg:75, walkin:0, noshow:0, total:75, guestPct:53, newPct:26, survey:110, hasEC:false },
  { name:"Sep 2025", reg:83, walkin:19, noshow:16, total:102, guestPct:66, newPct:31, survey:120, hasEC:true },
  { name:"Nov 2025", reg:152, walkin:21, noshow:16, total:173, guestPct:64, newPct:45, survey:160, hasEC:true },
  { name:"Dez 2025", reg:73, walkin:1, noshow:3, total:74, guestPct:55, newPct:30, survey:null, hasEC:true },
  { name:"Jan 2026", reg:97, walkin:23, noshow:8, total:120, guestPct:67, newPct:20, survey:130, hasEC:true },
  { name:"Feb 2026", reg:91, walkin:19, noshow:6, total:110, guestPct:61, newPct:21, survey:null, hasEC:true },
  { name:"Mär 2026", reg:55, walkin:8, noshow:34, total:63, guestPct:56, newPct:7, survey:null, hasEC:true },
  { name:"Mai 2026", reg:71, walkin:15, noshow:4, total:86, guestPct:59, newPct:15, survey:null, hasEC:true },
  { name:"Jun 2026", reg:59, walkin:7, noshow:2, total:66, guestPct:55, newPct:20, survey:null, hasEC:true },
  { name:"Sep 2026", reg:66, walkin:12, noshow:7, total:78, guestPct:62, newPct:11, survey:null, hasEC:true },
];

// Anmeldevorlauf über alle 15 Feiern kumuliert (Nov 2024 via eyeVIP-Anmeldedatum,
// übrige via Rsvp.io Submission-Timestamp, dedupliziert nach Buchungsgruppe).
// Index 0–14 = T-0…T-14 Tage vor Durchführung, Index 15 = T-14+.
const LEAD_TIME = [78, 91, 70, 59, 85, 28, 10, 9, 17, 11, 13, 36, 19, 11, 20, 157];
const LEAD_LABELS = ["T-0","T-1","T-2","T-3","T-4","T-5","T-6","T-7","T-8","T-9","T-10","T-11","T-12","T-13","T-14","T-14+"];

// Teilnahmehäufigkeit: Abgleich namentlich registrierter Personen über alle 15
// Feiern (Vor- und Nachname normalisiert). 264 unterscheidbare Personen mit
// zusammen 638 namentlichen Teilnahmen.
//   personen  = Anzahl Personen in dieser Häufigkeitsklasse
//   teilnahmen = von dieser Klasse erzeugte Teilnahmen (Headcount-Anteil)
// WICHTIG: erfasst ausschliesslich namentlich registrierte Personen. Mitgebrachte
// Gäste sind anonym (rund die Hälfte aller Anwesenden) und hier nicht enthalten.
const RETENTION = [
  { label:"1×", personen:139, teilnahmen:139, desc:"einmalig" },
  { label:"2×", personen:47, teilnahmen:94, desc:"wiedergekommen" },
  { label:"3–4×", personen:37, teilnahmen:124, desc:"regelmässig" },
  { label:"5+ ×", personen:37, teilnahmen:261, desc:"Stammgäste" },
];
const RET_PERSONEN_TOTAL = 260;
const RET_TEILNAHMEN_TOTAL = 618;

// ─── THEME (JOY-Brand: Navy / Gold, helles UI) ────────────────────────────────
const C = {
  green:"#152a40", lightGreen:"#637281", red:"#e5a400", gray:"#9ea7b1", purple:"#233f60",
  gold:"#233f60", navy:"#152a40",
  bg:"#e8eaec", card:"#FFFFFF", border:"#dde3e8", text:"#152a40", muted:"#5b6b7d", grid:"#eef1f3"
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const MainTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: C.text, boxShadow:"0 4px 16px rgba(25,32,53,0.10)" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ color: C.green }}>Registriert &amp; erschienen: {d?.reg}</div>
      {d?.walkin > 0 && <div style={{ color: "#374f63" }}>Walk-Ins: {d.walkin}</div>}
      {d?.noshow > 0 && <div style={{ color: C.red }}>No-Shows: {d.noshow}</div>}
      <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 6, paddingTop: 6, fontWeight: 600 }}>Total: {d?.total}</div>
      {d?.survey && <div style={{ color: C.muted, marginTop:2 }}>Umfrageschätzung: ~{d.survey}</div>}
      {!d?.hasEC && <div style={{ color: C.muted, marginTop:4, fontSize:11, fontStyle:"italic" }}>Ohne Eingangskontrolle — Walk-Ins nicht erfasst</div>}
    </div>
  );
};

const SurveyMarker = ({ x, y, width, value }) =>
  !value ? null : <line x1={x + 2} y1={y} x2={x + width - 2} y2={y} stroke={C.gray} strokeWidth={2.5} strokeLinecap="round" />;

const MetricCard = ({ label, value, sub }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px" }}>
    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 500, color: C.text }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>{sub}</div>}
  </div>
);

const SectionLabel = ({ children, note }) => (
  <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: C.muted, marginBottom: 10, fontWeight: 600 }}>
    {children}
    {note && <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}> {note}</span>}
  </div>
);

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function JOYDashboard() {
  const avg = Math.round(DATA.reduce((s, e) => s + e.total, 0) / DATA.length);
  const cumulative = DATA.reduce((s, e) => s + e.total, 0);
  const latest = DATA[DATA.length - 1];
  const ec = DATA.filter(e => e.hasEC);
  const avgSR = Math.round(ec.reduce((s, e) => s + (e.reg / (e.reg + e.noshow) * 100), 0) / ec.length);
  const avgGuest = Math.round(DATA.reduce((s, e) => s + e.guestPct, 0) / DATA.length);

  const leadData = LEAD_LABELS.map((label, i) => ({ label, value: LEAD_TIME[i] }));
  const leadTotal = LEAD_TIME.reduce((a, b) => a + b, 0);
  const pct = n => Math.round(n / leadTotal * 100);
  const last3 = pct(LEAD_TIME.slice(0, 4).reduce((a, b) => a + b, 0));
  const last7 = pct(LEAD_TIME.slice(0, 8).reduce((a, b) => a + b, 0));
  const t14 = pct(LEAD_TIME[15]);

  const chartWidth = Math.max(DATA.length * 58, 620);
  const axisTick = { fill: C.muted, fontSize: 10 };
  const tooltipStyle = { background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12 };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", padding: "24px 20px", fontFamily: "'Montserrat', system-ui, sans-serif", color: C.text, boxSizing: "border-box" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: 4, fontWeight: 600 }}>JOY · Kathwil</div>
        <div style={{ fontSize: 22, fontWeight: 600 }}>Teilnehmer pro Feier</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{DATA.length} Durchführungen · Nov 2024 – Sep 2026</div>
      </div>

      {/* Metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28 }}>
        <MetricCard label="Ø Teilnehmende" value={avg} sub={`${DATA.length} Feiern`} />
        <MetricCard label="Kumulierte Eintritte" value={cumulative.toLocaleString("de-CH")} sub="Personeneintritte total" />
        <MetricCard label="Ø Gästeanteil" value={`${avgGuest}%`} sub="Mitgebrachte Personen" />
        <MetricCard label="Ø Erscheinungsrate" value={`${avgSR}%`} sub={`${ec.length} Feiern mit Eingangskontrolle`} />
      </div>

      {/* CHART 1 — Teilnehmende */}
      <div style={{ marginBottom: 22 }}>
        <SectionLabel>Teilnehmende pro Feier</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, fontSize: 11, color: C.muted, marginBottom: 10 }}>
          {[["Registriert & erschienen", C.green], ["Walk-Ins", C.lightGreen], ["No-Shows", C.red]].map(([l, col]) => (
            <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 10, height: 10, background: col, borderRadius: 2, flexShrink: 0 }} />{l}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 16, height: 2, background: C.gray }} />Umfrageschätzung
          </span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: chartWidth }}>
            <ResponsiveContainer width="100%" height={290}>
              <ComposedChart data={DATA} margin={{ top: 4, right: 12, bottom: 48, left: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="name" tick={axisTick} angle={-38} textAnchor="end" interval={0} height={52} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                <Tooltip content={<MainTooltip />} cursor={{ fill: "rgba(25,32,53,0.04)" }} />
                <Bar dataKey="reg"    stackId="a" fill={C.green}      isAnimationActive={false} />
                <Bar dataKey="walkin" stackId="a" fill={C.lightGreen} isAnimationActive={false} />
                <Bar dataKey="noshow" stackId="a" fill={C.red} radius={[3,3,0,0]} isAnimationActive={false} />
                <Bar dataKey="survey" fill="none" shape={<SurveyMarker />} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          Vor Sep 2025 gab es keine Eingangskontrolle — nicht angemeldete Personen sind für diese Feiern nicht erfasst. Die tatsächliche Teilnahme lag dort nachweislich höher (siehe Umfrageschätzungen). Nov 2024 stammt aus dem abgelösten eyevip-System, das weder Walk-Ins noch mitgebrachte Gäste erfasst: dort sind 96 Anmeldungen belegt, die restlichen 64 Personen bis zur berichteten Gesamtzahl von 160 sind eine Hochrechnung aus der Umfrageschätzung, keine Messung.
        </div>
      </div>

      {/* CHART 2 — Gästeanteil */}
      <div style={{ marginBottom: 22 }}>
        <SectionLabel note="(als Gast einer Buchung mitgebrachte Personen)">Gästeanteil %</SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: chartWidth }}>
            <ResponsiveContainer width="100%" height={190}>
              <LineChart data={DATA} margin={{ top: 4, right: 12, bottom: 48, left: 0 }}>
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="name" tick={axisTick} angle={-38} textAnchor="end" interval={0} height={52} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} domain={[0, 75]} tickFormatter={v => v + "%"} />
                <ReferenceLine y={50} stroke={C.border} strokeDasharray="4 3" />
                <Tooltip formatter={v => [`${v}%`, "Gästeanteil"]} contentStyle={tooltipStyle} labelStyle={{ color: C.text }} itemStyle={{ color: C.purple }} />
                <Line type="monotone" dataKey="guestPct" stroke={C.purple} strokeWidth={2} dot={{ r: 3, fill: C.purple }} activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* CHART 3 — Neue Personen */}
      <div style={{ marginBottom: 22 }}>
        <SectionLabel note="(chronologisch kumuliert, Nov 2024 als Baseline)">Neue namentliche Personen %</SectionLabel>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: chartWidth }}>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={DATA} margin={{ top: 4, right: 12, bottom: 48, left: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={C.grid} />
                <XAxis dataKey="name" tick={axisTick} angle={-38} textAnchor="end" interval={0} height={52} />
                <YAxis tick={{ fill: C.muted, fontSize: 11 }} domain={[0, 105]} tickFormatter={v => v + "%"} />
                <Tooltip formatter={v => [`${v}%`, "Neue Personen"]} contentStyle={tooltipStyle} labelStyle={{ color: C.text }} itemStyle={{ color: C.green }} />
                <Bar dataKey="newPct" radius={[3,3,0,0]} isAnimationActive={false}>
                  {DATA.map((e, i) => <Cell key={i} fill={e.newPct >= 40 ? C.green : e.newPct >= 25 ? "#637281" : "#9ea7b1"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          Erfasst nur namentlich registrierte Personen. Mitgebrachte Gäste sind anonym und darin nicht enthalten — der reale Anteil neuer Gesichter liegt höher. Der fallende Verlauf ist strukturell erwartbar: je mehr Feiern stattgefunden haben, desto mehr Personen sind bereits bekannt.
        </div>
      </div>

      {/* CHART 4 — Anmeldevorlauf */}
      <div style={{ marginBottom: 8 }}>
        <SectionLabel note="(Tage vor der Durchführung, alle Feiern kumuliert)">Anmeldevorlauf</SectionLabel>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {[["Letzte 3 Tage", `${last3}%`], ["Letzte 7 Tage", `${last7}%`], ["14+ Tage Vorlauf", `${t14}%`], ["n", `${leadTotal} Buchungsgruppen`]].map(([l, v]) => (
            <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
              <span style={{ color: C.muted }}>{l}: </span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={leadData} margin={{ top: 4, right: 12, bottom: 8, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={C.grid} />
            <XAxis dataKey="label" tick={axisTick} interval={0} />
            <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
            <Tooltip formatter={v => [`${v} Buchungen (${pct(v)}%)`, "Anmeldungen"]} contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
            <Bar dataKey="value" radius={[3,3,0,0]} isAnimationActive={false}>
              {leadData.map((_, i) => (
                <Cell key={i} fill={i === 15 ? C.gold : C.navy} fillOpacity={i === 15 ? 0.85 : 0.18 + (1 - i / 15) * 0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>
          Dedupliziert nach Buchungsgruppe, nicht nach Person. Anmeldeschluss ist jeweils 16:00 Uhr am Durchführungstag; T-0 umfasst alle Anmeldungen davor am selben Tag.
        </div>
      </div>

      {/* ABSCHNITT — Teilnahmehäufigkeit */}
      <div style={{ marginTop: 34, paddingTop: 26, borderTop: `1px solid ${C.border}` }}>
        <SectionLabel note="(namentlich registrierte Personen über alle 15 Feiern)">Einmal- vs. Mehrfachteilnahme</SectionLabel>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 18 }}>
          {RETENTION.map(r => {
            const pPct = Math.round(r.personen / RET_PERSONEN_TOTAL * 100);
            const tPct = Math.round(r.teilnahmen / RET_TEILNAHMEN_TOTAL * 100);
            const isOnce = r.label === "1×";
            return (
              <div key={r.label} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{r.label}</span>
                  <span style={{ fontSize: 10, color: C.muted }}>{r.desc}</span>
                </div>
                <div style={{ fontSize: 26, fontWeight: 500, color: isOnce ? C.red : C.green, lineHeight: 1.2 }}>{pPct}%</div>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 10 }}>{r.personen} Personen</div>
                <div style={{ height: 4, background: C.grid, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ width: `${tPct}%`, height: "100%", background: isOnce ? C.red : C.green, opacity: 0.55 }} />
                </div>
                <div style={{ fontSize: 10, color: C.muted }}>erzeugt {tPct}% aller Teilnahmen</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {[
            ["Nur einmal da", "53%"],
            ["Mehr als einmal", "47%"],
            ["Ø Teilnahmen pro Person", "2,4"],
            ["Häufigste Einzelperson", "13 Feiern"],
          ].map(([l, v]) => (
            <div key={l} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "6px 12px", fontSize: 12 }}>
              <span style={{ color: C.muted }}>{l}: </span><span style={{ fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
            Die 14% Stammgäste (5+ Teilnahmen) erzeugen 42% aller namentlichen Teilnahmen — die 53% Einmalbesuchenden zusammen nur 22%. JOY trägt sich also über einen kleinen, sehr aktiven Kern, während die Mehrheit nach dem ersten Besuch nicht wiederkommt.
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>
          Grundlage: 260 unterscheidbare Personen mit 618 Teilnahmen, abgeglichen über normalisierte Vor- und Nachnamen. <strong>Erfasst ausschliesslich namentlich registrierte Personen</strong> — mitgebrachte Gäste sind anonym und machen rund die Hälfte aller Anwesenden aus; über deren Wiederkehrverhalten sagen diese Zahlen nichts. Der Einmal-Anteil sinkt zudem strukturell mit jeder weiteren Feier, da Personen aus späteren Durchführungen noch weniger Gelegenheit hatten wiederzukommen.
        </div>
      </div>
    </div>
  );
}
window.JOYDashboard = JOYDashboard;
})();
