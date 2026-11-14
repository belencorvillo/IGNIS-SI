// ── IGNIS · On Earth page content ──────────────────────────────────────────
// Edit the text of the firefighting blocks here; layout lives in EarthPage.jsx.
// Each block follows the chain: PSI data → future research → invention.
// `match` decides which investigations are listed as evidence for each block.

/**
 * Curated editorial context — proposed research lines and devices, not data
 * extracted from PSI records. Linked investigations are matched by hardware
 * rack / fuel / title so users can explore the evidence behind each idea.
 */

/** Demo status of each line in the hackathon build. */
export const STATUS = {
  // `show: false` hides the tag on the page.
  demo: { label: 'In the demo', tone: 'sky', show: true },
  partial: { label: 'In the demo', tone: 'sky', show: true },
  future: { label: 'Future work', tone: 'default', show: false },
  concept: { label: 'Research-stage concept', tone: 'default', show: false },
}

/** Topic filter for the research lines. */
export const TOPICS = {
  detection: 'Detection',
  prevention: 'Prevention',
  suppression: 'Suppression',
  protection: 'Crew protection',
  tools: 'Models & tools',
}

/** Scope filter, shown above the topic filter (values for `scopes`). `tag` is the short label on each line. */
export const SCOPES = {
  earth: { label: 'Fire safety on Earth', tag: 'Fire safety on Earth' },
  equipment: { label: 'Next-generation fire safety controls and equipment', tag: 'Next-generation fire safety' },
}

/** Steps of the chain shown in each block (labels for `chain`). */
export const CHAIN_STEPS = ['PSI data', 'Future research', 'Invention']


export const SPINOFFS = [
  {
    id: 'smoke',
    scopes: ['equipment'],
    topics: ['detection'],
    chain: ['SAME · SAME-R · DAFT', 'Smoke fingerprints', 'Smart detector'],
    title: 'Smart smoke detector',
    lede: 'Tell real smoke from dust and steam.',
    data: 'SAME, SAME-R and DAFT study smoke and dust particles produced by heated materials.',
    research:
      'Characterize the smoke "fingerprint" of modern materials (particle size by material and heating stage) and how it differs from dust or steam.',
    invention:
      'A detector combining an optical and a particle sensor with an on-device classifier, giving fewer false alarms and earlier warnings. It could also be a drop-node that firefighters leave along their path inside a building.',
    status: 'future',
    match: (i) => /aerosol|dust/i.test(i.title),
  },
  {
    id: 'oxygen',
    scopes: ['earth'],
    topics: ['prevention'],
    chain: ['ACME · Saffire', 'O₂-enriched rooms', 'Oxygen fire guard'],
    title: 'Home-oxygen fire guard',
    lede: 'Cut the oxygen before the fire grows.',
    data: 'ACME high-oxygen runs (including CFI-G) and Saffire show how oxygen level changes flame behavior.',
    research:
      'How flammability limits and flame-spread rates change in oxygen-enriched rooms such as hospitals, homes with oxygen therapy or hyperbaric chambers, where firefighters lack clear tactical rules.',
    invention:
      'A flame/heat sensor for home oxygen concentrators that automatically cuts the oxygen flow and sends an alert, sharing the room’s oxygen level with the arriving crew.',
    status: 'future',
    match: (i) => i.hardware_rack === 'CIR-ACME' || i.hardware_rack === 'Saffire',
  },
  {
    id: 'wearable',
    scopes: ['earth'],
    topics: ['protection'],
    chain: ['BASS · Saffire · SPICE · SLICE', 'Airflow vs flame spread', 'Risk wearable'],
    title: 'Firefighter risk wearable',
    lede: 'A warning before flames start to run.',
    data: 'BASS/BASS-II, Saffire, SPICE and SLICE study flames over solids and gases under controlled airflow.',
    research:
      'How airflow speed decides whether a flame over a solid grows or dies out, as an input for ventilation tactics and flashover prediction.',
    invention:
      'A module in the firefighter’s jacket or helmet that measures oxygen, temperature and airflow and compares them with known flammability envelopes, warning when conditions approach rapid flame spread.',
    status: 'future',
    match: (i) => i.hardware_rack === 'Saffire' || i.hardware_rack === 'MSG-SPICE' || /flame spread/i.test(i.title),
  },
  {
    id: 'mist',
    scopes: ['equipment'],
    topics: ['suppression'],
    chain: ['FLEX · BASS · CFI', 'Minimum agent', 'Water-mist extinguisher'],
    title: 'Tuned water-mist extinguisher',
    lede: 'Put fires out with less agent.',
    data: 'FLEX/FLEX-2 (droplet flames extinguished by CO₂ and helium dilution), BASS (suppression of burning solids) and CFI.',
    research:
      'The minimum amount of water or inert gas needed to put out a flame through dilution or fine droplets — an open problem, especially for lithium-ion battery fires.',
    invention:
      'A portable water-mist or inert-gas extinguisher whose nozzle and agent mix are optimized to use as little agent as possible. It could also be a suppression module inside drop-nodes for confined spaces.',
    status: 'future',
    match: (i) => /extinguish|burning and suppression/i.test(i.title) || /^cool flames investigation$/i.test(i.title),
  },
  {
    id: 'coolflame',
    scopes: ['equipment'],
    topics: ['detection'],
    chain: ['FLEX · CFI · CFI-G', 'Hidden ignition', 'Cool-flame sensor'],
    title: 'Cool-flame sensor',
    lede: 'See the flames that cameras miss.',
    data: 'FLEX, CFI and ACME CFI-G, where low-temperature "cool flames" were studied.',
    research: 'When these nearly invisible, low-temperature flames appear in fuel vapors before full ignition.',
    invention:
      'A sensor for fuel storage and industrial sites tuned to detect flames that thermal cameras and the human eye miss.',
    status: 'concept',
    match: (i) => /cool flame/i.test(i.title),
  },
  {
    id: 'soot',
    scopes: ['equipment'],
    topics: ['protection'],
    chain: ['SPICE · ACME', 'Soot by fuel', 'Exposure estimator'],
    title: 'Soot exposure estimator',
    lede: 'Know how dirty a fire will leave your gear.',
    data: 'SPICE (smoke point measurements) and ACME soot data.',
    research: 'Which fuels and conditions produce more soot, which is linked to cancer risk in firefighters.',
    invention:
      'An estimator of the expected soot load for each fire scenario, giving crews guidance on decontamination and when to replace protective equipment.',
    status: 'future',
    match: (i) => /smoke point|flame design|coflow/i.test(i.title),
  },
  {
    id: 'textiles',
    scopes: ['earth'],
    topics: ['protection'],
    chain: ['Saffire · BASS', 'Fabric flammability', 'Textile dataset'],
    title: 'Protective textile data',
    lede: 'Better fabrics for firefighter suits.',
    data: 'Fabric and polymer samples burned in Saffire and BASS.',
    research: 'How protective fabrics ignite and spread flame under different oxygen levels and airflow.',
    invention: 'A flammability dataset to help designers choose materials for firefighter suits.',
    status: 'future',
    match: (i) => i.hardware_rack === 'Saffire' || /burning and suppression of solids|burning rate/i.test(i.title),
  },
  {
    id: 'models',
    scopes: ['earth'],
    topics: ['tools'],
    chain: ['CFD + flight video', 'Model validation', 'Drone estimator · VR'],
    title: 'Drone fire-growth estimator and VR trainer',
    lede: 'Clean flame data to train fire models.',
    data: 'Ground and CFD studies (e.g. PSI-60, PSI-62, PSI-117) paired with flight videos and our own computer-vision telemetry.',
    research:
      'Whether clean, labeled flame data can train and validate fire-growth models before applying them to noisy real building-fire footage.',
    invention:
      'Our computer-vision engine applied to drone footage to estimate how fast a fire is growing, and our 3D digital twin adapted into a training simulator for firefighters.',
    status: 'partial',
    statusNote: 'The computer-vision engine and 3D twin exist in IGNIS-SI; the firefighting use is future work.',
    match: (i) => i.hardware_rack === 'Ground-CFD',
  },
  {
    id: 'assistant',
    scopes: ['equipment'],
    topics: ['tools'],
    chain: ['Full catalog', 'Fast, cited answers', 'Fire-behavior assistant'],
    title: 'Material and fire-behavior assistant',
    lede: 'Ask the catalog, get cited answers.',
    data: 'The whole labeled IGNIS-SI catalog.',
    research:
      'PSI results are spread across many investigations and documents; how can inspectors and firefighters query them quickly and reliably?',
    invention:
      'An assistant where a user asks, for example, "How does Nomex behave at 30% O₂ with forced airflow?" and gets an answer with the relevant PSI experiments and their DOIs, using the same Ollama pipeline as IGNIS-SI.',
    status: 'demo',
    statusNote: 'Available once the catalog is labeled.',
    match: () => true,
  },
]

export const SOURCES = [
  {
    label: 'NASA Physical Sciences Informatics (PSI) repository — cite each investigation by its DOI',
    href: 'https://psi.nasa.gov/physci/repo',
  },
  {
    label: 'NASA Space Apps 2026 — Flame in Freefall challenge',
    href: 'https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/',
  },
  {
    label:
      'Gómez-Pulido, J. M. — Tecnologías emergentes para desastres naturales: ecosistema IoT, WSN e IA (Universidad de Alcalá), case study 8: indoor firefighters (WBAN, ZUPT, drop-nodes)',
  },
  {
    // CC BY 4.0 attribution for the 3D Earth model (title, author, source, licence).
    label: '3D model: "Earth" by AirStudios, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"Earth"', href: 'https://skfb.ly/6Uy6v' },
      ' by AirStudios is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D smoke detector model.
    label: '3D model: "Simple smoke detector" by Sousinho, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"Simple smoke detector"', href: 'https://sketchfab.com/3d-models/simple-smoke-detector-8db756d4c1564f3197f2415ec2ef7fec' },
      ' by Sousinho is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D valve model.
    label: '3D model: "Valve II" by Víctor Hernández, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"Valve II"', href: 'https://sketchfab.com/3d-models/valve-ii-08a002755c784c889b8818eac15060ee' },
      ' by Víctor Hernández is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D gas mask model.
    label: '3D model: "Gas Mask" by DinoMac, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"Gas Mask"', href: 'https://sketchfab.com/3d-models/gas-mask-be8204736117445783ce9db4213f3b5c' },
      ' by DinoMac is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D fire extinguisher model.
    label: '3D model: "Fire Extinguisher" by Loïc, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"Fire Extinguisher"', href: 'https://sketchfab.com/3d-models/fire-extinguisher-5676b179b3b744c0aaae53a3dcea2300' },
      ' by Loïc is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D security camera model.
    label: '3D model: "Security Camera" by Bryan, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"Security Camera"', href: 'https://sketchfab.com/3d-models/security-camera-7da2489681d749fda57ffdf1db9f0419' },
      ' by Bryan is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D pressure gauge model.
    label: '3D model: "Pressure gauge" by takeboncog, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"Pressure gauge"', href: 'https://sketchfab.com/3d-models/pressure-gauge-95cf5b63b15549a2a173bb480577b6a9' },
      ' by takeboncog is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D cape model.
    label: '3D model: "1856 Cape (Kukushkina)" by Aleksei Moskvin, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"1856 Cape (Kukushkina)"', href: 'https://sketchfab.com/3d-models/1856-cape-kukushkina-385d65145f064240a010fe0611ca1065' },
      ' by Aleksei Moskvin is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D drone model.
    label: '3D model: "animated drone with camera (FREE)" by ulunkwulunk, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"animated drone with camera (FREE)"', href: 'https://sketchfab.com/3d-models/animated-drone-with-camera-free-a8e2c50f69264e75bb6277779fb5028b' },
      ' by ulunkwulunk is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
  {
    // CC BY 4.0 attribution for the 3D robot model.
    label: '3D model: "cute robot" by victory_mirosya, licensed under Creative Commons Attribution 4.0',
    parts: [
      '3D model: ',
      { text: '"cute robot"', href: 'https://sketchfab.com/3d-models/cute-robot-6aadb75f596742ada2814ad4593f0032' },
      ' by victory_mirosya is licensed under ',
      { text: 'Creative Commons Attribution', href: 'http://creativecommons.org/licenses/by/4.0/' },
      ', optimized for the web.',
    ],
  },
]
