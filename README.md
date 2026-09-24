# NetPoint

Aplicativo para mapear pontos de rede, cabos, equipamentos e portas de switches.
O objetivo principal: responder em poucos segundos **"em qual porta do switch está o computador do Lucas?"**

```
PC do Lucas (RH)
   ↓
Ponto de rede RH-PT-07
   ↓
Patch Panel 01 — Porta 07
   ↓
Switch RH 01 — Porta 43
```

| Pasta      | Tecnologia                                                                  |
| ---------- | --------------------------------------------------------------------------- |
| `backend/` | Node.js · NestJS 11 · Prisma 6 · PostgreSQL 17 · JWT · ExcelJS              |
| `mobile/`  | React Native · Expo SDK 57 · Expo Router · TypeScript · React Query · Zustand |

O NetPoint roda **na nuvem**: a API fica em **https://netpoint-api.vercel.app/api** e o app é
instalado no celular como APK. Nenhum computador precisa ficar ligado. Veja
[Versão na nuvem](#versão-na-nuvem-produção). As instruções abaixo são para **desenvolvimento local**.

---

## Versão na nuvem (produção)

```
Celular (APK NetPoint)
   │  HTTPS
   ▼
API NestJS na Vercel ── região gru1 (São Paulo)
   https://netpoint-api.vercel.app/api
   │
   ▼
PostgreSQL no Neon ─── região São Paulo, contratado pelo Marketplace da Vercel
```

| Parte | Onde fica | Conta |
|---|---|---|
| API | Projeto **`netpoint-api`** na Vercel, pasta `backend/` | Vercel `ferreirajoao-fatec` |
| Banco | Neon PostgreSQL **`netpoint-db`**, conectado ao projeto `netpoint-api` | Vercel Marketplace (plano gratuito) |
| App | Projeto **`@joaoferreira_jgf/netpoint`** no EAS (build e chave de assinatura Android) | Expo `joaoferreira_jgf` |

> **O banco oficial é o da nuvem.** O PostgreSQL do Docker serve só para desenvolvimento.
> O que for cadastrado pelo Expo Go, ligado a uma API local, **não aparece** no app instalado.

### Variáveis de ambiente (Vercel)

| Variável | Origem | Uso |
|---|---|---|
| `DATABASE_URL` | Integração Neon (automática) | Conexão com pool, usada pela API |
| `DATABASE_URL_UNPOOLED` | Integração Neon (automática) | Conexão direta, usada pelas migrações (`directUrl` no Prisma) |
| `JWT_SECRET` | Criada manualmente (Sensitive) | Assinatura dos logins, exclusiva da produção |

Para trazer as variáveis para a máquina local (arquivo `backend/.env.local`, que fica fora do git):

```bash
cd backend
npx vercel@latest link              # uma vez: vincula a pasta ao projeto netpoint-api
npx vercel@latest env pull .env.local --yes
```

### Atualizar a API

O deploy é feito pela CLI. O projeto **não** está ligado ao GitHub, então um push não publica nada.

```bash
cd backend
npx vercel@latest deploy --prod
```

Na Vercel, o `postinstall` roda o `prisma generate`. O `src/main.ts` é detectado automaticamente
e a API vira uma única Vercel Function.

### Mudanças no banco (migrações)

Crie a migração localmente (`npx prisma migrate dev --name <nome>`) e aplique na nuvem **antes**
de publicar a API nova:

```bash
cd backend
# carrega as credenciais do Neon só para este comando (bash)
set -a; eval "$(grep -E '^(DATABASE_URL|DATABASE_URL_UNPOOLED)=' .env.local)"; set +a
npx prisma migrate deploy
```

> ⚠️ **Nunca rode `npm run db:seed` ou `npm run db:reset` com as credenciais da nuvem.**
> Os dois comandos **apagam todos os dados** (o seed recria os exemplos de demonstração).

### Gerar um APK novo

O perfil `preview` do `mobile/eas.json` gera um APK que já aponta para a API na nuvem. O
endereço (`EXPO_PUBLIC_API_URL`) fica nas variáveis de ambiente do EAS (ambientes `preview` e
`production`, veja `npx eas-cli@latest env:list`):

```bash
cd mobile
npx eas-cli@latest login            # uma vez
npx eas-cli@latest build --platform android --profile preview
```

O build roda nos servidores do Expo (10 a 20 minutos no plano gratuito). No fim, o link de
download aparece no terminal e em expo.dev. Instale **por cima** do app atual: como a chave de
assinatura fica guardada no EAS, os dados de login são preservados.

Só é preciso gerar um APK novo quando entra uma biblioteca com código nativo ou quando muda a
`version` do `mobile/app.json`. Para o resto, use uma atualização pelo ar (abaixo).

### Atualizar o app sem reinstalar (EAS Update)

Mudanças em telas, textos e lógica do app são enviadas direto para os celulares:

```bash
cd mobile
npx eas-cli@latest update --channel preview --environment preview --message "Filtros na lista de equipamentos"
```

O app baixa a atualização em segundo plano ao abrir e passa a usá-la **na próxima vez que for
aberto**. Para ver na hora, feche o app por completo e abra de novo (às vezes duas vezes).

A atualização só chega aos APKs com a mesma `version` do `app.json` (`runtimeVersion` com
política `appVersion`). Ao adicionar uma biblioteca nativa, aumente a `version` e gere um APK novo.

> Se o upload falhar com `EPERM ... symlink` no Windows, a causa são links simbólicos criados
> por ferramentas de IA (ex.: `backend/.claude/skills`). Remova só os links, não o conteúdo, e
> rode o build de novo.

### Acesso e segurança

- A API fica pública na internet e é protegida pelo login. Sem token, todas as rotas respondem 401.
- Em produção existe só o usuário **admin**, com senha própria. Os usuários de demonstração
  abaixo existem apenas no banco local criado pelo seed.
- Crie técnicos e perfis de consulta em **Ajustes › Usuários**, com senhas próprias.
- Faça cópias periódicas em **Ajustes › Exportar inventário** (planilha .xlsx).

---

## Desenvolvimento local

Pré-requisitos: Node.js 20+ e Docker.

### 1. Banco de dados

```bash
docker compose up -d          # PostgreSQL na porta 5433
```

### 2. API

```bash
cd backend
npm install
cp .env.example .env          # ajuste JWT_SECRET em produção
npx prisma migrate deploy     # cria as tabelas
npm run db:seed               # dados de demonstração (opcional)
npm run start:dev             # http://localhost:3000/api
```

### 3. App

```bash
cd mobile
npm install
npx expo start                # QR Code para o Expo Go; "w" abre no navegador
```

No celular, o app usa automaticamente o IP do computador que roda o Expo
(`http://<ip>:3000/api`). O celular precisa estar na mesma rede Wi-Fi. O endereço
pode ser alterado na tela de login ("Configurar servidor") ou em **Ajustes**,
ou fixado com a variável `EXPO_PUBLIC_API_URL`.

### Usuários de demonstração (somente local)

Criados pelo `npm run db:seed` no banco do Docker. **Não existem na nuvem.**

| Perfil        | E-mail                    | Senha         |
| ------------- | ------------------------- | ------------- |
| Administrador | `admin@netpoint.local`    | `admin123`    |
| Técnico       | `tecnico@netpoint.local`  | `tecnico123`  |
| Consulta      | `consulta@netpoint.local` | `consulta123` |

O seed cria um campus com RH, Financeiro, CPD e Laboratório: 2 switches, 2 patch panels,
31 pontos e 27 equipamentos, incluindo o exemplo do PC do Lucas na porta 43 do Switch RH 01.

---

## Funcionalidades

| # | Funcionalidade | Onde fica |
|---|---|---|
| 1 | **Dashboard**: equipamentos, switches, pontos, portas em uso/livres, pontos sem identificação, cabos, atalhos | aba *Início* |
| 2 | **Locais**: Prédio › Bloco › Andar › Sala, além dos setores | *Rede › Salas e locais* |
| 3 | **Equipamentos**: 9 tipos, com hostname, IP, MAC, patrimônio e ponto de rede | *Rede › Equipamentos* |
| 4 | **Pontos de rede**: sala, setor, patch panel e porta, switch e porta, equipamento, cabo | *Rede › Pontos de rede* |
| 5 | **Switches**: fabricante, modelo, portas, IP, MAC, local, rack | *Rede › Switches* |
| 6 | **Frente do switch**: portas coloridas por status; toque para ver ponto, equipamento, usuário, setor, IP e hostname, trocar o status ou ligar/desligar um ponto | tela do switch |
| 7 | **Rastrear conexão**: fluxo Equipamento → Ponto → Patch panel → Switch | aba *Pesquisar*, botão "Ver caminho da conexão" |
| 8 | **Pesquisa global**: nome, PC, hostname, IP, MAC, patrimônio, ponto, switch, porta (`43`) ou switch + porta (`RH 01 porta 43`) | barra da tela inicial e aba *Pesquisar* |
| 9 | **QR Code** para switch, rack, ponto e equipamento, com leitor no app | ícone de QR nos detalhes; aba *QR Code* |
| 10 | **Histórico**: data, hora, usuário, alteração, valor anterior → novo | *Rede › Histórico* e nos detalhes |
| 11 | **Exportar inventário .xlsx** com 4 abas formatadas | *Início* ou *Ajustes* (admin) |
| 12 | **Importar planilha** com validação antes de gravar | *Ajustes › Importar planilha* (admin) |
| 13 | **Perfis**: Administrador, Técnico e Consulta | *Ajustes › Usuários* (admin) |

Tema claro/escuro: *Ajustes › Aparência* (o padrão acompanha o sistema).

### Permissões

| Ação | Administrador | Técnico | Consulta |
|---|:---:|:---:|:---:|
| Consultar, pesquisar, rastrear, ler QR Code | ✅ | ✅ | ✅ |
| Cadastrar, editar e alterar conexões | ✅ | ✅ | — |
| Excluir | ✅ | — | — |
| Exportar e importar Excel | ✅ | — | — |
| Gerenciar usuários | ✅ | — | — |

As regras são aplicadas na API (`backend/src/common/auth.ts`). O app apenas esconde os botões que o perfil não pode usar.

---

## Modelo de dados

```
Location (Prédio › Bloco › Andar, hierarquia via parentId)
  └─ Room (Sala) ── Department (Setor)
       ├─ Rack ─┬─ Switch ─── SwitchPort (1..N)
       │        └─ PatchPanel ─ PatchPanelPort (1..N)
       ├─ NetworkPoint
       └─ Device

Connection  (uma por ponto de rede)
  networkPoint ─ device? ─ patchPanelPort? ─ switchPort?
ConnectionHistory (auditoria de todas as alterações)
User (ADMIN | TECHNICIAN | VIEWER)
```

- **Connection** guarda o caminho físico com chaves estrangeiras reais, sem textos soltos.
  Equipamento, porta de patch panel e porta de switch são `@unique` na conexão: cada elemento
  físico fica em no máximo um caminho.
- Ao ligar um equipamento ou uma porta que já está em outro ponto, a API **transfere** a ligação
  e registra as duas alterações no histórico.
- **Status da porta**: o status gravado é manual (Disponível, Reservada, Em uso, Desativada, Com problema).
  O status exibido considera a conexão: porta com ponto ligado aparece como *Em uso*, a menos que esteja
  desativada ou com problema. Uma porta reservada que recebe conexão deixa de ser reserva.
- **Ponto sem identificação** é um ponto sem porta de switch conhecida.
- As portas são criadas automaticamente ao cadastrar um switch ou patch panel. Reduzir a quantidade
  só é permitido quando as portas removidas estão livres.

Schema completo: `backend/prisma/schema.prisma`.

## API (resumo)

Todas as rotas ficam em `/api` e exigem `Authorization: Bearer <token>`, exceto o login.

| Método e rota | Descrição |
|---|---|
| `POST /auth/login` · `GET /auth/me` · `POST /auth/change-password` | autenticação |
| `GET /dashboard` | números do painel e últimas alterações |
| `GET /search?q=` | pesquisa global, com o caminho de cada resultado |
| `GET /trace?deviceId=│pointId=│switchPortId=│patchPanelPortId=` | caminho da conexão |
| `GET/POST/PATCH/DELETE /devices` · `/points` · `/switches` · `/racks` · `/patch-panels` | cadastros |
| `GET /switches/:id` | switch com todas as portas e o que está ligado em cada uma |
| `GET/PATCH /switches/:id/ports/:n` | detalhe da porta, status e ligação a um ponto |
| `GET/POST/PATCH/DELETE /locations` · `/locations/tree` · `/rooms` · `/departments` | estrutura física |
| `GET /history?entityType=&entityId=` | histórico |
| `GET/POST/PATCH/DELETE /users` | usuários (admin) |
| `GET /excel/export` · `GET /excel/template` · `POST /excel/import?apply=` | Excel (admin) |

## Excel

**Exportação** (`netpoint-inventario-AAAA-MM-DD.xlsx`) com as abas *Equipamentos*, *Pontos de Rede*,
*Switches* e *Mapeamento de Portas*. Cada aba é uma tabela do Excel com cabeçalho destacado, filtros,
linhas zebradas, primeira linha congelada e largura de coluna automática.

**Importação** em duas etapas:
1. O app envia a planilha e a API **valida** sem gravar nada. Ela verifica campos obrigatórios, tipo,
   IP, MAC, hostnames e pontos repetidos, se os switches e patch panels existem, os limites de porta,
   portas usadas duas vezes e referências entre as abas.
2. Sem erros, o botão "Importar agora" grava tudo em **uma única transação**.

Equipamentos com o mesmo patrimônio ou hostname e pontos com a mesma identificação são atualizados.
Setores e salas que ainda não existem são criados. Baixe o modelo pelo próprio app.

## QR Code

A etiqueta contém um deep link, por exemplo `netpoint://switches/<id>`. Ao ler pelo leitor do app,
ou pela câmera do celular com o app instalado, a tela do switch, rack, ponto ou equipamento abre direto.
O QR Code pode ser compartilhado como PNG para imprimir.

## Estrutura do código

```
backend/src
  auth/          login, JWT e guard global de perfis
  connections/   núcleo: vincular elementos, transferir ligações, rastrear caminho
  devices/ points/ switches/ racks/ structure/   cadastros
  search/ dashboard/ history/ users/
  excel/         exportação e importação
  common/        decorators de permissão e formatação (MAC, rótulos)

mobile/src
  app/           rotas (Expo Router)
    login.tsx
    (app)/       área autenticada
      (tabs)/    Início · Pesquisar · Rede · QR Code · Ajustes
      devices/ points/ switches/ racks/ patch-panels/
      trace.tsx qr-code.tsx locations.tsx history.tsx users.tsx import.tsx
  components/    TraceFlow, PortGrid, PortPicker, Select, UI base
  api/           cliente HTTP, tipos e hooks do React Query
  store/         sessão e tema (Zustand)
  lib/           rótulos, QR Code, download/compartilhamento
```

## Gerar o app instalável

Veja [Gerar um APK novo](#gerar-um-apk-novo). O endereço da API (`EXPO_PUBLIC_API_URL`)
fica nas variáveis de ambiente do EAS. Para iOS, o build (`--platform ios`) exige uma conta paga de
desenvolvedor Apple.
