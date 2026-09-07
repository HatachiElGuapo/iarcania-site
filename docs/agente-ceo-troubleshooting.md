# Agente CEO (WhatsApp + n8n) — Diagnóstico y fix del 30 de agosto 2026

Runbook de los problemas encontrados al poner en marcha el bot de WhatsApp "Agente CEO Miguel" tras recrear el contenedor de n8n. Guardar como referencia para cuando se replique este mismo setup (otros clientes de IArcanIA, otros agentes).

## Arquitectura

- **n8n**: contenedor `familyos_n8n`, workflow "Agente CEO Miguel" (ID `4fYucjABu4X7Qk2S`), activo.
- **Evolution API**: contenedor `familyos_evolution`, instancia `agente-ceo-miguel`, vinculada al número de WhatsApp **+57 324 251 0915**. El número de un usuario que le escribe (ej. Miguel) es distinto — no confundirlos.
- **Postgres**: contenedor `postgres_personal`, un solo servidor con varias bases de datos independientes:
  - `postgres` — base por defecto, vacía de datos de app.
  - `familyos` — **base interna de n8n** (sus propios workflows, usuarios del editor, etc.). No es para datos de la aplicación.
  - `iarcania` — base real de la app (iarcania.com / Family OS): usuarios, tareas, finanzas, proyectos, etc. **Esta es la que usa el bot.**
  - `memoria_vintage`, `kagayakashi_mirai`, `luna_angelical` — otros proyectos, no relacionados.
- Credencial de n8n **"Postgres account"** (usada en 4 nodos, incluido "Resolver Usuario") → conecta a `host: postgres`, `database: iarcania`.
- Credencial **"Postgres account 2"** → es de Memoria Vintage, no tocar para este bot.

## Flujo del workflow

```
Webhook Evolution API → Extraer Datos Entrantes → Resolver Usuario (Postgres)
  → ¿Usuario Autorizado? → Inyectar Contexto Usuario → AI Agent (GPT-4o + MCP iarcania)
  → Formatear Respuesta Agente → Evolution API - Enviar Respuesta
```

## Problemas encontrados y solución

### 1. Confusión de bases de datos
El servidor Postgres tiene varias bases con nombres parecidos. Se perdió tiempo revisando la tabla `"user"` en `familyos` (la interna de n8n) pensando que era la de la app, cuando la credencial del nodo en realidad apuntaba a `iarcania`.

**Lección:** antes de tocar cualquier tabla, ir a *Credentials → [nombre de la credencial] → campo Database* en n8n y confirmar exactamente a qué base apunta ese nodo. No asumir por el nombre del contenedor.

### 2. Formato de teléfono inconsistente
La tabla `"user"` de `iarcania` guarda `whatsapp_phone` en formato E.164 con "+" (`+573006709840`), pero el número que llega del webhook de WhatsApp (extraído de `remoteJid.split('@')[0]`) viene sin "+" (`573006709840`). La comparación directa nunca hacía match, así que ningún usuario se reconocía como autorizado.

**Fix aplicado** en el nodo "Resolver Usuario":
```sql
SELECT id FROM "user" WHERE regexp_replace(whatsapp_phone, '\+', '', 'g') = $1
```

**Lección:** al replicar, decidir un formato único de teléfono (recomendado: siempre con "+", E.164) y normalizarlo en un solo punto — idealmente al guardar el dato — en vez de parchar cada query.

### 3. Flujo se detiene en silencio si no encuentra el usuario
Si "Resolver Usuario" no encuentra ninguna fila (0 resultados), el nodo termina en "Success" pero sin ítems de salida — y como no hay ítems, el flujo simplemente no continúa hacia "¿Usuario Autorizado?" ni hacia el mensaje de "no autorizado". El bot se queda callado, sin avisar nada.

**Pendiente / recomendado:** activar "Always Output Data" en la pestaña Settings del nodo Postgres, para que un resultado vacío no bloquee el flujo y el bot pueda responder algo como "no tienes acceso" en vez de silencio total.

### 4. Falsa alarma con `$env` ("access to env vars denied")
Tras recrear el contenedor de n8n, quedó pegada en la interfaz una notificación de error sobre el nodo "Evolution API - Enviar Respuesta". Resultó ser una notificación vieja del navegador — las variables de entorno (`$env.EVOLUTION_API_URL`, `$env.EVOLUTION_INSTANCE`) sí se resuelven bien en ejecución real.

**Lección:** no asumir que una notificación en pantalla refleja el estado actual — confirmar siempre con una ejecución fresca (`Executions` → última entrada → revisar si dice "Succeeded").

### 5. Pruebas a un número equivocado
Al inicio se mandaron varios mensajes de prueba a un número de WhatsApp que no era el vinculado a la instancia de Evolution API, lo cual hizo parecer que el workflow no recibía nada.

**Lección:** confirmar el número de la instancia antes de probar:
```bash
docker logs familyos_evolution | grep wuid
```

## Checklist para replicar sin repetir errores

1. Confirmar el número de WhatsApp vinculado a la instancia de Evolution API antes de cualquier prueba.
2. Verificar que el nodo Webhook use la **Production URL** (`/webhook/...`), no la Test URL (`/webhook-test/...`).
3. Confirmar en la credencial exacta (no por nombre del contenedor) a qué base de datos apunta cada nodo Postgres.
4. Definir y documentar un formato único de teléfono (recomendado: siempre "+", E.164) desde el inicio, en la escritura y en la lectura.
5. Activar "Always Output Data" en nodos de consulta que forman parte de un flujo de decisión/autorización.
6. Probar siempre con un mensaje real de WhatsApp de punta a punta después de cualquier cambio — no confiar en ejecuciones viejas de la lista.
7. Rotar cualquier credencial (apikey, contraseña) que haya quedado expuesta en texto plano durante el debugging.

## Nota de seguridad

Durante este debugging quedaron expuestas en texto plano: el `apikey` de Evolution API y la contraseña del usuario Postgres `admin`. Rotarlas cuando haya oportunidad.

## Fixes del 1 de septiembre 2026

### 6. `create_task` fallaba de forma intermitente pese al cast `$7::boolean`
Causa: el campo "Query Parameters" del nodo Postgres armaba la lista de parámetros uniendo texto con comas — formato frágil que perdía un parámetro al azar en algunas ejecuciones.

**Fix aplicado:** reescribir el campo como un arreglo real de JS en vez de texto concatenado:
```js
[ $fromAI('titulo'), $fromAI('descripcion'), $fromAI('fecha'), ... ]
```

**Lección:** en nodos Postgres de n8n, preferir siempre el modo de arreglo real para "Query Parameters" en vez de escribir la lista como texto separado por comas — el texto es propenso a perder o desalinear parámetros silenciosamente.

### 7. El AI Agent confirmaba "tarea creada" (✅) sin haber llamado la tool
Ocurría específicamente cuando el pedido incluía una hora concreta (ej. "recuérdame algo a las 7 de la noche") — la tabla `tasks` solo tiene `due_date` (fecha, sin hora), así que el agente "alucinaba" el éxito en vez de manejar el caso correctamente.

**Fix aplicado:** se agregó al system prompt del agente:
- **REGLA CRÍTICA #2**: nunca usar lenguaje de acción completada (✅, "listo", "creada") sin haber recibido una respuesta exitosa real de la tool.
- Sección **"TAREAS CON HORA"**: la fecha va en `due_date`, la hora (si el usuario la da) va en `notes` como texto, y si hay ambigüedad, el agente debe preguntar si el usuario quiere una tarea o un recordatorio.

**Lección:** cuando el schema de una tabla no soporta un campo que el usuario menciona naturalmente (como la hora), es mejor instruir explícitamente al agente sobre dónde debe ir ese dato (y cuándo preguntar) que confiar en que infiera el comportamiento correcto por su cuenta.

**Confirmado:** tarea de prueba con hora específica se guardó correctamente (`due_date` solo con fecha, `notes` con "Hora: 8:00 pm"), verificado por consulta directa a la tabla.
