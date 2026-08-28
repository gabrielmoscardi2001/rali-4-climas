# RALI 4 CLIMAS

Corrida de 4 carrinhos para **tela vertical (1080×1920)**. Cada pessoa escaneia o QR Code do carro que quer pilotar e o celular vira o controle: direção, freio e um item de sabotagem por vez (óleo, buraco, lata, turbo). A pista dá a volta pelos quatro climas — deserto embaixo, savana, floresta e neve no topo — e cada terreno tem aderência diferente (a neve escorrega).

## Rodar

```bash
npm install
npm start
```

- **Totem:** `http://localhost:3000/host` no Chrome em modo kiosk.
- **Celulares:** só pelo QR Code da tela. O servidor detecta o IP da rede e monta o link `http://SEU-IP:3000/controle?s=SALA&v=CARRO`.
- Totem e celulares precisam estar **na mesma rede** (Wi-Fi do evento ou roteador 4G próprio).

Atalho de kiosk no Windows:

```
chrome.exe --kiosk --app=http://localhost:3000/host --autoplay-policy=no-user-gesture-required
```

## Como a partida acontece

1. Lobby: 4 QR Codes na tela, um por carro (vermelho, azul, amarelo, verde).
2. Cada piloto digita o apelido e toca em **Estou pronto**.
3. Quando todos os conectados confirmam, entra a contagem e a largada. Vaga vazia vira carro automático — dá para jogar sozinho contra 3 bots.
4. 3 voltas. Tela de resultado por 18s e volta ao lobby. Quem tocou em "Jogar de novo" já entra na próxima automaticamente.

**Teclas do operador na tela:** `S` força a largada · `R` volta ao lobby · `F` tela cheia.

## Itens

| Item | Efeito |
|---|---|
| 🛢️ Óleo | poça atrás do carro; quem passa roda por ~1s |
| 🕳️ Buraco | atrás do carro; quem cai perde quase toda a velocidade |
| 🥫 Lata | voa pelo traçado à frente e atordoa o primeiro que acertar |
| ⚡ Turbo | 2,2s de velocidade extra |

As caixas “?” dão itens melhores para quem está atrás. Quem leva uma pancada fica 2,6s imune, pra ninguém ficar preso rodando.

## Arquitetura

- `server.js` — Express + WebSocket. O servidor **não simula nada**: cria a sala, gera QR e faz o relay dos inputs.
- `public/host.html` — a tela. Roda toda a física, o desenho e o placar (canvas 1080×1920 escalado para caber no monitor).
- `public/controle.html` — o controle no celular.

Como a física roda no navegador do totem, o jogo continua fluido mesmo com a rede do evento oscilando: um input atrasado atrasa só aquele carro.

## Ajustes rápidos (topo do `host.html`)

```js
const VOLTAS=3;              // duração da partida
const PISTA=176;             // largura da pista
const ACEL=500, VMAX=505;    // aceleração e velocidade máxima
const CTRL=[...];            // pontos do traçado
BIOMAS[...].aderencia        // .50 na neve, 1.00 na floresta...
```

`npm run sim` roda a corrida sem navegador e imprime tempos, tempo fora da pista e velocidade média — útil depois de mexer no traçado ou no equilíbrio dos itens.

## Colocar na internet

Sobe em qualquer VPS/Render/Railway como app Node comum (usa `process.env.PORT`). Com HTTPS, o QR aponta para o domínio automaticamente. Para um teste rápido de fora da rede: `ngrok http 3000` e abra o `/host` pela URL do ngrok — o QR passa a usar ela.
