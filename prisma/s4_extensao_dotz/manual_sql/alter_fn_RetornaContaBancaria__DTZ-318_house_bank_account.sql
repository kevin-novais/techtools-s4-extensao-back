/*
    DTZ-318 - fn_RetornaContaBancaria: bug de copy-paste no filtro da conta.

    A 2a condicao comparava house_bank (nao house_bank_account) com @HouseBankAcct:
        and (house_bank=@HouseBankAcct or @HouseBankAcct is null)
    Assim, toda chamada com house_bank E house_bank_account preenchidos falhava (a menos que
    os dois codigos fossem iguais), retornando 0 linhas. Como o ramo 30 (LCM) do XRT_SendFlux
    usa CROSS APPLY nesta funcao, a linha era descartada e "todo LCM direto com house_bank
    setado" (transferencia entre contas, intercompany) sumia do realizado. As linhas com
    house_bank nulo passavam pelo ramo OR-null e mascaravam o defeito.

    Correcao: comparar house_bank_account com @HouseBankAcct. As chamadas com parametro nulo
    seguem inalteradas (ramo OR-null).

    Adicionalmente, algumas linhas do S/4 trazem house_bank_account = '*' (ex.: conta do BB
    10010037). O '*' e tratado como coringa: o gl_account ja identifica a conta 1:1 dentro da
    cia, entao a perna do banco (ex.: destino de uma transferencia entre contas) deixa de ser
    descartada. Sem isso, a transferencia entre contas so gerava a perna sem '*'.
*/
CREATE OR ALTER FUNCTION dbo.fn_RetornaContaBancaria
   (@codigo_cia varchar(4),
    @HouseBank varchar(5),
	@HouseBankAcct nvarchar(5) ,
	@GL_Account nvarchar(10)
    )
RETURNS TABLE
AS
RETURN
(
   	SELECT top 1 house_bank, house_bank_account, numero_banco, numero_agencia, digito_agencia, numero_conta,
	digito_conta, gl_account, numero_banco_legado, numero_agencia_legado, digito_agencia_legado,
	numero_conta_legado, digito_conta_legado
     FROM s4_extensao_dotz.dbo.contas_bancarias
    WHERE (codigo_cia = @codigo_cia)
    and   (gl_account = @GL_Account)
    and   (house_bank=@HouseBank or @HouseBank is null)
    and   (house_bank_account=@HouseBankAcct or @HouseBankAcct is null or @HouseBankAcct = '*')
    );
