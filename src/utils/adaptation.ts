export type AdaptationField = {
  label: string
  focus: string
  format: string
  dimensions: string
  rotation: string
}

export type PhaseAdaptation = {
  title: string
  presentCount: number
  summary: string
  fields: AdaptationField[]
  notes: string[]
}

const phase2Focus = [
  'Collaborazione - Assist = gol doppio',
  'Recupero alto/transizione - recuperala prima che escano dalla zona',
  'Cambio lato/ampiezza',
]

function dimensionsForFormat(format: string) {
  if (format.includes('2vs2')) return '15x12 m circa'
  if (format.includes('3vs3')) return '20x15 m circa'
  if (format.includes('4vs4')) return '25x18/20 m circa'
  if (format.includes('5vs5')) return 'campo a 5 intero o quasi'
  return 'spazio proporzionato al gruppo'
}

function phase2Formats(count: number) {
  if (count <= 14) return ['3vs3 o 2vs2+jolly', '3vs3 o 2vs2+jolly', 'campo ridotto con rotazioni']
  if (count === 15) return ['2vs2 + jolly', '2vs2 + jolly', '2vs2 + jolly']
  if (count === 16) return ['2vs2 + jolly', '2vs2 + jolly', '3vs3']
  if (count === 17) return ['2vs2 + jolly', '3vs3', '3vs3']
  if (count === 18) return ['3vs3', '3vs3', '3vs3']
  if (count === 19) return ['3vs3', '3vs3', '3vs3 + 1 jolly']
  if (count === 20) return ['3vs3', '3vs3 + jolly/rotazione', '3vs3 + jolly/rotazione']
  if (count === 21) return ['3vs3 + 1 jolly/cambio', '3vs3 + 1 jolly/cambio', '3vs3 + 1 jolly/cambio']
  if (count === 22) return ['3vs3 + jolly/cambi rapidi', '3vs3 + jolly/cambi rapidi', '4vs4 o 3vs3 + cambi']
  if (count === 23) return ['3vs3 + jolly/cambi', '4vs4 o 3vs3 + cambi', '4vs4 o 3vs3 + cambi']
  if (count === 24) return ['4vs4', '4vs4', '4vs4']
  return ['4vs4/5vs5 con cambi brevi', '4vs4/5vs5 con cambi brevi', '4vs4/5vs5 con cambi brevi']
}

function phase2GroupSizes(count: number) {
  if (count <= 14) return ['4-5', '4-5', 'resto in rotazione']
  if (count === 15) return ['5', '5', '5']
  if (count === 16) return ['5', '5', '6']
  if (count === 17) return ['5', '6', '6']
  if (count === 18) return ['6', '6', '6']
  if (count === 19) return ['6', '6', '7']
  if (count === 20) return ['6', '7', '7']
  if (count === 21) return ['7', '7', '7']
  if (count === 22) return ['7', '7', '8']
  if (count === 23) return ['7', '8', '8']
  if (count === 24) return ['8', '8', '8']
  const base = Math.floor(count / 3)
  const extra = count % 3
  return [0, 1, 2].map((index) => String(base + (index >= 3 - extra ? 1 : 0)))
}

export function getPhaseAdaptation(phaseId: string, presentCount: number): PhaseAdaptation | undefined {
  if (phaseId === 'phase-2') return getPhase2Adaptation(presentCount)
  if (phaseId === 'phase-3') return getPhase3Adaptation(presentCount)
  if (phaseId === 'phase-4') return getPhase4Adaptation(presentCount)
  return undefined
}

function getPhase2Adaptation(presentCount: number): PhaseAdaptation {
  const formats = phase2Formats(presentCount)
  const groupSizes = phase2GroupSizes(presentCount)
  return {
    title: 'Adattamento ai presenti',
    presentCount,
    summary: `${groupSizes.join('/')} giocatori sui 3 campi`,
    fields: formats.map((format, index) => ({
      label: `Campo ${index + 1}`,
      focus: phase2Focus[index],
      format,
      dimensions: dimensionsForFormat(format),
      rotation: format.includes('jolly') ? 'Usa 1 jolly o cambio naturale.' : 'Rotazione consigliata: ogni 2-3 minuti se qualcuno resta fuori.',
    })),
    notes: [
      'Mantieni le tre consegne originali: collaborazione, recupero alto, cambio lato.',
      'Riduci se c e troppo spazio.',
      'Allarga se il gioco diventa una mischia continua.',
      presentCount >= 25 ? 'Distribuisci in modo uniforme, aumenta il formato e non creare file lunghe.' : 'Nessuna sostituzione rigida: cambi brevi e leggibili.',
    ],
  }
}

function getPhase3Adaptation(presentCount: number): PhaseAdaptation {
  const left = Math.ceil(presentCount / 2)
  const right = Math.floor(presentCount / 2)
  return {
    title: 'Adattamento ai presenti',
    presentCount,
    summary: `Due porte: ${left}/${right} giocatori`,
    fields: [
      {
        label: 'Porta 1',
        focus: 'Tiro + scoperta portieri',
        format: `${left} in rotazione`,
        dimensions: 'distanza semplice, poi adattabile',
        rotation: 'Rotazione continua: chi tira entra in porta.',
      },
      {
        label: 'Porta 2',
        focus: 'Tiro + scoperta portieri',
        format: `${right} in rotazione`,
        dimensions: 'distanza semplice, poi adattabile',
        rotation: 'Tieni le file corte e palloni pronti.',
      },
    ],
    notes: ['Tutti tirano e tutti provano la porta.', 'Se una fila cresce troppo, sposta subito 1-2 bambini sull altra porta.'],
  }
}

function getPhase4Adaptation(presentCount: number): PhaseAdaptation {
  if (presentCount <= 10) {
    return finalMatch('4vs4/5vs5 ridotto', 'Campo ridotto', 'Nessuna attesa lunga: tieni tutti dentro o fai cambi rapidi.', presentCount)
  }
  if (presentCount <= 13) {
    return finalMatch('5vs5/6vs6 con rotazioni', 'Campo ridotto-medio', 'Rotazioni frequenti e semplici.', presentCount)
  }
  if (presentCount === 14) {
    return finalMatch('7vs7 perfetto', 'Due campi da 5 uniti', 'Ruota solo i portieri candidati.', presentCount)
  }
  if (presentCount <= 17) {
    return finalMatch('7vs7 + cambi frequenti', 'Due campi da 5 uniti', 'Cambi frequenti, senza tenere fuori sempre gli stessi.', presentCount)
  }
  if (presentCount <= 20) {
    return finalMatch('7vs7 principale + mini sul terzo campo', 'Campo principale + campo piccolo', 'Mini-partita autonoma e cambi ogni 6-8 minuti.', presentCount)
  }
  if (presentCount <= 23) {
    return finalMatch('7vs7 + terzo campo 3vs3/4vs4', 'Campo principale + campo piccolo', 'Rotazioni ogni 6-8 minuti tra partita e terzo campo.', presentCount)
  }
  return finalMatch('Due partite simultanee', 'Due spazi equilibrati', 'Dividi in due gare e ruota portieri/coppie quando serve.', presentCount)
}

function finalMatch(format: string, dimensions: string, rotation: string, presentCount: number): PhaseAdaptation {
  return {
    title: 'Adattamento ai presenti',
    presentCount,
    summary: format,
    fields: [
      {
        label: 'Partita finale',
        focus: '7vs7 + attivita parallela',
        format,
        dimensions,
        rotation,
      },
    ],
    notes: ['Mantieni ampiezza, collaborazione e reazione alla perdita come temi osservativi.', 'Evita 11vs11/12vs12 e code lunghe.'],
  }
}
