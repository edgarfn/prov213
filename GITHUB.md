# Como enviar o projeto para o GitHub

Guia prático para o dia a dia deste repositório e para situações que já aconteceram
aqui (conflito de push, segredo commitado por engano). Não é um tutorial genérico de
Git — é específico para como este projeto está configurado.

## 1. Informações do repositório

- **Remoto**: `https://github.com/edgarfn/prov213.git` (`origin`)
- **Branch principal**: `master`
- **Autenticação**: `gh auth status` confirma login autenticado como `edgarfn`. Se pedir
  senha ao rodar `git push`, rode `gh auth login` primeiro (ou configure uma chave SSH).

Para conferir a qualquer momento:

```bash
git remote -v
git branch --show-current
gh auth status
```

## 2. Fluxo do dia a dia

```bash
# 1. Ver o que mudou
git status

# 2. Revisar o diff antes de adicionar — especialmente se mexeu em algo perto de
#    credenciais, .env, docker-compose.yml ou configs de deploy
git diff

# 3. Adicionar arquivos específicos (evite "git add -A" sem revisar o status depois)
git add caminho/do/arquivo.ts

# 4. Conferir o que ficou staged antes de commitar
git status

# 5. Commitar com mensagem descritiva (explique o *porquê*, não só o *o quê*)
git commit -m "resumo curto da mudança e o motivo"

# 6. Buscar o que há de novo no remoto antes de enviar
git fetch origin

# 7. Enviar
git push origin master
```

Sempre rode `git status` (e, se usou `git add -A`, revise a lista de arquivos
adicionados) antes de commitar. É o passo que teria evitado o incidente descrito na
seção 4.

## 3. O que NUNCA deve ser commitado

O `.gitignore` já bloqueia estes caminhos — não remova essas linhas:

| Padrão | Por quê |
|---|---|
| `.env*` (exceto `.env.example`) | Credenciais reais: `DATABASE_URL`, `NEXTAUTH_SECRET`, chaves do Turnstile, SMTP |
| `/uploads/` | Evidências dos usuários (dados sensíveis do dossiê técnico) |
| `/backups/` | Backups do banco, alguns podem estar sem criptografia |
| `/node_modules`, `/app/generated/prisma` | Gerados por `npm install`/`prisma generate`, não fazem sentido versionados |

`.env.example` é a **única exceção** dentro do padrão `.env*` (há um `!.env.example`
logo depois no `.gitignore` liberando só ele). Ele documenta quais variáveis existem,
mas só com valores de exemplo/placeholder — nunca copie um valor real para lá.

**Antes de adicionar uma variável de ambiente nova:**
1. Adicione a variável com um valor de exemplo em `.env.example`.
2. Adicione o valor real apenas em `.env` / `.env.local` (nunca commitados).
3. Se a variável for usada pelo `docker-compose.yml`, referencie-a como `${NOME_DA_VAR}`
   no compose — nunca escreva o valor real diretamente no YAML (foi exatamente o erro
   corrigido na seção 4).

## 4. Incidente já ocorrido neste repositório (e como não repetir)

Em commits anteriores (`b7458b4` e mais antigos), o `docker-compose.yml` tinha
`DATABASE_URL`, `NEXTAUTH_SECRET` e as chaves do Cloudflare Turnstile **em texto
puro**. Foram redigidas manualmente depois, e por fim movidas para variáveis de
ambiente (`${VAR:?mensagem de erro}`) com `.env.example` documentando o necessário —
ver commit `76f8b4b`.

**Lição**: redigir/sobrescrever o arquivo em um commit novo não apaga o valor real do
histórico do Git. Qualquer pessoa com acesso ao repositório ainda consegue ver o
segredo antigo navegando pelos commits anteriores (`git log -p`, ou direto no GitHub).

Se isso acontecer de novo:
1. **Rotacione o segredo imediatamente** (gere um `NEXTAUTH_SECRET` novo, troque a
   chave no Cloudflare, troque a senha do banco). Isso é o que realmente neutraliza o
   vazamento — o valor antigo se torna inútil mesmo continuando visível no histórico.
2. Corrija o arquivo atual para usar `${VAR}` em vez do valor real (como já foi feito).
3. Reescrever o histórico (`git filter-repo` / BFG Repo-Cleaner) é opcional e mais
   arriscado (reescreve hashes de commit, exige force-push, pode quebrar clones de
   outras pessoas) — só vale a pena se o repositório for público e a rotação sozinha
   não for suficiente.

## 5. Push rejeitado ("failed to push some refs")

Já aconteceu neste repositório: alguém editou arquivos direto pela interface do
GitHub enquanto havia trabalho local pendente. O Git recusa o push para não perder
esse trabalho:

```
! [rejected]        master -> master (fetch first)
```

Resolução (sem `--force`):

```bash
git fetch origin
git log --oneline HEAD..origin/master   # o que tem no remoto que você não tem
git merge origin/master --no-edit       # traz para o seu branch local
# se der conflito, resolva os arquivos marcados, depois:
#   git add <arquivo-resolvido>
#   git commit
git push origin master
```

Nunca use `git push --force` neste branch sem confirmar explicitamente com quem
mais tem acesso ao repositório — pode apagar commits de outra pessoa.

## 6. Criando um repositório do zero (referência)

Este projeto já tem repositório e remoto configurados, mas caso precise repetir o
processo (por exemplo, em outro projeto):

```bash
cd caminho/do/projeto
git init
git add .
git status   # confira a lista antes de commitar — sem .env, sem node_modules
git commit -m "commit inicial"

# opção A: criar o repositório no GitHub via gh CLI e já conectar
gh repo create nome-do-repositorio --private --source=. --remote=origin --push

# opção B: repositório já existe no GitHub, só conectar
git remote add origin https://github.com/usuario/nome-do-repositorio.git
git branch -M master
git push -u origin master
```

## 7. Checklist rápido antes de todo push

- [ ] `git status` — nada inesperado na lista (sem `.env`, sem arquivos de upload/backup)
- [ ] `git diff` (ou revisão do que foi staged) — nenhum valor que pareça senha, token
      ou chave de API escrito diretamente no código
- [ ] Testes/typecheck rodaram limpos, se a mudança for de código (`npm test`,
      `npx tsc --noEmit`)
- [ ] `git fetch origin` antes de `git push`, para pegar mudanças feitas por outra via
      (ex.: edição direta no GitHub)
