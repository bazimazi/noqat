/** Original courtyard artwork: water, four gardens and eight-point tiles. */
export function GardenArt() {
  return <svg className="nq-garden-art" viewBox="0 0 400 400" fill="none" aria-hidden="true">
    <defs>
      <pattern id="garden-grid" width="70" height="70" patternUnits="userSpaceOnUse" x="60" y="60"><path d="M0 0H70V70" stroke="var(--nq-accent-alt)" strokeOpacity=".24"/><circle r="3.5" fill="var(--nq-dot)"/></pattern>
      <radialGradient id="garden-light"><stop stopColor="var(--nq-accent)" stopOpacity=".13"/><stop offset="1" stopColor="var(--nq-accent)" stopOpacity="0"/></radialGradient>
    </defs>
    <circle cx="200" cy="200" r="196" fill="url(#garden-light)"/>
    <g transform="rotate(-8 200 200)">
      <rect x="48" y="48" width="304" height="304" rx="25" fill="var(--nq-board-bg)" stroke="var(--nq-accent-alt)" strokeOpacity=".3"/>
      <rect x="60" y="60" width="280" height="280" rx="12" fill="url(#garden-grid)"/>
      {[{x:60,y:60,c:'var(--nq-p0-line)'},{x:200,y:60,c:'var(--nq-p1-line)'},{x:60,y:200,c:'var(--nq-p1-line)'},{x:200,y:200,c:'var(--nq-p0-line)'}].map(({x,y,c},i)=><g key={i} className="nq-garden-quadrant" style={{animationDelay:`${i*.3}s`}}>
        <rect x={x+5} y={y+5} width="130" height="130" rx="6" fill={c} fillOpacity=".08"/>
        <g transform={`translate(${x+70} ${y+70})`}><path d="M0-42 12-24 30-30 24-12 42 0 24 12 30 30 12 24 0 42-12 24-30 30-24 12-42 0-24-12-30-30-12-24Z" fill={c} fillOpacity=".18" stroke={c} strokeWidth="1.2"/><path d="m0-21 21 21-21 21-21-21Z" stroke={c} strokeOpacity=".7"/><circle r="5" fill={c}/></g>
      </g>)}
      <path d="M200 60V340M60 200H340" stroke="var(--nq-accent)" strokeWidth="4" strokeOpacity=".45"/>
      <path d="M60 60H200M200 60V130M340 200V340H270" stroke="var(--nq-accent)" strokeWidth="5" strokeLinecap="round"/>
      <path d="M60 200V340H130M200 60H340V130" stroke="var(--nq-accent-alt)" strokeWidth="5" strokeLinecap="round"/>
      {[0,1,2,3,4].flatMap(r=>[0,1,2,3,4].map(c=><circle key={`${r}-${c}`} cx={60+c*70} cy={60+r*70} r="4" fill="var(--nq-dot)"/>))}
      <path d="m200 181 19 19-19 19-19-19Z" fill="var(--nq-bg)" stroke="var(--nq-accent-alt)" strokeWidth="2"/><circle cx="200" cy="200" r="5" fill="var(--nq-accent)"/>
    </g>
    <path d="m354 43 4 11 11 4-11 4-4 11-4-11-11-4 11-4Z" fill="var(--nq-accent-alt)"/><circle cx="38" cy="316" r="3" fill="var(--nq-accent)"/><circle cx="324" cy="365" r="2" fill="var(--nq-accent-alt)"/>
  </svg>
}
