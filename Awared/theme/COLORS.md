# Awared — Paleta de Cores

Cores oficiais retiradas de `theme/theme.ts` e `tailwind.config.js`.

---

## 🎨 Cores da app (light mode)

| Papel | Cor | Hex |
|---|---|---|
| **Fundo (bege)** | cream / app background | `#F5F1EA` *(tailwind: `#F9F6F0`)* |
| **Cards / painéis** | panel | `#FAF6EF` |
| **Roxo geral (accent)** | purple | `#9B82C9` |
| **Roxo mais forte** | purpleDeep | `#7E64B3` |
| **Roxo tint (fundo suave)** | purpleSoft | `rgba(155,130,201,0.14)` |
| **Texto principal (tinta)** | ink | `#1F1B16` |
| **Texto secundário** | inkSoft | `#5E574E` |
| **Texto terciário / hint** | inkMute | `#9C9489` |
| **Verde (sucesso)** | green | `#5F7A4F` |
| **Vermelho (perigo)** | danger | `#C24A3A` |

### Dark mode

| Papel | Hex |
|---|---|
| Fundo | `#15120E` |
| Painel | `#211B15` |
| Roxo | `#B9A3E3` |
| Roxo forte | `#C7B2EE` |
| Texto | `#F2ECE1` |
| Verde | `#8FAE78` |
| Vermelho | `#E8705C` |

---

## 🌈 Cores das 8 emoções

| Emoção | Cor | Hex (principal) | Versão clara |
|---|---|---|---|
| 😢 **Sadness** | azul | `#4A7FA5` | `#C5DCED` |
| 😤 **Stress** | laranja | `#E87040` | `#FADDD0` |
| 😊 **Happy** | dourado | `#D4A017` | `#F5E6B0` |
| 😰 **Anxiety** | verde-água | `#3AACA0` | `#B8E4E0` |
| 😌 **Calm** | verde | `#4E9B6F` | `#C0E2CE` |
| 😡 **Anger** | vermelho | `#C0392B` | `#F5C0BB` |
| 😑 **Boredom** | roxo | `#7B5EA7` | `#DCCFF0` |
| 🤩 **Excited** | rosa | `#E05A8A` | `#F9C9DC` |

---

## Notas (cores)

- O **bege de fundo** aparece em dois tons consoante a fonte: `#F5F1EA` no sistema de tema (`theme.ts`, que controla os ecrãs) e `#F9F6F0` (`cream`) no `tailwind.config.js`.
- O **roxo accent** é o mesmo conceito mas com hexes ligeiramente diferentes entre as duas fontes (`#9B82C9` em `theme.ts`).
- As cores das emoções **não mudam** entre light/dark — são semânticas e fixas.
- Paleta "editorial" de base no tailwind: `ivory #FFFDF7`, `parchment #EDE8DF`, `ink #1A1612`.

---

## 🔤 Tipografia

Quatro famílias Google Fonts, carregadas em `app/_layout.tsx`. Estilo geral: **editorial** — serifa elegante (Playfair) para títulos e momentos emocionais, sans-serif (Manrope) para UI e dados.

| Família | Uso principal | Pesos / estilos usados |
|---|---|---|
| **Playfair Display** (serif) | Títulos, headings, frases emocionais — sobretudo em *itálico* | `400 Regular`, `400 Italic`, `700 Bold`, `700 Bold Italic` |
| **Manrope** (sans-serif) | UI geral, labels, navegação, números/dados | `400 Regular`, `500 Medium`, `600 SemiBold`, `700 Bold` |
| **Roboto Serif** (serif) | Ecrãs de formulário (add purchase, budget) — corpo e valores | `400 Regular`, `500 Medium`, `600 SemiBold`, `700 Bold` |
| **Libre Caslon Text** (serif) | Acentos editoriais / destaques pontuais | `400 Regular`, `700 Bold` |

### Hierarquia típica

- **Títulos / display** → `Playfair Display` (frequentemente *italic* — ex.: títulos de secção, datas no calendário)
- **Texto de interface / botões / tabs** → `Manrope` (`600 SemiBold` / `700 Bold`)
- **Formulários e valores monetários** → `Roboto Serif`
- **Realces editoriais** → `Libre Caslon Text`

> Nota: o `CLAUDE.md` do projeto menciona Playfair como serif italic para títulos; na prática a app usa as 4 famílias acima.
