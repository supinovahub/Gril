# Notificações de novas mensagens no navegador

- Data: 19/08/2026
- Status: decisão de produto solicitada pelo usuário

## Decisão

Enquanto houver uma sessão autenticada no workspace, uma nova mensagem real
recebida do WhatsApp deve atualizar o Inbox sem F5 e emitir um aviso sonoro no
navegador. O som acontece somente para um novo `INSERT` inbound observado pelo
Realtime depois que a assinatura está ativa; mensagens outbound, sincronização
do histórico e reconciliações não emitem som.

O título da aba exibe o contador canônico do Inbox no formato
`(N) <título atual>`, limitado visualmente a `99+`. Esse número representa
conversas visíveis com mensagem inbound não lida ou sugestão pendente, conforme
o contador já usado na navegação; não representa a quantidade bruta de
mensagens e não altera a ordem cronológica das conversas.

## Preferência e limites do navegador

- O som começa habilitado e pode ser silenciado ou reativado pelo ícone no
  rodapé da navegação lateral.
- A preferência é local, versionada e persistida somente no navegador; não
  contém dados de leads.
- Por restrição dos navegadores, o áudio fica disponível depois da primeira
  interação do usuário com a página. Reativar o som pelo botão também prepara
  o áudio imediatamente.
- Abas da mesma origem coordenam um claim temporário por ID de mensagem para
  evitar que uma única mensagem toque repetidamente em várias abas.

## Atualização e recuperação

Eventos Realtime de mensagens, sugestões e cursores de leitura solicitam uma
nova leitura do contador. A reconciliação já existente por foco, visibilidade e
intervalo de 30 segundos permanece como proteção para o título e os badges.
Ela não reproduz sons retroativos quando um evento foi perdido.

## Separação da Central

Mensagem comum do WhatsApp não cria registro persistente na Central nem uma
notificação push do sistema operacional. A Central e seu push continuam
reservados aos alertas operacionais definidos pelo produto. Esta decisão não
altera RLS, permissões, schema, dados, automações do Pedro nem ordenação do
Inbox.
