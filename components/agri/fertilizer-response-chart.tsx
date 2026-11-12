'use client';

type Profile = {id:string; label:string; withoutKgHa:number; withKgHa:number};
const value = (v:number) => new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}).format(v / 1000);

/** Draw paired model outputs; each line refers to one published soil profile. */
export default function FertilizerResponseChart({profiles}:{profiles:Profile[]}) {
  if (!profiles.length || profiles.some(p => !Number.isFinite(p.withoutKgHa) || !Number.isFinite(p.withKgHa) || p.withoutKgHa < 0 || p.withKgHa < 0)) return null;
  const maximum = Math.max(...profiles.flatMap(p => [p.withoutKgHa, p.withKgHa]), 1000);
  const left = 125, right = 710, top = 44, rowHeight = 54;
  const x = (v:number) => left + (right - left) * v / maximum;
  const height = top + profiles.length * rowHeight + 25;
  const summary = profiles.map((p,i) => `Profil ${i+1}, ${p.label} : sans nouvel apport prévu ${value(p.withoutKgHa)}, avec les engrais prévus ${value(p.withKgHa)} tonnes par hectare.`).join(' ');
  return <figure style={{margin:'20px 0',padding:'18px',border:'1px solid #d4e0ee',borderRadius:'12px',background:'#fff'}}>
    <figcaption><strong>Que change le scénario d’engrais ?</strong><br/><span>Deux hypothèses de sol, représentées séparément · rendement simulé en t/ha</span></figcaption>
    <div style={{overflowX:'auto'}}><svg viewBox={`0 0 750 ${height}`} role="img" aria-label={summary} style={{display:'block',width:'100%',minWidth:'460px',height:'auto',marginTop:'8px'}}>
      {[0,.5,1].map(t=><g key={t}><line x1={left+(right-left)*t} x2={left+(right-left)*t} y1="27" y2={height-30} stroke="#dce5ef" strokeDasharray="3 4"/><text x={left+(right-left)*t} y="18" textAnchor="middle" fontSize="13" fill="#405671">{value(maximum*t)}</text></g>)}
      {profiles.map((p,i)=>{const y=top+i*rowHeight;return <g key={p.id}><text x="0" y={y+5} fontSize="14" fill="#233b59">Profil {i+1}</text><line x1={x(p.withoutKgHa)} y1={y} x2={x(p.withKgHa)} y2={y} stroke="#326fba" strokeWidth="3"/><circle cx={x(p.withoutKgHa)} cy={y} r="7" fill="#fff" stroke="#1c4e85" strokeWidth="2.5"/><rect x={x(p.withKgHa)-6} y={y-6} width="12" height="12" rx="2" fill="#1c4e85"/></g>})}
      <text x={right} y={height-5} textAnchor="end" fontSize="13" fill="#405671">Rendement simulé (t/ha)</text>
    </svg></div>
    <p style={{margin:'4px 0 10px',fontSize:'0.9em'}}>○ Sans nouvel apport prévu &nbsp;&nbsp; ■ Avec les engrais prévus</p>
    <ul style={{margin:'0',paddingLeft:'20px'}}>{profiles.map((p,i)=><li key={p.id}><strong>Profil {i+1} — {p.label} :</strong> {value(p.withoutKgHa)} → {value(p.withKgHa)} t/ha.</li>)}</ul>
    <p style={{margin:'10px 0 0',fontSize:'0.9em'}}>Simulation exploratoire, non validée localement. Ces deux profils ne constituent pas un intervalle de confiance et ne décrivent pas nécessairement votre sol.</p>
  </figure>;
}
