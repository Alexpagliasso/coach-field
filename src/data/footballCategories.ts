export type FootballCategoryStage = 'grassroots' | 'youth' | 'senior'

export type FootballCategory = {
  code: string
  label: string
  ageBand: string
  stage: FootballCategoryStage
  ages?: readonly number[]
}

export const FOOTBALL_CATEGORY_STAGES: ReadonlyArray<{ stage: FootballCategoryStage; label: string }> = [
  { stage: 'grassroots', label: 'Attività di base' },
  { stage: 'youth', label: 'Settore giovanile' },
  { stage: 'senior', label: 'Senior' },
]

export const FOOTBALL_CATEGORIES: ReadonlyArray<FootballCategory> = [
  { code: 'piccoli_amici', label: 'Piccoli Amici', ageBand: 'U6/U7', stage: 'grassroots', ages: [6, 7] },
  { code: 'primi_calci', label: 'Primi Calci', ageBand: 'U8/U9', stage: 'grassroots', ages: [8, 9] },
  { code: 'pulcini_u10', label: 'Pulcini', ageBand: 'U10', stage: 'grassroots', ages: [10] },
  { code: 'pulcini_u11', label: 'Pulcini', ageBand: 'U11', stage: 'grassroots', ages: [11] },
  { code: 'pulcini_misti', label: 'Pulcini Misti', ageBand: 'U10/U11', stage: 'grassroots', ages: [10, 11] },
  { code: 'esordienti_u12', label: 'Esordienti', ageBand: 'U12', stage: 'grassroots', ages: [12] },
  { code: 'esordienti_u13', label: 'Esordienti', ageBand: 'U13', stage: 'grassroots', ages: [13] },
  { code: 'esordienti_misti', label: 'Esordienti Misti', ageBand: 'U12/U13', stage: 'grassroots', ages: [12, 13] },
  { code: 'under_14', label: 'Under 14', ageBand: 'U14', stage: 'youth', ages: [14] },
  { code: 'under_15', label: 'Under 15', ageBand: 'U15', stage: 'youth', ages: [15] },
  { code: 'under_16', label: 'Under 16', ageBand: 'U16', stage: 'youth', ages: [16] },
  { code: 'under_17', label: 'Under 17', ageBand: 'U17', stage: 'youth', ages: [17] },
  { code: 'under_18', label: 'Under 18', ageBand: 'U18', stage: 'youth', ages: [18] },
  { code: 'juniores_under_19', label: 'Juniores / Under 19', ageBand: 'U19', stage: 'youth', ages: [19] },
  { code: 'prima_squadra', label: 'Prima Squadra', ageBand: 'Senior', stage: 'senior' },
]
