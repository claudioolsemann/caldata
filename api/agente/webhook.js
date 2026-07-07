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

  const get = (key) => dc[key] || dc[key.toUpperCase()] || dc[key.toLowerCase()] || null

  const statusMap = {
    'done':         { status: 1, txt: 'Entrevista bem sucedida' },
    'completed':    { status: 1, txt: 'Entrevista bem sucedida' },
    'user_hangup':  { status: 4, txt: 'Abandonou a entrevista' },
    'agent_hangup': { status: 2, txt: 'Recusou responder a pesquisa' },
    'no_answer':    { status: 10, txt: 'Caixa postal' },
    'failed':       { status: 9, txt: 'Problema telefonia' }
  }

  const s = statusMap[inner?.status] || { status: 9, txt: 'Erro desconhecido' }

  const respostas = {
    p5: get('P5-VOTARIA_GOV_PR_ESPONTANEA'),
    p6: get('P6-GOV_PR_ESTIMULADA'),
    p7: get('P7-GOV_INTENCAOVOTO_SEGTURNO'),
    p8: get('P8-GOVPR_REJEICAO'),
    p9: get('P9-VOTO_PRESIDENTE_2TURNO'),
  }

  const { data: reg, error } = await supabase.rpc('criar_registro', {
    p_pesquisa_id:       parseInt(process.env.PESQUISA_ID_PADRAO),
    p_op_id:             parseInt(process.env.IA_AGENT_OP_ID),
    p_status:            s.status,
    p_status_txt:        s.txt,
    p_duracao_seg:       Math.round(metadata.call_duration_secs || 0),
    p_telefone:          metadata.to_number || null,
    p_telefone_fonte:    'banco',
    p_telefone_id:       null,
    p_sexo:              get('SEXO'),
    p_idade:             get('IDADE') ? parseInt(get('IDADE')) : null,
    p_faixa_etaria:      get('FAIXA_ETARIA'),
    p_escolaridade:      get('ESCOLARIDADE'),
    p_renda:             null,
    p_regiao:            null,
    p_outras_dimensoes:  {},
    p_respostas:         respostas,
    p_dh:                null
  })

  if (error) return res.status(500).json({ error })
  return res.status(200).json({ registro_id: reg })
}
