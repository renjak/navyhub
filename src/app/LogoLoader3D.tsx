/* 3D loading mark: the ALNAV mark (owner-supplied app icon) extruded in CSS 3D and turned
   slowly while the session loads. Shapes traced from public/icons/alnav-mark-source.jpg
   (overlap with the source 97–98 %), colours sampled from it. No libraries, no video:
   stacked SVG layers give the depth. Static under prefers-reduced-motion. */

const NAVY = "49,363 274,129 372,130 146,363";
const RED = "191,357 398,130 348,357";
const LAYERS = 22;

function Mark({ navy, red }: { navy: string; red: string }) {
  return <svg viewBox="40 120 370 252" aria-hidden="true" focusable="false">
    <polygon points={NAVY} fill={navy} />
    <polygon points={RED} fill={red} />
  </svg>;
}

export default function LogoLoader3D({ label = "INITIALIZING", overlay = false, leaving = false }: { label?: string; overlay?: boolean; leaving?: boolean }) {
  return <main className={"loading alnav-loader" + (overlay ? " is-overlay" : "") + (leaving ? " is-leaving" : "")} role="status" aria-live="polite" aria-hidden={leaving || undefined} aria-label={"ALNAV DMS " + label.toLowerCase()}>
    <div className="alnav-loader-stage">
      <div className="alnav-loader-spin">
        {Array.from({ length: LAYERS }, (_, i) => {
          const edge = i === 0 || i === LAYERS - 1;
          const z = (i - (LAYERS - 1) / 2) * 1.25;
          return <div key={i} className={"alnav-loader-layer" + (i === LAYERS - 1 ? " is-front" : "")} style={{ transform: `translateZ(${z}px)` }}>
            {edge ? <Mark navy="#0C213E" red="#D4332B" /> : <Mark navy="#06142A" red="#8F2019" />}
          </div>;
        })}
      </div>
      <div className="alnav-loader-shadow" aria-hidden="true" />
    </div>
    <img className="alnav-loader-word" src="/branding/alnav-dms-logo.jpg" alt="ALNAV DMS" />
    <span className="alnav-loader-label">{label}</span>
  </main>;
}
