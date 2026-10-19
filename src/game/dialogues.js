export const DIALOGUES = {
  greet: {
    speaker: 'Mbranco',
    text: 'Boiiiiiii, meu nome é Mbranco, mais conhecido como 00 do Paineiras',
    duration: 5200,
    priority: 10,
    repeat: 'once',
    gesture: 'talk'
  },
  today: {
    speaker: 'Mbranco',
    text: 'O que vamos fazer hoje boi',
    duration: 3600,
    priority: 10,
    repeat: 'once',
    gesture: 'talk'
  },
  plans: {
    speaker: 'Mbranco',
    text: 'Quero beber gin, ir pra Duck com o joão caga grosso, miguel bigode e matheus davi',
    duration: 6200,
    priority: 10,
    repeat: 'once',
    gesture: 'talk'
  },
  club: {
    speaker: 'Mbranco',
    text: 'Boiiiii, vamos pra Duck beber gin, torras uns cascalhos, ver as bbs',
    duration: 5000,
    priority: 30,
    repeat: 'once'
  },
  arriveClub: {
    speaker: 'Mbranco',
    text: 'Chegamos na Duck, boi! A pista tá chamando.',
    duration: 3800,
    priority: 25,
    repeat: 'once',
    gesture: 'talk'
  },
  dance: {
    speaker: 'Mbranco',
    text: 'Essa é a pista da Duck, boi! Só alegria.',
    duration: 3400,
    priority: 15,
    cooldown: 8000
  },
  danceStop: {
    speaker: 'Mbranco',
    text: 'Ufa, deu até sede. Bora de gin?',
    duration: 3200,
    priority: 12,
    cooldown: 8000,
    gesture: 'talk'
  },
  bar: {
    speaker: 'Mbranco',
    text: 'Aqui o gin é bem servido, boi. Vou pedir um.',
    duration: 3600,
    priority: 15,
    cooldown: 8000,
    gesture: 'talk'
  },
  gin: {
    speaker: 'Mbranco',
    text: 'Gin tônica na mão e a noite só começou.',
    duration: 3800,
    priority: 18,
    cooldown: 6000
  },
  vip: {
    speaker: 'Mbranco',
    text: 'Camarote liberado! Daqui a gente vê a pista inteira.',
    duration: 3800,
    priority: 18,
    cooldown: 8000,
    gesture: 'talk'
  },
  bed: {
    speaker: 'Mbranco',
    text: 'Minha cama tá arrumadinha, boi. Mas a Duck tá me chamando.',
    duration: 3800,
    priority: 8,
    cooldown: 10000,
    gesture: 'talk'
  },
  returnHome: {
    speaker: 'Mbranco',
    text: 'Já é quase de manhã... bora pro quarto, boi.',
    duration: 3600,
    priority: 30,
    repeat: 'once'
  },
  backHome: {
    speaker: 'Mbranco',
    text: 'De volta ao quarto. Que noite, boi!',
    duration: 3600,
    priority: 20,
    repeat: 'once',
    gesture: 'talk'
  },
  talkBedroom: {
    speaker: 'Mbranco',
    text: 'Tô de boa no quarto. Se quiser, bora pra Duck beber gin.',
    duration: 4000,
    priority: 6,
    cooldown: 9000,
    gesture: 'talk'
  },
  talkDance: {
    speaker: 'Mbranco',
    text: 'A pista tá boa demais. Dança comigo, boi!',
    duration: 3800,
    priority: 6,
    cooldown: 9000,
    gesture: 'talk'
  },
  talkBar: {
    speaker: 'Mbranco',
    text: 'O gin da Duck é diferente, boi. Confia.',
    duration: 3800,
    priority: 6,
    cooldown: 9000,
    gesture: 'talk'
  },
  talkVip: {
    speaker: 'Mbranco',
    text: 'Esse camarote é nosso. Só falta o champanhe.',
    duration: 3800,
    priority: 6,
    cooldown: 9000,
    gesture: 'talk'
  },
  wave: {
    speaker: 'Mbranco',
    text: 'Oi, boi! Tudo tranquilo?',
    duration: 2600,
    priority: 4,
    cooldown: 5000
  },
  window: {
    speaker: 'Mbranco',
    text: 'A noite tá linda, boi. Dá pra ver a fila da Duck daqui.',
    duration: 3800,
    priority: 7,
    cooldown: 9000,
    gesture: 'talk'
  },
  dj: {
    speaker: 'Mbranco',
    text: 'Solta o som, DJ! A pista é nossa, boi.',
    duration: 3200,
    priority: 14,
    cooldown: 5000,
    gesture: 'talk'
  },
  npcBia: {
    speaker: 'Bia',
    text: 'A pista tá quente, boi! Vem dançar comigo.',
    duration: 3400,
    priority: 12,
    cooldown: 6000
  },
  npcJoao: {
    speaker: 'João caga grosso',
    text: 'Boiiiii, o gin tá na mesa. Cê demorou, hein!',
    duration: 3600,
    priority: 12,
    cooldown: 6000
  },
  npcMiguel: {
    speaker: 'Miguel bigode',
    text: 'Camarote liberado. Matheus davi já pediu o champanhe.',
    duration: 3800,
    priority: 12,
    cooldown: 6000
  },
  npcMatheus: {
    speaker: 'Matheus davi',
    text: 'Gin tônica caprichado, boi. Na casa de vocês não, mas quase.',
    duration: 3800,
    priority: 12,
    cooldown: 6000
  },
  workStart: {
    speaker: 'Mbranco',
    text: 'Bora pro CEASA, boi! Primeiro pega o busão no ponto.',
    duration: 3600,
    priority: 26,
    gesture: 'talk'
  },
  workStreet: {
    speaker: 'Mbranco',
    text: 'O ponto é logo ali. O 101 Downtown passa nessa rua.',
    duration: 3400,
    priority: 12,
    cooldown: 9000,
    gesture: 'talk'
  },
  workBusWaiting: {
    speaker: 'Mbranco',
    text: 'O busão tá chegando. Melhor chegar perto da porta.',
    duration: 3200,
    priority: 16,
    gesture: 'talk'
  },
  workBusBoard: {
    speaker: 'Mbranco',
    text: 'Embarcando! CEASA, aqui vou eu.',
    duration: 2800,
    priority: 20,
    gesture: 'talk'
  },
  workArriveCeasa: {
    speaker: 'Mbranco',
    text: 'Desembarquei. Agora é só entrar no galpão e bater o ponto.',
    duration: 3800,
    priority: 20,
    gesture: 'talk'
  },
  clockIn: {
    speaker: 'Mbranco',
    text: 'Entrada registrada. Agora vou procurar o encarregado.',
    duration: 3600,
    priority: 20,
    gesture: 'talk'
  },
  clockAlreadyIn: {
    speaker: 'Mbranco',
    text: 'A entrada já foi registrada, boi. Bora trabalhar.',
    duration: 3000,
    priority: 8,
    cooldown: 5000
  },
  clockBeforeTask: {
    speaker: 'Mbranco',
    text: 'Primeiro bate o ponto e fala com o encarregado.',
    duration: 3200,
    priority: 10,
    cooldown: 5000
  },
  managerTask: {
    speaker: 'Seu Nilton',
    text: 'Chegou na hora, Mbranco. Descarrega 8 caixas do caminhão e leva cada uma pro setor certo.',
    duration: 5200,
    priority: 20
  },
  managerWorking: {
    speaker: 'Seu Nilton',
    text: 'Tô vendo o movimento. Tomate é na área vermelha, folha na verde e banana na frutas.',
    duration: 4600,
    priority: 12,
    cooldown: 9000
  },
  managerDone: {
    speaker: 'Seu Nilton',
    text: 'Fechou a carga! Agora volta no relógio e bate a saída.',
    duration: 4000,
    priority: 20
  },
  managerPaid: {
    speaker: 'Seu Nilton',
    text: 'Bom descanso, boi. O dinheiro já caiu. Amanhã tem mais.',
    duration: 3800,
    priority: 12,
    cooldown: 8000
  },
  coworkerLia: {
    speaker: 'Lia',
    text: 'Hoje o caminhão veio cheio. Confere o setor antes de soltar a caixa, viu?',
    duration: 4200,
    priority: 9,
    cooldown: 9000
  },
  coworkerDavi: {
    speaker: 'Davi',
    text: 'Se errar a área, é só voltar e tentar de novo. Ninguém nasce sabendo.',
    duration: 4200,
    priority: 9,
    cooldown: 9000
  },
  coworkerRita: {
    speaker: 'Rita',
    text: 'Essa caixa de banana vai em Frutas. As verdes são alfaces, não confunde.',
    duration: 4600,
    priority: 9,
    cooldown: 9000
  },
  ceasaDone: {
    speaker: 'Mbranco',
    text: 'Expediente concluído! Salário na conta e a Duck tá me esperando.',
    duration: 4400,
    priority: 30
  },
  noMoney: {
    speaker: 'Mbranco',
    text: 'Saldo insuficiente, boi. Melhor voltar pro CEASA e fazer mais um turno.',
    duration: 3400,
    priority: 14,
    cooldown: 4000
  }
}
