# Design System

## Principio

Il design system usa CSS custom properties. I componenti devono usare token, non colori hardcoded.

I token principali sono definiti in `src/styles/themes.css`.

## Token Canonici

- `--bg`
- `--surface`
- `--surface-raised`
- `--surface-hover`
- `--border`
- `--text-primary`
- `--text-secondary`
- `--text-muted`
- `--primary`
- `--primary-hover`
- `--primary-soft`
- `--danger`
- `--warning`
- `--info`

## Temi

Temi disponibili:

- `pitch`: tema default, sportivo/elegante.
- `electric`: tema professionale/tech.
- `purple`: tema data/premium.
- `ice`: tema fresco/leggibile.

Il tema attivo viene applicato su:

```html
<html data-theme="pitch">
```

## Theme Provider

File principali:

- `src/theme.ts`: tipo `AppTheme`, configurazione `APP_THEMES`, storage key, hook `useTheme`.
- `src/ThemeProvider.tsx`: sincronizza dataset HTML, meta theme-color e localStorage.
- `src/components/ThemeSelectorSheet.tsx`: UI di selezione tema.

## No Flash Del Tema Sbagliato

`index.html` contiene uno script inline che legge `localStorage` prima del render React e imposta `document.documentElement.dataset.theme`.

## UI Mobile

Pattern ricorrenti:

- BottomNav fissa.
- Bottom sheet per modalita operative.
- Card compatte con bordo 8px.
- Pulsanti con altezza minima adeguata al touch.
- Chip selezionabili con `aria-pressed` quando usati come toggle.

## Stati Semantici

- Positivo / selezione / CTA: `var(--primary)`
- Attenzione: `var(--warning)`
- Errore / pericolo: `var(--danger)`
- Informazione: `var(--info)`

## Stelle

Le stelle usano:

- pieno: `var(--warning)`
- vuoto: `var(--border)`

Questo mantiene la valutazione indipendente dal tema primario.

## Animazioni

Il cambio tema usa transizioni brevi su background, colore e bordo. `prefers-reduced-motion` riduce le transizioni quasi a zero.

## Hardcoded Intenzionali

Rimangono colori hardcoded solo in:

- definizioni delle palette tema;
- preview grafiche dei temi;
- meta/script iniziale `theme-color`;
- asset SVG del template, non usati nella UI principale.
