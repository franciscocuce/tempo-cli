# tempo

[![CI](https://github.com/franciscocuce/tempo-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/franciscocuce/tempo-cli/actions/workflows/ci.yml)

Mi portfolio se cayó un jueves y me enteré el sábado, porque entré yo. Dos días de una URL rota en un
CV que había mandado esa misma semana.

**`tempo` es un monitor de uptime self-hosted.** Chequea que tus sitios estén vivos, te avisa por
Discord cuando se caen, y publica un status page que podés enlazar. Corre en un contenedor, guarda
todo en un archivo SQLite y el motor que agenda los chequeos está **escrito desde cero**.

## Qué hace

- **Chequea sitios** cada tanto, con la frecuencia que le pongas en formato cron.
- **Verifica que funcione, no solo que responda.** Además del código de estado —que acepta `200`,
  `2xx`, `200-299` o listas—, puede buscar una palabra en la respuesta. Un 200 que devuelve la
  pantalla de error de tu framework es una caída que un chequeo de status no ve.
- **No alerta por un hipo de red.** Hacen falta N fallos seguidos (configurable) para declarar un
  sitio caído y abrir un incidente.
- **Avisa por Discord** al caer y al recuperarse, con cuánto duró la caída.
- **Vigila el certificado TLS** y avisa antes de que venza.
- **Calcula disponibilidad**: uptime de 24 h, 7 y 30 días, latencia p50 y p95, y una barra de 90 días.
- **Publica un status page** en `/status`, sin login, que no filtra ni las URLs que vigilás.
- **Se maneja desde la terminal o desde el navegador**, sobre la misma base.

## Arrancarlo

```bash
cp .env.example .env
# generá la clave y pegala en TEMPO_SECRET_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

docker compose up -d
```

Abrí `http://localhost:3000`. El primer arranque imprime en la consola un **token de un solo uso**
para crear el primer usuario:

```bash
docker compose logs | grep -A2 "token"
```

No hay contraseña por defecto, ni la va a haber.

<details>
<summary>Sin Docker</summary>

```bash
npm install
export TEMPO_SECRET_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npm run web          # compila el dashboard y levanta todo en :3000
```

</details>

## Desde la terminal

```bash
tempo add --name portfolio --url https://franciscocuce.dev --cron "*/5 * * * *"
tempo add --name blog --url https://ejemplo.com --cron "0 * * * *" --keyword "Bienvenido"

tempo list                    # estado, uptime y próximo chequeo de cada uno
tempo check 1                 # chequear uno ahora mismo
tempo incidents --open        # las caídas sin resolver
tempo history --monitor 1

tempo channel add --label "mi server" --url "https://discord.com/api/webhooks/..."
tempo channel test 1

tempo backup ~/backups/       # copia en caliente, sin parar nada
tempo restore ~/backups/tempo-2026-08-24.db
```

## Comparado con otras opciones

Honestamente: si solo querés que alguien te avise cuando se cae tu sitio, **usá UptimeRobot y listo**.
`tempo` tiene sentido si querés que los datos sean tuyos o si te interesa cómo está hecho por dentro.

| | cron + curl | UptimeRobot (gratis) | Uptime Kuma | tempo |
|---|---|---|---|---|
| Instalar algo | no | no | sí | sí |
| Frecuencia mínima | la que quieras | 5 min | la que quieras | la que quieras |
| Historial y uptime % | lo hacés vos | 3 meses | sí | sí (90 días) |
| Status page | no | sí (de pago) | sí | sí |
| Incidentes con confirmación | no | sí | sí | sí |
| Vencimiento del certificado | no | sí | sí | sí |
| Tus datos en tu máquina | sí | no | sí | sí |
| Integraciones de aviso | las que escribas | muchas | 90+ | solo Discord |
| Madurez | — | producto | proyecto grande y probado | proyecto personal |

**Uptime Kuma hace todo lo que hace `tempo` y bastante más.** Si buscás una herramienta para usar en
serio, es la opción. `tempo` existe porque quería construir el motor, no porque el mundo necesitara
otro monitor.

## Seguridad

Esta sección está porque **la versión anterior de este proyecto tenía un agujero grave**, y cómo se
resolvió dice más del proyecto que la lista de funcionalidades.

### El agujero que había

`tempo` empezó siendo un scheduler que ejecutaba tareas, incluidas las de tipo `shell`. Con una API
REST sin autenticación, eso era ejecución remota de comandos:

```
POST /api/tasks        { "type": "shell", "command": "lo que sea" }
POST /api/tasks/1/run
```

Dos peticiones y quien las mandara corría cualquier comando en la máquina. Sin contraseña, porque no
había. Y el servidor escuchaba en `0.0.0.0`: cualquiera en la misma red.

Cada pieza por separado era razonable —ejecutar comandos es lo que hace un scheduler, una API para
manejarlo es lo natural—. **El agujero aparecía en la combinación**, que es justamente el que no se
ve leyendo un archivo a la vez.

**No se aseguró: se eliminó.** Un monitor de uptime no necesita ejecutar comandos, así que el
executor de shell se borró junto con su tipo, su validación y sus endpoints. Cuando una funcionalidad
peligrosa no aporta al caso de uso, la respuesta no es blindarla.

### Lo que hay hoy

- **Argon2id** para las contraseñas. Los tokens de sesión se guardan **hasheados**: leer la base no
  alcanza para hacerse pasar por nadie.
- **Sin contraseña por defecto.** El primer usuario se crea con un token de un solo uso que se
  imprime en la consola y vive en memoria.
- **Cookie `httpOnly`, `SameSite=Lax`, `Secure` en producción**, con rotación al iniciar sesión.
- **CSRF por doble envío**, validado en todo `POST`/`PATCH`/`DELETE`, con comparación de tiempo
  constante.
- **Rate limiting**: 5 intentos de login cada 15 minutos, 300 peticiones por minuto en el resto.
- **Guard anti-SSRF.** Un monitor es una máquina que hace peticiones a donde le digas, así que se
  resuelve el DNS de cada destino y se rechazan loopback, redes privadas, link-local
  —`169.254.169.254` es la metadata de AWS/GCP/Azure y devuelve credenciales sin pedir nada— y sus
  equivalentes en IPv6, incluidas las IPv4 disfrazadas (`::ffff:127.0.0.1`). Se revalida en **cada
  redirección**, porque un servidor honesto puede contestar un 302 hacia adentro.
- **Los chequeos no guardan el cuerpo de la respuesta**, solo status, latencia y si la keyword
  matcheó. Guardarlo sería un mecanismo de exfiltración.
- **El webhook de Discord se cifra** con AES-256-GCM y la API nunca lo devuelve entero: lo enmascara.
- **`helmet` con CSP real** (el build no necesita scripts inline, y las tipografías son del sistema:
  cero requests externos), body limit de 16 kB y tope en los listados.
- **Bind a `127.0.0.1` por defecto.** Exponerlo a la red es una decisión explícita.

### Lo que no cubre

- **No hay multi-tenancy.** Todos los usuarios ven y editan todos los monitores. Es
  [una decisión](docs/decisiones.md#3-una-instancia-varios-usuarios-monitores-compartidos), no un
  olvido: está pensado para una instancia personal o de equipo chico.
- **No hay tope de monitores por usuario.** No exponer el registro a internet abierta sin pensarlo:
  ver [hosting.md](docs/hosting.md).
- **No hace TLS.** Poné un reverse proxy adelante.

## Cómo está hecho

Node.js · TypeScript · SQLite (`better-sqlite3`) · Express · zod · vitest · React + Vite + Tailwind v4

```
src/cron/        el motor cron, escrito a mano
src/checks/      chequeo HTTP, guard anti-SSRF, lectura del certificado
src/incidents/   cuándo se abre y se cierra una caída
src/scheduler/   el loop, el lock de instancia única, el runner
src/store/       todo el SQL, una función por operación
src/api/         Express: rutas, sesión, CSRF, SSE, status público
src/commands/    un archivo por comando del CLI
dashboard/       React + Vite, gráficos en SVG a mano
```

Tres cosas que quizás te interesen:

- **El motor cron es propio.** Parsea los cinco campos con `*`, listas, rangos y pasos, y resuelve la
  regla incómoda de "día del mes **o** día de la semana". No usa librería de cron.
- **El scheduler está endurecido**: no solapa chequeos del mismo monitor, limita la concurrencia,
  desparrama los disparos con jitter, y un lock en SQLite impide que dos daemons vigilen la misma base.
- **Los gráficos son SVG escrito a mano**, sin librería de charts.

**Si querés entender cómo funciona por dentro**, está todo explicado con calma en
[RECORRIDO.md](RECORRIDO.md) — desde cómo se expanden las expresiones cron hasta por qué el estado de
los incidentes se deriva de la base y no de memoria. Las decisiones de arquitectura y sus
alternativas están en [docs/decisiones.md](docs/decisiones.md).

## Desarrollo

```bash
npm test              # 268 tests
npm run lint
npm run typecheck
npm run serve         # API en :3000
npm run dashboard:dev # Vite con recarga en caliente, proxy a la API
```

## Licencia

MIT — ver [LICENSE](LICENSE).
