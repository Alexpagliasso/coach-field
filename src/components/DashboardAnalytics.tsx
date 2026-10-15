import type { ReactNode } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AttendanceTrendPoint, CallupDistributionPoint } from '../cloud/dashboardAnalyticsRepository'
import type { TrainingObjectiveTagTotal } from '../cloud/trainingObjectiveTagsRepository'
import type { CloudMatch } from '../cloud/matchCloudRepository'
import { BarChart3, Target, Trophy, Users } from 'lucide-react'

const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
const palette = ['#806bff', '#2f80ff', '#ff7a6e', '#2fbf8f', '#b37dff', '#4dc9ff']
const tooltipStyle = { border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--surface)', boxShadow: '0 16px 35px color-mix(in srgb, var(--bg) 62%, transparent)', color: 'var(--text-primary)' }

export function AttendanceTrend({ items }: { items: AttendanceTrendPoint[] }) {
  const marked = items.filter(item => item.marked > 0)
  if (!items.length) return <AnalyticsEmpty icon={<BarChart3 />} text="Nessuna seduta completata nel WorkGroup." />
  if (!marked.length) return <AnalyticsEmpty icon={<BarChart3 />} text="Le sedute completate non hanno ancora un registro presenze compilato." />
  const data = items.map(item => ({ ...item, label: dateLabel(item.date), percentage: item.marked ? Math.round(item.present / item.marked * 100) : null }))
  const average = Math.round(marked.reduce((sum, item) => sum + item.present / item.marked * 100, 0) / marked.length)
  return <div className="dashboard-chart"><div className="analytics-record"><span><b>{average}%</b>media</span><span><b>{marked.length}</b>sedute con registro</span></div><div className="dashboard-chart-canvas"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}><defs><linearGradient id="attendance-violet-blue" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stopColor="#806bff" stopOpacity={.65} /><stop offset="100%" stopColor="#2f80ff" stopOpacity={.08} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} tickFormatter={value => `${value}%`} /><Tooltip contentStyle={tooltipStyle} labelStyle={{ color: 'var(--text-secondary)' }} formatter={(_value, _name, context) => { const row = context.payload as typeof data[number]; return [`${row.present}/${row.marked} presenti · ${row.percentage}%`, 'Registro'] }} labelFormatter={(_label, payload) => payload[0]?.payload.title ?? 'Seduta'} /><Area type="monotone" dataKey="percentage" name="Presenze" stroke="#806bff" strokeWidth={3} fill="url(#attendance-violet-blue)" connectNulls={false} /></AreaChart></ResponsiveContainer></div></div>
}

export function MatchTrend({ matches }: { matches: CloudMatch[] }) {
  const completed = matches.filter(item => item.status === 'completed' && item.ourScore != null && item.opponentScore != null).sort((a, b) => b.matchDate.localeCompare(a.matchDate)).slice(0, 6).reverse()
  if (!completed.length) return <AnalyticsEmpty icon={<Trophy />} text="Nessun risultato concluso con punteggio disponibile." />
  const record = completed.reduce((total, item) => { if (item.ourScore! > item.opponentScore!) total.wins += 1; else if (item.ourScore === item.opponentScore) total.draws += 1; else total.losses += 1; total.goalDifference += item.ourScore! - item.opponentScore!; return total }, { wins: 0, draws: 0, losses: 0, goalDifference: 0 })
  const data = completed.map(item => ({ ...item, label: `${dateLabel(item.matchDate)} · ${item.opponent}` }))
  return <div className="dashboard-chart"><div className="analytics-record"><span><b>{record.wins}</b>V</span><span><b>{record.draws}</b>N</span><span><b>{record.losses}</b>P</span><span><b>{record.goalDifference > 0 ? '+' : ''}{record.goalDifference}</b>DR</span></div><div className="dashboard-chart-canvas"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 6, left: -22, bottom: 0 }} barGap={3}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="label" hide /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} labelFormatter={(_label, payload) => `vs ${payload[0]?.payload.opponent ?? ''} · ${payload[0]?.payload.matchDate ?? ''}`} /><Legend wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="ourScore" name="Gol fatti" fill="#806bff" radius={[5, 5, 0, 0]} /><Bar dataKey="opponentScore" name="Gol subiti" fill="#ff7a6e" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
}

export function CallupDistribution({ items }: { items: CallupDistributionPoint[] }) {
  if (!items.length) return <AnalyticsEmpty icon={<Users />} text="Nessuna convocazione cloud negli ultimi 90 giorni." />
  const data = items.slice(0, 12)
  const height = Math.max(220, data.length * 34)
  return <div className="dashboard-chart dashboard-chart-callups"><div className="dashboard-chart-scroll" style={{ height }}><ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ top: 2, right: 22, left: 8, bottom: 2 }}><CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 5" /><XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><YAxis type="category" dataKey="name" width={96} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} /><Tooltip contentStyle={tooltipStyle} formatter={(value, name, context) => name === 'Convocazioni' ? [value, 'Convocazioni'] : [context.payload.unavailable, 'Indisponibilità']} /><Bar dataKey="callups" name="Convocazioni" fill="#2f80ff" radius={[0, 6, 6, 0]} /><Bar dataKey="unavailable" name="Indisponibilità" fill="#ff7a6e" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></div>
}

export function ObjectiveTagDistribution({ items, periodLabel }: { items: TrainingObjectiveTagTotal[]; periodLabel: string }) {
  if (!items.length) return <AnalyticsEmpty icon={<Target />} text="Nessuna seduta del periodo possiede ancora obiettivi tecnici strutturati." />
  const data = items.slice(0, 8)
  return <div className="dashboard-chart"><div className="dashboard-objective-chart"><div className="dashboard-chart-canvas"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="count" nameKey="name" innerRadius="56%" outerRadius="82%" paddingAngle={3}>{data.map((item, index) => <Cell key={item.id} fill={palette[index % palette.length]} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value, _name, context) => [`${value} sedute`, context.payload.name]} /></PieChart></ResponsiveContainer></div><ul className="dashboard-objective-legend" aria-label={`Obiettivi tecnici ${periodLabel}`}>{data.map((item, index) => <li key={item.id}><i style={{ backgroundColor: palette[index % palette.length] }} /><span>{item.name}</span><b>{item.count}</b></li>)}</ul></div><p className="analytics-note">Frequenza dei tag nelle sedute del WorkGroup · {periodLabel}. Una seduta può contribuire a più obiettivi.</p></div>
}

function AnalyticsEmpty({ icon, text }: { icon: ReactNode; text: string }) { return <div className="analytics-empty">{icon}<p>{text}</p></div> }
