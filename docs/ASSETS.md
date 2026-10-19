# Catálogo de assets

Os originais não são alterados. As cópias usadas pelo pipeline ficam em `assets-source/duck/` (arquivos da balada) e os WebP finais em `public/assets/`. A regeneração é feita com:

```bash
npm run assets
```

O comando executa `scripts/process-assets.mjs` (quarto) e `scripts/process-v2-assets.mjs` (Duck, sprites e NPCs).

## 1. Quarto

| Asset final | Dimensão | Origem | Uso |
| --- | --- | --- | --- |
| `room.webp` | 1600 × 893 | `assets-source/room.*` | Fundo do quarto |
| `window.webp` | 850 × 692 | `assets-source/window.*` | Janela interativa |
| `decor-frame-abstract.webp` | 282 × 507 | `assets-source/decor-frame-abstract.*` | Quadro abstrato |
| `decor-frame-landscape.webp` | 290 × 429 | `assets-source/decor-frame-landscape.*` | Quadro paisagem |
| `decor-rug.webp` | 983 × 525 | `assets-source/decor-rug.*` | Tapete sob o personagem |
| `bed.webp` | 1100 × 797 | `assets-source/bed.*` | Cama interativa |
| `bedside-table.webp` | 520 × 652 | `assets-source/bedside-table.*` | Criado-mudo |
| `desk.webp` | 1200 × 1196 | `assets-source/desk.*` | Escrivaninha |
| `lamp.webp` | 420 × 780 | `assets-source/lamp.*` | Abajur interativo |
| `decor-plant.webp` | 338 × 555 | `assets-source/decor-plant.*` | Planta |

O quarto foi simplificado na V2: a poltrona e o gabinete avulso deixaram de ser carregados para reduzir a sensação de depósito. O abajur e a cama continuam interativos.

## 2. Mbranco (personagem)

O canvas de todos os frames é **600 × 800**, com os pés no mesmo baseline (790 px). Isso mantém o corpo no mesmo tamanho ao trocar de animação.

| Asset final | Frames | Dimensão | Origem | Uso |
| --- | --- | --- | --- | --- |
| `char-idle.webp` | 1 | 600 × 800 | quarto V1 | Idle |
| `char-blink.webp` | 1 | 600 × 800 | quarto V1 | Piscada automática |
| `char-wave.webp` | 1 | 600 × 800 | quarto V1 | Aceno |
| `mb-walk-0…3.webp` | 4 | 600 × 800 | `Character_performing_walking_ani…_2K_20261019120001.jpg`, linha superior | Caminhada |
| `mb-dance-0…7.webp` | 8 | 600 × 800 | `Chibi_man_dancing_animation_sprites_2K_20261019121154.jpg`, índices 2, 3, 6, 7, 8, 9, 10 e 11 | Dança na pista |
| `mb-happy-0…3.webp` | 4 | 600 × 800 | `Character_performing_conversatio…_2K_20261019122155.jpg`, índices 8, 3, 6 e 11 | Felicidade/convite à balada |
| `mb-talk-0…3.webp` | 4 | 600 × 800 | mesma folha, índices 5, 3, 8 e 0 | Conversa com gestos |
| `mb-drink-0…6.webp` | 7 | 600 × 800 | `Character_performing_drinking_an…_2K_20261019121201.jpg`, índices 1 a 7 | Beber gin no bar |

Observações:

- A folha `Character_blinking_animation_spr…` não tem piscada legível (o personagem usa óculos escuros), então a piscada da V1 foi mantida.
- A folha de flerte foi preservada em `assets-source/duck/char-flirt.jpg` como alternativa, mas não é usada para não competir com as animações principais.
- A folha do bartender foi identificada, mas não entrou no recorte final; o bar usa o próprio cenário e a animação de drink do Mbranco.
- Os frames foram recortados por célula, tiveram o fundo removido por flood fill, passaram por limpeza de ilhas e foram normalizados em `sharp`.

## 3. Duck Nightclub

### Cenários

| Asset final | Dimensão | Origem | Uso |
| --- | --- | --- | --- |
| `duck-dancefloor.webp` | 1600 × 900 | `Empty_nightclub_dance_floor_arch…_2K_20261019120702.jpg` | Pista, palco e DJ |
| `duck-bar.webp` | 1600 × 900 | `Modern_nightclub_bar_interior_2K_20261019120952.jpg` | Bar |
| `duck-vip.webp` | 1600 × 900 | `Nightclub_VIP_lounge_interior_de…_2K_20261019121801.jpg` | Camarote |
| `duck-exterior.webp` | 1600 × 900 | `Nightclub_exterior_with_neon_sign_2K_20261019120313.jpg` | Transição de ida/volta |

Os cenários já incluem palco, caixas de som, DJ booth, bar, garrafas e mobiliário. Nada disso foi remontado por código.

### Objetos e NPCs

| Asset final | Dimensão | Origem | Uso |
| --- | --- | --- | --- |
| `disco-ball.webp` | 420 × 420 | `Nightclub_interactive_assets_col…_2K_20261019120706.jpg` (globo esquerdo) | Globo interativo, com recorte circular e brilho em código |
| `npc-1.webp` | 440 × 680 | `Chibi_characters_in_nightclub_scene_2K_20261019120712.jpg`, 1ª figura | Dançarina à esquerda da pista |
| `npc-2.webp` | 440 × 680 | mesma folha, 3ª figura | Convidado de boné e headphone à direita |
| `npc-3.webp` | 440 × 680 | mesma folha, 8ª figura | Convidado com copo no camarote |
| `bartender-0…1.webp` | 2 | 440 × 680 | `Chibi_bartender_performing_bar_a…_2K_20261019120957.jpg`, linha superior | Bartender animado no bar |

Os NPCs foram recortados individualmente, com remoção de restos de figuras vizinhas nas bordas. Eles têm sway/bob suaves em código, são clicáveis e respondem com falas próprias. O bartender usa um loop curto de shaker e também é clicável para pedir o gin.

### Efeitos

`warm-glow`, `soft-shadow` e `sparkle` são texturas geradas em canvas no runtime (`src/game/effects.js`), sem downloads externos. O rótulo e o brilho do DJ também são desenhados em runtime; não há asset de imagem adicional para o booth.

### Interações da Duck

- Clique no globo, no piso ou no personagem para dançar/parar.
- Clique no DJ para acionar as luzes e a batida.
- Clique em Bia, João caga grosso, Miguel bigode ou Matheus davi (bartender) para ouvir uma fala.
- Clique no GIN para pedir a bebida e no camarote para brindar.
- O bartender tem loop de shaker; os NPCs balançam de leve.

## 4. Áudio

Não há arquivos de áudio externos. Todos os efeitos e a batida da Duck são sintetizados em Web Audio por `src/game/systems/SoundManager.js`.

## 5. Originais não usados

Estes arquivos foram identificados na auditoria, mas não entram no jogo para evitar sobreposição desnecessária:

- `Character_performing_flirting_an…` (folha de flerte)
- `Character_performing_walking_ani…` versão 1024 (a versão 2K foi escolhida)
- `Chibi_characters_in_evening_wear…`
- `People_waiting_outside…`
- `Nightclub_exterior_with_assets…`
- `Chibi_characters_socializing…`
- cena de pista lotada
- assets de bar e mobiliário do camarote
