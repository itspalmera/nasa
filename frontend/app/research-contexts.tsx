import { ArrowUpRight, Globe2, Moon, Orbit } from 'lucide-react';

/** Conceptual diagrams, deliberately separate from measured research results. */
export function FlameComparison() {
  return <div className="flame-comparison" aria-label="Conceptual comparison of flame shapes">
    {[false, true].map(micro => <div className="flame-sample" key={String(micro)}>
      <div className="flame-disc"><svg viewBox="0 0 100 140" role="img" aria-label={micro ? 'Rounded blue flame in microgravity' : 'Elongated flame on Earth'}>
        <defs><radialGradient id={micro ? 'micro-core' : 'earth-core'}><stop stopColor="#effbff"/><stop offset=".3" stopColor={micro ? '#a3e0ff' : '#ffe68c'}/><stop offset=".7" stopColor={micro ? '#4d9fe6' : '#ffb642'}/><stop offset="1" stopColor={micro ? '#3265ab' : '#d35c25'} stopOpacity=".3"/></radialGradient></defs>
        {micro ? <ellipse cx="50" cy="77" rx="31" ry="33" fill="url(#micro-core)"/> : <path d="M50 14 C43 42 25 69 28 90 C30 120 70 120 72 90 C75 68 57 43 50 14Z" fill="url(#earth-core)"/>}
        <rect x="47" y="110" width="6" height="8" rx="2" fill="#97acc7"/>
      </svg></div><strong>{micro ? 'In microgravity' : 'On Earth'}</strong><small>{micro ? 'Diffusion-dominated' : 'Buoyancy-driven'}</small>
    </div>)}
    <span className="flame-caption">CONCEPTUAL ILLUSTRATION · NOT MEASUREMENT DATA</span>
  </div>;
}
const contexts = [
  { title: 'Lunar habitats', subtitle: 'Partial gravity. New questions.', description: 'Explore what the evidence can tell us about fire beyond low Earth orbit.', icon: Moon, question: 'What evidence supports understanding combustion in lunar habitats, and what are the limitations of extrapolating to partial gravity?' },
  { title: 'Mars exploration', subtitle: 'A different environment.', description: 'Examine the role of gravity, atmosphere and material properties.', icon: Globe2, question: 'What does the corpus report about gravity, oxygen concentration and pressure, and what remains untested for Mars habitats?' },
  { title: 'Spacecraft cabins', subtitle: 'Microgravity. Confined spaces.', description: 'Investigate flame spread, ventilation and spacecraft fire safety.', icon: Orbit, question: 'What do spacecraft combustion experiments show about ventilation and flame spread in microgravity? Cite sources and describe their limitations.' },
];
export function ResearchContexts({ onSelect }: { onSelect: (question: string) => void }) {
  return <section className="research-path" aria-labelledby="contexts-title"><div className="section-intro"><div><h3 id="contexts-title">Where will the research take you?</h3><p>Choose a context to prepare a question for the research assistant.</p></div><span className="tag neutral">EVIDENCE FIRST</span></div><div className="context-grid">{contexts.map(c => <button className="context-card" key={c.title} onClick={() => onSelect(c.question)}><span className="context-orb"><c.icon size={25}/></span><div><h4>{c.title}</h4><p>{c.subtitle}<br/>{c.description}</p></div><span className="context-link">Explore this question <ArrowUpRight size={15}/></span></button>)}</div></section>;
}
