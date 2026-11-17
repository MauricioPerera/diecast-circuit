# Diecast Circuit

Juego de carreras 3D jugable en el navegador, construido con Three.js. Cinco circuitos elevados, loops verticales, nitro, tres niveles de asistencia y récords locales por circuito/asistencia. Menú, sonido de motor, cuenta atrás, minimapa, pausa, fallo y reinicio. Interfaz en español y controles táctiles.

## Ejecutar

Desde esta carpeta:

```powershell
npm ci
npm run dev
```

Abre la dirección que imprime Vite (por defecto `http://127.0.0.1:5188/`). Para generar y servir la versión de producción:

```powershell
npm run build
npm run preview
```

El contenido de `dist/` se puede servir en un hosting estático, incluso bajo una subcarpeta. La contrarreloj funciona con los recursos incluidos y un navegador con WebGL 2. El modo en línea usa el servidor de salas descrito abajo.

## Multijugador por invitación

En el menú, abre **Multijugador**, escribe un apodo y pulsa **Crear sala**. Comparte el código de seis caracteres o el enlace de invitación. El anfitrión puede invitar hasta a siete pilotos, elegir uno de los cinco circuitos del juego y fijar la asistencia. Los invitados confirman que están listos y el anfitrión inicia la carrera. Cada piloto lleva el coche que seleccionó en el garaje.

Las salas nuevas tienen **Objetos en pista** activados. Pasa por una caja turquesa para recoger un objeto aleatorio. Puedes guardar uno y usarlo con **E** o con el botón **Usar objeto** en la pantalla. Las cajas vuelven a aparecer al cabo de unos segundos.

- **Disco**. Sale hacia delante por tu carril. Alinea el coche con el rival antes de disparar.
- **Trampa**. Queda detrás de ti y frena al primer rival que la pise.
- **Escudo**. Absorbe un impacto mientras está activo.

La sala sincroniza la salida, retransmite la posición de los coches y ordena los tiempos al terminar. Es una carrera casual con física local y coches que se pueden atravesar. Si un piloto abandona o se le acaba el tiempo, aparece como **No terminó**. La revancha conserva el mismo código.

Para jugar en este equipo, abre una segunda terminal en `racing` y arranca el servidor local con Wrangler 4 (`npm exec --package=wrangler@4.103.0 -- wrangler dev --local --ip 127.0.0.1 --port 8787` si no está instalado):

```powershell
npm run rooms:dev
```

Abre el juego en dos ventanas del navegador e invita a la segunda. `npm run test:online` prueba la sala con el juego compilado en el puerto 5189 y el Worker en el 8787.

## Publicar para jugar por Internet

1. Usa esta carpeta (`racing`) como raíz del repositorio del juego. La compilación genera enlaces relativos compatibles con páginas bajo `/<repositorio>/`.
2. Inicia sesión en Cloudflare con `wrangler login` y ejecuta `wrangler deploy` desde `racing`. La configuración crea el Durable Object SQLite de las salas y Wrangler imprime la URL HTTPS del Worker. Puedes restringir el origen de las conexiones configurando `ROOM_ORIGINS` con el origen de tu sitio (por ejemplo, `https://mi-usuario.github.io`).
3. En GitHub, selecciona **GitHub Actions** como fuente en **Settings → Pages** y crea la variable de repositorio `ROOM_SERVER` con esa URL HTTPS. La compilación usa esa variable como `VITE_ROOM_SERVER`.
4. Ejecuta **Publicar Diecast Circuit** en la pestaña **Actions**. El flujo comprueba `/health`, corre las pruebas, compila y publica `dist/`. Comparte el sitio público. Las invitaciones usan su URL y conservan la subruta del repositorio.

[Publicación en GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) · [WebSockets en Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)

## Controles

| Acción | Teclado |
|---|---|
| Acelerar | W / ↑ |
| Frenar | S / ↓ |
| Dirección | A y D / ← y → |
| Nitro | Shift / Espacio |
| Usar objeto en línea | E |
| Cambiar cámara | C |
| Pausa / continuar | Esc |
| Reintentar | R |

En móvil se muestran botones de dirección, gas, freno y nitro. La reserva de nitro se consume al mantenerlo y se recarga al soltarlo. La asistencia **Completa** centra el coche en los tramos con barandas. **Equilibrada** frena automáticamente y **Manual** te da todo el control.

Las marcas amarillas señalan los bordes abiertos. Frena antes de esas curvas y corrige la dirección. En los saltos, el aviso del tablero indica el lado de la recepción y la velocidad mínima. Alinea el coche antes de despegar y usa nitro en la aproximación si te falta impulso. Una caída termina el intento. Completa una vuelta para guardar tu récord en este navegador.

## Construir tu propia pista

En el menú, pulsa **Construir mi pista** para abrir el taller. Puedes partir del ejemplo o pulsar **Nueva** para empezar con una recta de salida.

1. Selecciona una pieza del recorrido y añade rectas, curvas, rampas, saltos, curvas abiertas o loops. Las piezas nuevas se insertan después de la seleccionada. Puedes ajustar el hueco del salto y el radio de la curva sin barandas.
2. Ajusta la pieza con sus controles, cambia el ancho o reordena/quita piezas. **Deshacer** y **Rehacer** permiten experimentar. Arrastra la vista 3D para girar, usa la rueda para acercar o pulsa **Planta** para inspeccionar el recorrido.
3. Pulsa **Cerrar circuito** para generar el tramo de regreso. Si hay cruces, falta de espacio o una salida demasiado corta, el taller explica qué corregir. **Probar pista** se habilita al validar una pista cerrada.
4. Ponle un nombre y pulsa **Guardar**. La biblioteca conserva hasta 12 pistas en este navegador; puedes cargarlas, actualizarlas o borrarlas. El borrador también se conserva automáticamente.
5. **Probar pista** inicia una contrarreloj con la asistencia elegida en el menú. Desde pausa o al terminar, **Volver al taller** te devuelve al diseño. Los récords se identifican por la geometría: cambiar el trazado o el ancho crea un récord independiente.

El taller admite hasta 32 piezas por pista. Los loops requieren una recta inicial de al menos 24 m para coger impulso. Las rampas regresan a la altura inicial y los loops conservan una separación entre entrada y salida. La vista y los controles se adaptan a pantallas táctiles. Las pistas y récords son locales; no se suben a un servidor.

## Garaje y coches combinados

Abre **Garaje** desde el menú. Incluye cuatro modelos originales: GT, muscle, rally y prototipo. Elige un coche completo o combina su **carrocería, cabina, ruedas, alerón y escape** con las piezas de otros modelos. Los cambios se ven en el coche 3D; puedes girarlo y examinarlo desde distintas vistas.

Las piezas cambian de forma moderada la aceleración, velocidad, agarre, frenado y nitro. Las barras del garaje permiten comparar el resultado. Puedes cambiar la pintura y el acento, poner nombre a tu mezcla y guardar hasta 12 diseños en la biblioteca local. **Usar coche** aplica el diseño para las carreras normales y para tus propias pistas; **Volver** cancela los cambios sin aplicar.

Los récords se separan por combinación de piezas y asistencia. Cambiar solo nombre o pintura conserva los tiempos. Los récords del GT original se conservan al actualizar. Tus diseños se guardan en el navegador. En las salas se comparte la configuración del coche activo con los otros pilotos.

## Uso real de las herramientas solicitadas

- [CADCraft](https://github.com/storytold/cadcraft): generó `craft/start-gantry.dxf`; un script lee sus polilíneas y convierte las medidas a `public/assets/cad-track.json`. Three.js usa esas medidas para el arco de salida.
- [MaterialCraft](https://github.com/storytold/materialcraft): grafo `craft/track-plastic.sbs`, exportado a mapas de color, rugosidad y normal del plástico de la pista.
- [TextureCraft](https://github.com/storytold/texturecraft): proyecto `craft/racing-hood.tcraft`, pintura metálica y número 02; exportado como `public/assets/racing-hood.glb`, cargado en el coche.
- Three.js: geometría original del coche y circuitos, luces, materiales PBR, entorno, cámara y render WebGL. La conducción usa coordenadas relativas a la pista y pasos fijos de 1/120 s para mantener el control arcade durante las inversiones.

Con los CLI instalados, puedes regenerar los assets con `npm run craft:cad`, `npm run craft:material` y `npm run craft:texture`. Los scripts aceptan `CADCRAFT_CLI`, `MATERIALCRAFT_CLI` y `TEXTURECRAFT_CLI`. Las fuentes editables y las licencias de las herramientas están en `craft/`. Barlow y Barlow Condensed se distribuyen bajo la licencia SIL OFL incluida en `public/fonts/OFL.txt`.

## Verificación

```powershell
npm test
npm run build
npm run preview -- --port 5189
# En otra terminal:
npm run test:browser
npm run inspect:canvas
npm run test:builder
npm run inspect:builder
npm run test:garage
npm run inspect:garage
```

Las pruebas de navegador usan Chrome instalado; puedes definir `CHROME_PATH`. En otros sistemas usan el Chromium de Playwright. Para grabar el recorrido hace falta `npx playwright install ffmpeg`; los jugadores no necesitan esta dependencia. Puedes cambiar el servidor de pruebas con `GAME_URL`.

Las pruebas de navegador y las inspecciones guardan sus capturas en `artifacts/`. Los récords de contrarreloj se guardan en el navegador. Las carreras en línea tienen su propia clasificación de sala. Se verificó la interfaz móvil mediante emulación.
