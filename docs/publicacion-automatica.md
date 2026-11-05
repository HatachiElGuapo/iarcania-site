# Publicación automática: Postiz + Kits de reels (IArcanIA y Void Stoic)

Actualizado: 4 de noviembre de 2026 · Miguel

## Resumen

Metricool (límite de 20 reels al mes) quedó reemplazado por **Postiz autoalojado** en postiz.iarcania.com, sin límite. Dos copias del kit de edición editan los videos del celular y los programan solos: una para IArcanIA y otra para Void Stoic.

Flujo de trabajo:

1. Grabas con el celular y subes el video a **Drive › 1-Nuevos** de la marca.
2. En Claude Code, dentro de la carpeta del kit, dices «hay vídeos nuevos».
3. El kit transcribe, corta, subtitula, añade tarjetas o escenas, hace la portada y el texto del post.
4. En modo revisar te lo muestra; al aprobar lo programa en Postiz en el siguiente hueco libre.
5. Lo guarda en **Drive › 2-Editados** y la copia final en `listos/` con el nombre del video original.

| Pieza | Estado | Nota |
| --- | --- | --- |
| Postiz (servidor) | Funcionando | Instagram, Facebook y YouTube de ambas marcas conectados |
| TikTok en Postiz | Conectado en sandbox | Falta la revisión de producción de TikTok |
| Kit IArcanIA | Funcionando | 47 reels programados del 5 al 28 de noviembre |
| Kit Void Stoic | Configurado | Falta la prueba con un video real |
| Metricool | En retiro | Vaciar la cola de programados y archivar los viejos |

## Postiz autoalojado

Postiz corre en el servidor de casa con Docker y sale a internet por el Cloudflare Tunnel en **https://postiz.iarcania.com**. El registro de usuarios nuevos está desactivado.

| Elemento | Detalle |
| --- | --- |
| Carpeta en el servidor | `~/servidor/postiz/` (`docker-compose.yaml`) |
| Servicios | Postiz, Postgres, Redis, Temporal, Elasticsearch |
| Puerto local | `127.0.0.1:4007` (Temporal UI en `127.0.0.1:8088`) |
| Túnel | `/etc/cloudflared/config.yml` → `postiz.iarcania.com` a `http://localhost:4007` (copia: `config.yml.bak-postiz`) |
| Regla de Cloudflare | Page Rule `postiz.iarcania.com/api/public/*` con Browser Integrity Check apagado |
| API pública | `https://postiz.iarcania.com/api/public/v1`, clave en el header `Authorization` sin "Bearer" |

### Canales conectados

| Marca | Red | ID en Postiz |
| --- | --- | --- |
| IArcanIA | Instagram | `cmw05i5dr0007qm7xp7krp52p` |
| IArcanIA | Facebook (Iarcania AI) | `cmw059cmq0003qm7xyjcr403y` |
| IArcanIA | YouTube | `cmw03b58k0003nt7kthssrqrp` |
| IArcanIA | TikTok (iarcania.ai) | sin anotar |
| Void Stoic | Instagram | `cmw05cfre0005qm7xotyoh92p` |
| Void Stoic | Facebook | `cmw05731y0001qm7xvxy4lrdg` |
| Void Stoic | YouTube | `cmw038j7g0001nt7k0hzrwdck` |
| Void Stoic | TikTok (voidstoic.miguel) | sin anotar |

### Apps de conexión (OAuth)

| Plataforma | Estado | Pendiente |
| --- | --- | --- |
| Google (YouTube) | En producción, sin verificar | Los Shorts pueden subir privados hasta pasar la auditoría de la API |
| Meta (Facebook e Instagram) | App publicada (Live), app id `1106000788712296` | Nada |
| TikTok | Sandbox, dominio verificado | Video demo y revisión; en sandbox solo publica en cuentas privadas |
| LinkedIn | Bloqueado | Esperar a tener más conexiones |

Las páginas legales que piden estas apps están en iarcania.com: `privacidad.html` y `terminos.html` (repo `HatachiElGuapo/iarcania-site`).

## Kit IArcanIA

El kit original queda como el de IArcanIA en `~/Proyectos/kit edicion de videos profesional/`. Tiene 47 reels programados, 2 al día, del 5 al 28 de noviembre de 2026.

| Ajuste | Valor |
| --- | --- |
| Destinos | Instagram, Facebook y YouTube de IArcanIA |
| Drive | Cuenta de IArcanIA, carpetas 1-Nuevos y 2-Editados |
| Estilo | «IArcanIA»: Outfit, blanco-lila, caja morada, dorado en la palabra clave, zoom cada 3,5 s |
| Tarjetas | flujo / lista / cta con la marca, insertadas a mitad del reel cuando hay un proceso o una lista |
| Portada | Playfair Display, fondo `#060609`, título `#f0eeff`, palabra clave `#9b72f0`, detalle `#c9a84c` |
| Ritmo | 2 al día, 12:00 y 19:00 (±30 min), todos los días |
| Modo | Revisar (pasar a automático cuando confíes en la edición) |
| Texto del post | Cercano y práctico; CTA «Sígueme para más automatizaciones con IA»; 5 hashtags fijos |
| Generador de imágenes | Ninguno (Higgsfield descartado) |

### Archivos clave

- `motor/postiz.py`: reemplazo de Blotato. Sube video y portada, programa, mueve y quita posts. Lleva su registro en `datos/postiz-envios.json`.
- `motor/reel.py`: exporta el final a `listos/` como `<nombre original>.mp4`, `<nombre> - portada.jpg` y `<nombre> - texto.txt`.
- `.env.local`: `POSTIZ_API_URL` y `POSTIZ_API_KEY`.
- TikTok todavía no está soportado en `postiz.py` (lanza error si se pide).

### Video 50 pendiente

El video 50 promociona una clase en vivo «el sábado». Está editado en `trabajo/20261104-50-3ae1/` pero sin programar. Se programa 2 o 3 días antes de la próxima clase real.

## Kit Void Stoic

El kit de Void Stoic está en `~/Proyectos/kit void stoic/`. Es una copia del de IArcanIA hecha con `rsync`, sin `.venv`, `trabajo/`, `listos/`, `entrada/`, `secretos/` ni el registro de envíos, para que no herede nada de IArcanIA.

| Ajuste | Valor |
| --- | --- |
| Instagram | `miguelaguilar.voidstoic` |
| Destinos | Instagram, Facebook y YouTube de Void Stoic |
| Drive | Cuenta personal, carpeta «Reels en automático» › 1-Nuevos y 2-Editados |
| Estilo | Sobrio, hueso y dorado, estética del logo Eclipse (sin morado) |
| Portada | Mismos colores sobrios |
| Ritmo | 1 al día a las 20:00 (±30 min), todos los días |
| Modo | Revisar |
| Texto del post | Sereno y directo, de maestro cercano; hashtags #estoicismo #voidstoic #filosofia #disciplina #mementomori |
| Zona horaria | America/Bogota |

### Escenas automáticas

En cada reel, sin pedirlo, el kit inserta imágenes a pantalla completa entre las tomas de cámara.

1. Detecta el tema: libro, película, serie, anime, videojuego, filósofo o idea.
2. Elige momentos clave, una escena cada 6-10 s, de 2-4 s cada una. Nunca en el gancho ni en el cierre.
3. Filósofos, clásicos o historia: busca primero **arte de dominio público en Wikimedia Commons**.
4. Películas, series, anime, videojuegos o lo que no tenga arte: **genera con Cloudflare Workers AI (FLUX schnell)**, evocando la historia sin personajes reconocibles ni logos.
5. Rellena a 1080×1920 con fondo desenfocado (sin estirar), fundido de entrada y salida y zoom lento **Ken Burns** de 100% a 110%, alternando dirección.
6. Tope de **10 imágenes generadas por reel**. Las guarda en la carpeta del reel para no regenerarlas.
7. En modo revisar muestra la lista de escenas antes de montar.

### Archivos clave

- `motor/escenas.py`: generación con Cloudflare y búsqueda en Wikimedia Commons.
- `motor/componer.py`: insertos con fundido y Ken Burns.
- `config/estilo.json`, `config/portada.json`, `config/ajustes.json`: estilo, portada, ritmo y texto.
- `.claude/skills/editar-reels/referencias/escenas.md` y el paso «c-bis» del `SKILL.md`.
- Higgsfield quedó descartado y fuera del kit.

## Credenciales

Ninguna clave se escribe en el chat ni en este documento. Se editan a mano con `nano` en el archivo correspondiente.

| Credencial | Dónde vive |
| --- | --- |
| Claves OAuth de YouTube, Facebook y TikTok | `~/servidor/postiz/docker-compose.yaml` (servidor) |
| `POSTIZ_API_URL`, `POSTIZ_API_KEY` | `.env.local` de cada kit (la misma clave sirve para las dos marcas) |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` | `.env.local` del kit Void Stoic |
| Conexión a Drive | `secretos/` de cada kit (cuenta distinta por marca) |

El token de Cloudflare válido es un token de **usuario** con permiso Workers AI y empieza por `cfut_`. Se verifica en `/client/v4/user/tokens/verify`, no en la ruta de tokens de cuenta. En Cloudflare quedaron tokens de prueba sin usar que se pueden borrar desde **Mi perfil › API Tokens**; el bueno es el de id `2203ee0a…`.

## Problemas resueltos

| Problema | Causa | Solución |
| --- | --- | --- |
| Puerto 8080 ocupado | Temporal UI chocaba con otro servicio | Mover Temporal UI a `127.0.0.1:8088` |
| `docker pull` con «unexpected EOF» | Red lenta | Reintentos con `COMPOSE_PARALLEL_LIMIT=1` |
| Meta: «Invalid Scopes: pages_read_user_content» | Permiso faltante en la app | Agregar ese permiso |
| «Invalid Redirect URI» (TikTok, Cloudflare) | Caracteres invisibles al pegar | Escribir la URL a mano |
| TikTok: errores de scope | Faltaban permisos | Agregar `user.info.profile`, `user.info.stats`, `video.list` |
| TikTok: `server_error` (ticket `bfd377ff1d8514a7`) | Sesión y cookies viejas | Borrar cookies, ventana privada y verificación de identidad |
| Firefox en bucle con `bytedance://` | Manejador de enlaces de la app | Configurarlo en «no hacer nada» y borrar cookies |
| Error 1010 de Cloudflare en la API | Browser Integrity Check bloquea scripts | Header `User-Agent` en el kit + Page Rule con BIC apagado |
| El kit no arrancaba | Faltaba `.venv` | `/setup` lo crea de nuevo |
| Token de Cloudflare inválido | Se pegó el comando `curl` de ejemplo en vez del token | Copiar el valor que empieza por `cfut_` |

## Pendientes

Ordenados por lo que más acerca a ingresos.

- [ ] Ponerle fecha a la próxima clase en vivo y programar el video 50 dos o tres días antes
- [ ] Vaciar la cola de programados en Metricool (sin desconectar las cuentas)
- [ ] Archivar en Instagram y borrar en Facebook y YouTube los reels viejos que se van a repetir
- [ ] Revisar el primer reel publicado por Postiz (5 de noviembre): público en las tres redes y YouTube como Short
- [ ] Probar el kit de Void Stoic con un video real (escenas, Ken Burns y portada)
- [ ] Pasar el kit de IArcanIA a modo automático cuando la edición convenza
- [ ] TikTok: grabar el video demo, pedir los permisos de producción y responder al ticket de soporte
- [ ] Añadir TikTok a `motor/postiz.py`
- [ ] Configurar copias de seguridad de Postiz
- [ ] Conectar Luna Angelical y Memoria Vintage en Postiz e integrar memoriavintage.com con la API
- [ ] Borrar los tokens de Cloudflare sobrantes
- [ ] LinkedIn cuando haya más conexiones
