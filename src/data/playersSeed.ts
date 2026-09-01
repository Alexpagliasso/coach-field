import type { Player } from '../types/domain'

export const PLAYER_SEED_VERSION = 4

const rosterSeed: Player[] = [
  { id: 'giuseppe-mancuso', firstName: 'Giuseppe', lastName: 'Mancuso', year: 2016, previousRoles: ['Portiere'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'giovanni-alba', firstName: 'Giovanni', lastName: 'Alba', year: 2016, previousRoles: ['Difensore'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'alessandro-macri', firstName: 'Alessandro', lastName: 'Macrì', year: 2016, previousRoles: ['Difensore'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'imbran-khattab', firstName: 'Imbran', lastName: 'Khattab', year: 2016, previousRoles: ['Difensore'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'armando-prevignano', firstName: 'Armando', lastName: 'Prevignano', year: 2016, previousRoles: ['Centrocampista'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'yassin-el-sefi', firstName: 'Yassin', lastName: 'El Sefi', year: 2017, previousRoles: ['Jolly'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'davide-carella', firstName: 'Davide', lastName: 'Carella', year: 2017, previousRoles: ['Jolly'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'samuele-alba', firstName: 'Samuele', lastName: 'Alba', year: 2016, previousRoles: ['Centrocampista'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'federico-meling', firstName: 'Federico', lastName: 'Meling', year: 2016, previousRoles: ['Attaccante'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'andrea-panepinto', firstName: 'Andrea', lastName: 'Panepinto', year: 2016, previousRoles: ['Attaccante'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'leart-bregu', firstName: 'Leart', lastName: 'Bregu', year: 2017, previousRoles: ['Portiere'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'david-grumazescu', firstName: 'David', lastName: 'Grumazescu', year: 2017, previousRoles: ['Portiere'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'iliasse-medqoun', firstName: 'Iliasse', lastName: 'Medqoun', year: 2016, previousRoles: ['Difensore'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'marwan-omara', firstName: 'Marwan', lastName: 'Omara', year: 2017, previousRoles: ['Difensore'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'reda-saadoune', firstName: 'Reda', lastName: 'Saadoune', year: 2017, previousRoles: ['Difensore'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'mohamed-salama', firstName: 'Mohamed', lastName: 'Salama', year: 2017, previousRoles: ['Jolly'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'andrea-daria', firstName: 'Andrea', lastName: 'D’Aria', year: 2017, previousRoles: ['Jolly'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'francesco-briceno', firstName: 'Francesco', lastName: 'Briceno', year: 2017, previousRoles: ['Jolly'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'andrea-fiore', firstName: 'Andrea', lastName: 'Fiore', year: 2016, previousRoles: ['Centrocampista', 'Attaccante'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'papaissa-samb', firstName: 'Papaissa', lastName: 'Samb', year: 2017, previousRoles: ['Attaccante'], rating: null, idealRoles: [], goalkeeperCandidate: false },
  { id: 'gabriele-mintrone', firstName: 'Gabriele', lastName: 'Mintrone', year: 2017, previousRoles: ['Attaccante'], rating: null, idealRoles: [], goalkeeperCandidate: false },
]

export const playersSeed: Player[] = rosterSeed.map((player) => ({ ...player, status: 'roster' }))
