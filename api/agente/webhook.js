const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const supabase = createClient(
  process.env.URL_SUPABASE,
  process.env.SUPABASE_SERVICE_KEY
)

export const config = { api: { bodyParser: false } }

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const rawBody = Buffer.concat(chunks).toString('utf8')
  const payload = JSON.parse(rawBody)

  const signature = req.headers['elevenlabs-signature']
  if (signature && process.env.ELEVENLABS_WEBHOOK_SECRET) {
    const parts = signature.split(',')
    const timestamp = parts.find(p => p.startsWith('t='))?.split('=')[1]
    const sigHash = parts.find(p => p.startsWith('v0='))?.split('=')[1]
    const expected = crypto
      .createHmac('sha256', process.env.ELEVENLABS_WEBHOOK_SECRET)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex')
    if (sigHash !== expected) return res.status(401).json({ error: 'Unauthorized' })
  }

  const inner = payload?.data || {}
  const analysis = inner?.analysis?.data_collection || {}
  const metadata = inner?.metadata || {}

  const statusMap = {
    'done':         { status: 1, txt: 'Entrevista bem sucedida' },
    'completed':    { status: 1, txt: 'Entrevista bem sucedida' },
    'user_hangup':  { status: 4, txt: 'Abandonou a entrevista' },
    'agent_hangup': { status: 2, txt: 'Recusou responder a pesquisa' },
    'no_answer':    { status: 10, txt: 'Caixa postal' },
    'failed':       { status: 9, txt: 'Problema telefonia' }
  }

  const s = statusMap[inner?.status] || { status: 9, txt: 'Erro desconhecido' }

  const { data: reg, error } = await supabase.rpc('criar_registro', {
    p_pesquisa_id:       parseInt(analysis.pesquisa_id || process.env.PESQUISA_ID_PADRAO),
    p_op_id:             parseInt(process.env.IA_AGENT_OP_ID),
    p_status:            s.status,
    p_status_txt:        s.txt,
    p_duracao_seg:       Math.round(metadata.call_duration_secs || 0),
    p_telefone:          metadata.to_number || null,
    p_telefone_fonte:    'banco',
    p_telefone_id:       null,
    p_sexo:              analysis.sexo || null,
    p_idade:             analysis.idade ? parseInt(analysis.idade) : null,
    p_faixa_etaria:      analysis.faixa_etaria || null,
    p_escolaridade:      analysis.escolaridade || null,
    p_renda:             analysis.renda || null,
    p_regiao:            analysis.regiao || null,
    p_outras_dimensoes:  {},
    p_respostas:         analysis.respostas || {},
    p_dh:                null
  })

  if (error) return res.status(500).json({ error })
  return res.status(200).json({ registro_id: reg })
}
