# AGENTS.md

## Deploy e sincronização com o GitHub

Sempre que fizer um deploy de produção deste projeto, mantenha o repositório atualizado:

1. Rode o build/deploy (`npm run build` e o deploy no Netlify).
2. Confirme com `git status` quais arquivos fazem parte da mudança.
3. Faça commit **apenas** dos arquivos relacionados ao deploy, com mensagem no padrão do repositório (ex.: `fix: ...`, `feat: ...`, `docs: ...`, sem acentos para evitar problemas de encoding).
4. Faça `git push origin main` em seguida.
5. Verifique que `git status` está limpo e que `main` está sincronizada com `origin/main`.

Regras:

- Nunca commitar segredos, tokens ou arquivos locais (`dist/`, `node_modules/` e `.netlify/` já estão no `.gitignore`).
- Não commitar ruído sem relação com o deploy (ex.: mudanças cosméticas no `package-lock.json` podem ser descartadas com `git checkout -- package-lock.json`).
- Se o push falhar por autenticação, avisar o usuário para autenticar e então concluir o push.

## Comandos úteis

```bash
npm install
npm run build
npm run deploy
git status --short
git push origin main
```
