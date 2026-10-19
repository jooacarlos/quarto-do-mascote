# Quarto do Mascote & Duck

Jogo de mascote virtual 2D no navegador, feito com Vue 3, Vite e Phaser 3. O Mbranco conversa, pisca, acena, descansa no quarto e pode ir para a balada Duck, onde dança, bebe um gin e curte o camarote.

## Rodar

```bash
npm install
npm run dev
```

Abra o endereço indicado pelo Vite. Funciona com mouse e toque.

## Build

```bash
npm run build
npm run preview
```

## O que tem no jogo

- Quarto organizado com cama, abajur e janela interativos, piscada automática e aceno.
- Falas obrigatórias do Mbranco, incluindo a apresentação, o convite e os planos para a Duck.
- Botão **Balada** com sequência de felicidade, caminhada, transição pela fachada e chegada à pista.
- Duck com três áreas: **Pista**, **Bar** e **Camarote**.
- Pista com globo de discoteca, DJ interativo, NPCs clicáveis, piso interativo e animação de dança.
- Bar com bartender animado, pedido de gin e animação de bebida.
- Camarote com brinde, sparkles e NPC.
- Diálogo animado em balão, status contextual, navegação por áreas e retorno ao quarto sem recarregar a página.
- Travas de ação para evitar animações e diálogos sobrepostos.
- Efeitos sonoros sintetizados, incluindo batida de clube, com botão de mute.

## Controles

- Clique/toque no personagem, no abajur, na cama ou na janela no quarto.
- **Acenar**, **Conversar** e **Balada** na parte inferior.
- Na Duck, use **Pista**, **Bar** e **Camarote** para trocar de ambiente.
- **Dançar** / **Parar**, **Pedir gin** e **Brindar** aparecem conforme a área.
- Clique no DJ, no bartender, no globo e nos NPCs para interações extras.
- **Quarto** retorna ao quarto.
- O botão de alto-falante no canto superior direito liga/desliga o som.

## Assets

Os originais ficam preservados em `assets-source/`. As versões otimizadas usadas pelo jogo ficam em `public/assets/` e podem ser regeneradas com:

```bash
npm run assets
```

O pipeline usa `sharp` para remover fundo, recortar sprites, normalizar os frames do personagem, preparar os NPCs e o globo e otimizar os cenários. O catálogo completo está em [docs/ASSETS.md](docs/ASSETS.md).

## Estrutura

```text
src/
  game/
    animations.js        registro das animações do Mbranco
    dialogues.js         falas e prioridades
    effects.js           texturas de brilho, sombra e sparkle
    scenes/
      BedroomScene.js    quarto e saída para a Duck
      DuckScene.js       pista, bar e camarote
      TravelScene.js     transição pela fachada
    systems/
      CharacterController.js
      DialogueSystem.js
      InteractiveRegistry.js
      SoundManager.js
scripts/
  process-assets.mjs     pipeline do quarto
  process-v2-assets.mjs  pipeline da Duck e animações
docs/ASSETS.md           catálogo de assets
```

## Repositório e site

- GitHub: https://github.com/jooacarlos/quarto-do-mascote
- Site ao vivo: https://quarto-do-mascote.netlify.app

Clonar e rodar em outro PC:

```bash
git clone https://github.com/jooacarlos/quarto-do-mascote.git
cd quarto-do-mascote
npm install
npm run dev
```

O deploy de produção usa o `netlify.toml`; depois de instalar o Netlify CLI, rode:

```bash
npm run deploy
```
