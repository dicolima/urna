# Urna didática

Simulador local com Node.js, HTML/CSS/JavaScript e PostgreSQL. Visual inspirado na referência enviada. **Sem validade eleitoral.** Não reproduz integralmente uma eleição brasileira: usa um único cargo fictício, sem cadastro eleitoral, biometria, múltiplos cargos, turnos, critérios legais de desempate, assinaturas, lacres ou certificação. Não use para eleições reais.

## Executar

Requisitos: Node.js 22.9+ e PostgreSQL (recomendado: 17). Não é necessário Docker. O pgAdmin é a interface de administração; o servidor PostgreSQL deve estar em execução.

```powershell
npm install
npm run db:init
npm start
```

Com o banco e o `.env` já criados, execute os comandos acima e abra http://localhost:3000. O servidor escuta apenas na máquina local por padrão. O comando `db:init` cria as tabelas e a procedure no banco indicado por `DATABASE_URL`, sem apagar votos existentes. A conta precisa de permissão para criar esses objetos. Como alternativa, execute `db/schema.sql` no Query Tool do pgAdmin, conectado ao banco da aplicação.

Formato da variável no `.env` (substitua pelos seus dados; caracteres especiais na senha devem ser codificados para URL):

```dotenv
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_do_banco
PORT=3000
```

## Hospedagem futura no Render

O arquivo `render.yaml` prepara um Web Service Node. Envie o projeto para um repositório Git e use um Blueprint no Render, ou crie manualmente um Web Service com:

- Build Command: `npm ci`.
- Start Command: `npm run db:init && npm start`.
- Variáveis: `DATABASE_URL` e `NODE_ENV=production`; `HOST=0.0.0.0` para configuração manual.

Não envie o `.env` ao repositório: ele está no `.gitignore`. Cadastre a conexão no painel do Render. A inicialização no start é idempotente e preserva os votos existentes. O banco precisa estar acessível a partir do Render: `localhost` no serviço hospedado aponta para o próprio serviço, não para seu computador. Se usar Render Postgres na mesma conta e região, utilize sua Internal Database URL. Para outro provedor, siga sua configuração de TLS na URL de conexão; o código não desativa a validação de certificados.

O servidor usa `PORT` fornecida pelo Render e escuta em `0.0.0.0` nesse ambiente. A validação de origem aceita HTTPS da mesma origem. A configuração apenas prepara o deploy; não publica automaticamente. A aplicação tem uma única seção compartilhada por todos os visitantes e não possui autenticação para o mesário.

Referências: [Render Web Services](https://render.com/docs/web-services) e [conexões PostgreSQL](https://render.com/docs/postgresql-creating-connecting).

## Fluxo

### Gráfico de evolução

O painel **Evolução dos votos** apresenta dois gráficos, real e manipulado, com uma linha por candidato, horário no eixo X e percentual acumulado dos votos válidos no eixo Y. Ambos usam o mesmo intervalo, exatamente de `opened_at` até `closed_at`, e escala de 0 a 100%. Enquanto a seção está aberta, o gráfico real vai da abertura até o momento atual; o manipulado é gerado após o encerramento. Os nomes e percentuais finais aparecem na ponta das linhas, que conectam as observações como na referência fornecida. Por exemplo, 3 votos entre 10 válidos correspondem a 30%. Brancos e nulos não entram no denominador. Há atualização a cada voto local e a cada cinco segundos enquanto a seção está aberta. Os pontos permitem consultar horário, percentual e contagem pelo cursor; também podem receber foco pelo teclado.

A procedure gera somente uma contagem manipulada final. Por isso, seu gráfico é identificado como reconstrução retrospectiva: a diferença final de cada candidato doador é transferida para o alvo nos primeiros registros desse doador, preservando seus horários e o total de votos de cada instante. O ponto final coincide com a contagem do BU simulado. Essa convenção didática não representa um histórico observado de alterações. Os votos originais são preservados.

Execute `npm run db:init` após esta atualização para adicionar `recorded_at`. A migração não altera os votos antigos: os que não têm horário entram como saldo anterior, sem atribuir uma cronologia artificial. A limpeza com senha também limpa o histórico do gráfico. O acompanhamento durante a votação é um recurso didático, não uma reprodução da apuração oficial brasileira.

### Limpar para um novo teste

O botão **Limpar votação com senha** solicita a senha e confirma o apagamento em uma janela. A senha é validada no servidor pela variável `RESET_PASSWORD`, com no mínimo 12 caracteres. Para gerar uma senha local, execute `node scripts/configure-reset.js`: ela será adicionada ao `.env` apenas se essa variável ainda não existir. Consulte ou altere o valor diretamente no seu `.env` e reinicie o servidor. No Render, configure essa variável no painel; ela não é enviada ao navegador. Após cinco tentativas, novas tentativas ficam bloqueadas até completar um minuto desde a primeira tentativa (por processo do servidor).

A limpeza apaga apenas os votos e a apuração simulada da aplicação e reinicia a seção, incluindo alvo e datas. Os candidatos, as tabelas, a procedure e outros objetos do banco são mantidos. Esta ação é irreversível. O BU aparece automaticamente em formato de documento logo abaixo da zerésima ao encerrar a seção, com as duas contagens identificadas; o comparativo continua disponível. Os dois documentos reaparecem ao recarregar a página de uma seção encerrada.

1. Escolha o alvo da **simulação explícita** antes da abertura.
2. Emita a zerésima em tela: confirma zero votos e abre a seção.
3. Libere um eleitor no terminal do mesário.
4. Digite 11, 22 ou 33; outro número de dois dígitos gera voto nulo. BRANCO seleciona voto em branco, CORRIGE reinicia e CONFIRMA grava.
5. Repita a liberação para cada voto. Não se coletam dados pessoais.
6. Encerre a seção, sem eleitor pendente, para gerar o BU em tela com resultado real e manipulado lado a lado. A seção permanece encerrada após reiniciar o servidor.

A procedure pública e documentada `simulate_manipulation` transfere apenas votos válidos entre candidatos na tabela `simulated_result`, garantindo maioria absoluta ao alvo quando existe ao menos um voto válido. Não cria votos nem muda brancos/nulos; preserva a tabela `votes`. Com zero votos válidos, não declara vencedor. A demonstração não representa vulnerabilidade comprovada em urnas reais.

As ações usam transação e bloqueio da seção no PostgreSQL para impedir confirmação duplicada, liberação simultânea e encerramento durante um voto. Este aplicativo local não possui autenticação nem proteção contra um administrador do banco; os votos originais são preservados pelo fluxo da aplicação, sem garantia criptográfica de imutabilidade.

Referências do fluxo: [TSE — votação segura](https://www.tse.jus.br/eleicoes/historia/processo-eleitoral-brasileiro/votacao/votacao-segura) e [procedimentos de transparência](https://www.tse.jus.br/comunicacao/noticias/2024/Marco/conheca-as-principais-etapas-de-transparencia-e-seguranca-da-urna-no-dia-da-eleicao).
