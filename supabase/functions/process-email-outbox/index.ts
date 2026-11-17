import { createClient } from 'npm:@supabase/supabase-js@2.117.1'

type QueueItem = {
  id: string
  event_type: 'training_session_published' | 'match_published'
  aggregate_id: string
  group_id: string
  recipient_email: string
  payload: Record<string, unknown>
}

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]!)
const displayDate = (value: unknown) => {
  const date = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  return new Intl.DateTimeFormat('it-IT',{ dateStyle:'full', timeZone:'Europe/Rome' }).format(new Date(`${date}T12:00:00+01:00`))
}

Deno.serve(async request => {
  try {
    if (request.method !== 'POST') return new Response('Method not allowed',{ status:405 })
    if (request.headers.get('x-worker-secret') !== required('EMAIL_WORKER_SECRET')) return new Response('Unauthorized',{ status:401 })

    const supabase = createClient(required('SUPABASE_URL'),required('SUPABASE_SERVICE_ROLE_KEY'),{ auth:{ persistSession:false,autoRefreshToken:false } })
    const resendKey = required('RESEND_API_KEY')
    const from = required('RESEND_FROM_EMAIL')
    const appBaseUrl = required('APP_BASE_URL').replace(/\/$/,'')
    const { data, error } = await supabase.rpc('claim_email_notification_batch',{ p_limit:20 })
    if (error) throw error
    const queue = (data ?? []) as QueueItem[]
    const groupIds = [...new Set(queue.map(item => item.group_id))]
    const groups = new Map<string,string>()
    if (groupIds.length) {
      const result = await supabase.from('groups').select('id,name').in('id',groupIds)
      if (result.error) throw result.error
      for (const group of result.data ?? []) groups.set(String(group.id),String(group.name))
    }

    let sent=0, failed=0
    for (const item of queue) {
      try {
        const training = item.event_type === 'training_session_published'
        const title = training ? String(item.payload.title ?? 'Nuova seduta') : `Partita vs ${String(item.payload.opponent ?? 'avversario')}`
        const group = groups.get(item.group_id) ?? 'WorkGroup'
        const date = displayDate(item.payload.date)
        const time = String(item.payload.startTime ?? '').slice(0,5) || 'Orario da definire'
        const path = training ? `training/${item.aggregate_id}` : `matches/${item.aggregate_id}`
        const link = `${appBaseUrl}/app/${item.group_id}/${path}`
        const subject = training ? `Nuova seduta · ${title}` : `Nuova partita · ${group}`
        const text = `${title}\nGruppo: ${group}\nData: ${date}\nOrario: ${time}\n\nApri GrowPitch: ${link}`
        const html = `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#24332b"><h1 style="font-size:22px">${escapeHtml(title)}</h1><p><strong>Gruppo:</strong> ${escapeHtml(group)}<br><strong>Data:</strong> ${escapeHtml(date)}<br><strong>Orario:</strong> ${escapeHtml(time)}</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#315f4d;color:#fff;text-decoration:none">Apri in GrowPitch</a></p></div>`
        const response = await fetch('https://api.resend.com/emails',{
          method:'POST',
          headers:{ Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json','Idempotency-Key':`growpitch-${item.id}` },
          body:JSON.stringify({ from,to:[item.recipient_email],subject,html,text })
        })
        const result = await response.json().catch(()=>({})) as { id?:string; message?:string; name?:string }
        if (!response.ok || !result.id) throw new Error(`Resend ${response.status}: ${result.message ?? result.name ?? 'send failed'}`)
        const marked = await supabase.rpc('mark_email_notification_sent',{ p_id:item.id,p_provider_message_id:result.id })
        if (marked.error) throw marked.error
        sent += 1
      } catch (cause) {
        failed += 1
        const message = cause instanceof Error ? cause.message : String(cause)
        const marked = await supabase.rpc('mark_email_notification_failed',{ p_id:item.id,p_error:message })
        if (marked.error) console.error('Unable to mark failed email',item.id,marked.error)
        console.error('Email delivery failed',item.id,message)
      }
    }
    return Response.json({ claimed:queue.length,sent,failed })
  } catch (cause) {
    console.error(cause)
    return Response.json({ error:cause instanceof Error?cause.message:'Worker failed' },{ status:500 })
  }
})
