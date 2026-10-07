-- =====================================================================
-- Saída XTPG (DTZ-227) – criação idempotente das tabelas de log.
-- Mesma abordagem do xtpg_envio_log_tables.sql: aplicar manualmente quando
-- NÃO se pode rodar `prisma migrate deploy` (o banco s4_extensao_dotz está
-- à frente do snapshot e é compartilhado com outros devs).
--
-- NÃO altera tabelas existentes. Seguro para rodar mais de uma vez.
-- Conferir com o time antes de aplicar em ambiente compartilhado.
-- =====================================================================

IF OBJECT_ID('s4_extensao_dotz.dbo.xtpg_saida_header', 'U') IS NULL
BEGIN
    CREATE TABLE s4_extensao_dotz.dbo.xtpg_saida_header (
        id                   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        cia_id               INT NULL,
        cia_sap              NVARCHAR(50) NOT NULL,
        parcontabil          NVARCHAR(50) NOT NULL,
        chave_validacao      NVARCHAR(120) NOT NULL,
        codigo_sap           NVARCHAR(50) NULL,
        status_sap           NVARCHAR(20) NOT NULL CONSTRAINT DF_xtpg_saida_header_status_sap DEFAULT('AGUARDANDO'),
        descricao_sap        NVARCHAR(MAX) NULL,
        data_integracao_sap  DATETIME2 NULL,
        request_sap          NVARCHAR(MAX) NULL,
        response_sap         NVARCHAR(MAX) NULL,
        status_xtpg          NVARCHAR(20) NOT NULL CONSTRAINT DF_xtpg_saida_header_status_xtpg DEFAULT('AGUARDANDO'),
        descricao_xtpg       NVARCHAR(MAX) NULL,
        data_integracao_xtpg DATETIME2 NULL,
        request_xtpg         NVARCHAR(MAX) NULL,
        response_xtpg        NVARCHAR(MAX) NULL,
        critica_xtpg         NVARCHAR(MAX) NULL,
        total_registros      INT NOT NULL CONSTRAINT DF_xtpg_saida_header_total DEFAULT(0),
        criado_em            DATETIME2 NOT NULL CONSTRAINT DF_xtpg_saida_header_criado DEFAULT(SYSDATETIME()),
        atualizado_em        DATETIME2 NOT NULL CONSTRAINT DF_xtpg_saida_header_atualizado DEFAULT(SYSDATETIME())
    );
    CREATE INDEX IX_xtpg_saida_header_chave  ON s4_extensao_dotz.dbo.xtpg_saida_header(chave_validacao);
    CREATE INDEX IX_xtpg_saida_header_ssap   ON s4_extensao_dotz.dbo.xtpg_saida_header(status_sap);
    CREATE INDEX IX_xtpg_saida_header_sxtpg  ON s4_extensao_dotz.dbo.xtpg_saida_header(status_xtpg);
    CREATE INDEX IX_xtpg_saida_header_criado ON s4_extensao_dotz.dbo.xtpg_saida_header(criado_em);
END;

IF OBJECT_ID('s4_extensao_dotz.dbo.xtpg_saida_detail', 'U') IS NULL
BEGIN
    CREATE TABLE s4_extensao_dotz.dbo.xtpg_saida_detail (
        id                  INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        xtpg_saida_header_id INT NOT NULL,
        mvt_contador        NVARCHAR(50) NULL,
        conta_contabil      NVARCHAR(50) NULL,
        conta_contabil_s4   NVARCHAR(30) NULL,
        credito_debito      NVARCHAR(1) NULL,
        valor               NVARCHAR(50) NULL,
        historico           NVARCHAR(MAX) NULL,
        ind_codigo          NVARCHAR(20) NULL,
        ban_codigo          NVARCHAR(50) NULL,
        age_codigo          NVARCHAR(50) NULL,
        cnt_codigo          NVARCHAR(50) NULL,
        house_bank          NVARCHAR(10) NULL,
        house_bank_account  NVARCHAR(20) NULL,
        criado_em           DATETIME2 NOT NULL CONSTRAINT DF_xtpg_saida_detail_criado DEFAULT(SYSDATETIME()),
        atualizado_em       DATETIME2 NOT NULL CONSTRAINT DF_xtpg_saida_detail_atualizado DEFAULT(SYSDATETIME()),
        CONSTRAINT FK_xtpg_saida_detail_header FOREIGN KEY (xtpg_saida_header_id)
            REFERENCES s4_extensao_dotz.dbo.xtpg_saida_header(id) ON DELETE CASCADE
    );
    CREATE INDEX IX_xtpg_saida_detail_header ON s4_extensao_dotz.dbo.xtpg_saida_detail(xtpg_saida_header_id);
END;
