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


## Trabalho no CEASA

O ciclo completo agora inclui **Quarto -> ponto de ônibus -> CEASA -> Duck**. O botão **Ir Trabalhar** aparece no quarto e inicia o expediente. Se a página for recarregada no meio de um turno já registrado, o botão retoma o trabalho no galpão preservando as caixas entregues.

### Controles do trabalho

- **WASD** ou **setas** para andar; o personagem respeita paredes, displays, caminhão e limites do cenário.
- **E** ou **Interagir** quando o aviso de interação aparecer.
- Clique/toque nos objetos, colegas e áreas do galpão também interage quando o Mbranco está perto.
- No celular, use o direcional na tela; ele não cobre os botões de interação.

### Fluxo do expediente

1. Sair do quarto e ir até o ponto do ônibus 101; quando o aviso aparecer, pressione **E** (ou **Interagir**) para esperar o ônibus.
2. Quando as portas abrirem, aproxime-se da porta dianteira e pressione **E** para embarcar.
3. Desembarcar, entrar no galpão e bater o ponto.
4. Falar com Seu Nilton para receber a tarefa de **8 caixas**.
5. Pegar uma caixa no caminhão e levá-la ao setor correto: **Tomate**, **Folhas** ou **Frutas**.
6. Repetir até 8/8, bater a saída e receber **$ 150** uma única vez.
7. Escolher voltar para casa ou ir para a Duck.

O saldo, o progresso do turno, as compras e os convidados ficam em `localStorage` na chave `mbranco.ceasa.save.v1`. Não há dois saldos: o mesmo valor é usado no CEASA e na Duck.

### Bar e camarote

- O menu do bar vende gin, caipirinha, cerveja e água usando o saldo virtual.
- O camarote permite convidar Bia, João caga grosso e Miguel bigode; os convidados aparecem no cenário e ficam salvos.
- Compras com saldo insuficiente são recusadas e não deixam o saldo negativo.

### Limitações conhecidas

- Não existe sprite dedicado de Mbranco carregando caixa; a caixa é um overlay que acompanha o corpo usando os frames de idle/walk existentes.
- O ônibus e a porta de embarque usam o cenário ilustrado, com marcadores e transições em Phaser; não há sprite separado do veículo.
- Maçãs e laranjas aparecem nos cenários, mas a tarefa usa tomate, alface e banana. O asset de cenoura existe e fica reservado para uma expansão.
