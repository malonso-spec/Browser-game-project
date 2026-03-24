# Rock Mystery Fest — Browser Game

## Qué es
Browser game de combate por turnos con temática rock. El jugador lucha contra "Beer Provider" usando un sistema de cartas. Desarrollado con vanilla JavaScript, Canvas API para animaciones y Vite como bundler.

## Repositorio
https://github.com/malonso-spec/Browser-game-project

## Stack técnico
- HTML5 + CSS3 + Vanilla JavaScript (sin frameworks)
- Canvas API para sprites animados (24fps)
- Vite 7.3.1 como bundler
- Deploy en GitHub Pages vía GitHub Actions
- Sin backend actualmente (Firebase Firestore pendiente)

## Estructura del proyecto
```
├── index.html          → Estructura HTML + carga de scripts
├── css/styles.css      → Estilos (responsive, DVH units)
├── js/
│   ├── config.js       → Constantes: cartas, daños, probabilidades
│   ├── game.js         → Lógica del juego: turnos, HP, estados
│   └── ui.js           → DOM, animaciones, sprites, audio
├── assets/             → Sprites, videos, audio, imágenes de cartas
└── package.json        → Scripts: dev, build, preview
```

## Sistema de combate

### Cartas del jugador (5):
- **Stunning Dance x2** (A1, A2) — Ataque básico: 25p de daño
- **Rock Invocation** (CRIT) — Crítico: ciclo 30→40→50p, se resetea al usarla
- **Bubble Gum** (R) — Cura 25 HP + escudo (reduce siguiente golpe a 10p). Un solo uso
- **Food** (F) — Cura estado Drunk. Sin efecto si no estás drunk

### Ataques del bot (3 tipos):
- **Normal** — 25p de daño (default)
- **Heavy** — 50p de daño. Una sola vez por partida. 33% chance (T1-T3), 40% (T4+)
- **Blocked** — 10p si el jugador tiene escudo activo

### Mecánica Drunk:
- Se acumulan hits consecutivos sin escudo
- Probabilidad escalonada: 33% (1er hit) → 66% (2º) → 100% (3º)
- En T1-T3: mutuamente excluyente con Heavy (solo uno puede ocurrir)
- En T4+: independiente de Heavy
- Efecto: ataques del jugador hacen 50% de daño
- Cura: usar carta Food

### Datos disponibles al final de partida:
- `playerName` — nombre del jugador
- `game.playerHP` — HP restante (≤0 = derrota)
- `game.enemyHP` — HP del enemigo (≤0 = victoria)
- `game.turn` — turnos totales jugados
- `win` (boolean) — victoria o derrota

## Flujo del juego
1. Pantalla de título → Start
2. Input de nombre (máx 16 chars)
3. Video intro (con opción de skip/pausa)
4. Tutorial interactivo (3 pasos)
5. Arena de combate (sprites animados en canvas)
6. Pantalla de resultado (win/lose)
7. Video outro (con opción de replay)

## Estado actual y roadmap

### Completado:
- Sistema de combate completo con 5 cartas
- Animaciones de sprites por canvas (13 sets de animación)
- Flujo completo: título → nombre → intro → tutorial → batalla → resultado → outro
- Audio: música de fondo, SFX por acción, audio en videos
- Deploy en GitHub Pages via GitHub Actions
- Diseño responsive

### En progreso:
- Integración con Firebase Firestore para ranking/leaderboard
- Acceso a Firebase solicitado a SRE (rol projectCreator)

### Pendiente:
- Crear proyecto Firebase "Rock Mystery Fest"
- Activar Firestore (europe-west1)
- Archivo `js/firebase.js` con funciones saveScore() y getLeaderboard()
- Fórmula de puntuación: HP restante × 10 + bonus por menos turnos
- Pantalla de ranking (top 10)
- Reglas de seguridad en Firestore (solo escritura nueva, lectura pública)

## Convenciones de código
- Sin TypeScript, todo vanilla JS
- Variables de estado del juego en objeto `game` global (game.js)
- Helper `$()` = `document.getElementById` (ui.js)
- Animaciones basadas en sprites con requestAnimationFrame
- Orden de carga de scripts: config.js → ui.js → game.js
- Preload de assets en dos fases: críticos primero, combate en background
- ImageBitmap pre-decoding para animaciones fluidas
