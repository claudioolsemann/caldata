const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.URL_SUPABASE || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const inner = req.body?.data || {}
  const dc = inner?.analysis?.data_collection || {}
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
    p_pesquisa_id:       parseInt(process.env.PESQUISA_ID_PADRAO),
    p_op_id:             parseInt(process.env.IA_AGENT_OP_ID),
    p_status:            s.status,
    p_status_txt:        s.txt,
    p_duracao_seg:       Math.round(metadata.call_duration_secs || 0),
    p_telefone:          metadata.to_number || null,
    p_telefone_fonte:    'banco',
    p_telefone_id:       null,
    p_sexo:              dc.sexo || null,
    p_idade:             dc.idade ? parseInt(dc.idade) : null,
    p_faixa_etaria:      dc.faixa_etaria || null,
    p_escolaridade:      dc.escolaridade || null,
    p_renda:             null,
    p_regiao:            null,
    p_outras_dimensoes:  {},
    p_respostas:         { p5: dc.p5, p6: dc.p6, p7: dc.p7, p8: dc.p8, p9: dc.p9 },
    p_dh:                null
  })

  if (error) return res.status(500).json({ error })
  return res.status(200).json({ registro_id: reg })
}
