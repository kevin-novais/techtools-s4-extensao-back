CREATE LOGIN report_user WITH PASSWORD = 'kK3C65@mFD2'; -- Senha do usuário report_user

-- Cria o usuário report_user para o banco de dados s4_extensao_dotz
USE s4_extensao_dotz;
CREATE USER report_user FOR LOGIN report_user;
ALTER ROLE db_datareader ADD MEMBER report_user;

-- Cria o usuário report_user para o banco de dados Dotz_Stage_Trocas
USE Dotz_Stage_Trocas;
CREATE USER report_user FOR LOGIN report_user;
ALTER ROLE db_datareader ADD MEMBER report_user;