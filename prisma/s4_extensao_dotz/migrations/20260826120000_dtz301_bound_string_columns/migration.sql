-- DTZ-301: revisao de colunas com tamanho string(-1) (NVARCHAR(MAX)).
-- Delimita colunas espelho denormalizadas cujo dado de origem tem tamanho conhecido.
-- Mantidas como MAX: request/response/mensagem_erro (SOAP), *_json, descricao_sap,
-- historico da SAIDA (texto livre externo). Todas as colunas abaixo sao NULL-able e
-- guardam valores curtos (nome <=30, conta <=10, comments <=44, critica <=250), entao
-- o ALTER nao trunca dado existente.

-- xtpg_envio_previsto_detail
ALTER TABLE dbo.xtpg_envio_previsto_detail ALTER COLUMN pfj_nome NVARCHAR(100) NULL;
ALTER TABLE dbo.xtpg_envio_previsto_detail ALTER COLUMN historico NVARCHAR(200) NULL;
ALTER TABLE dbo.xtpg_envio_previsto_detail ALTER COLUMN informacoes_contabeis NVARCHAR(50) NULL;

-- xtpg_envio_realizado_detail
ALTER TABLE dbo.xtpg_envio_realizado_detail ALTER COLUMN pfj_nome NVARCHAR(100) NULL;
ALTER TABLE dbo.xtpg_envio_realizado_detail ALTER COLUMN historico NVARCHAR(200) NULL;
ALTER TABLE dbo.xtpg_envio_realizado_detail ALTER COLUMN informacoes_contabeis NVARCHAR(50) NULL;

-- xtpg_saida_header (critica_xtpg ja e truncada em 250 no codigo)
ALTER TABLE dbo.xtpg_saida_header ALTER COLUMN critica_xtpg NVARCHAR(250) NULL;
