# Pdfs-web

Aplicación web ligera para visualizar planos arquitectónicos en PDF como un manto continuo.

Características
- Renderizado con PDF.js (cliente) en canvases apilados verticalmente para dar sensación de "manto" continuo.
- Zoom por slider y atajos (Ctrl + rueda) con re-renderizado de las páginas a la nueva escala.
- Carga de PDFs desde la carpeta /pdfs del repositorio (especificados en js/viewer.js) y desde archivos locales mediante el selector o drag & drop.

Cómo usar
1. Clona el repositorio y coloca tus PDFs en la carpeta `pdfs/` (puedes añadir varios archivos). Alternativamente, abre `index.html` y usa "Abrir archivo" para cargar un PDF local.

2. Por seguridad del navegador y para que PDF.js funcione correctamente, se recomienda servir el sitio con un servidor local. Por ejemplo:

   ```bash
   python3 -m http.server 8000
   # o
   npx http-server .
   ```

   Luego abre http://localhost:8000 en tu navegador.

3. Usa el slider de zoom o mantén Ctrl y usa la rueda del ratón para hacer zoom. Scroll libre para explorar el documento.

Notas para planos arquitectónicos
- Para una experiencia óptima, usa PDFs con alta resolución y evita márgenes blancos en el PDF. La app elimina separaciones entre páginas al colocar los canvases contiguos.

Añadir nuevos PDFs al proyecto
- Coloca los archivos PDF dentro de la carpeta `pdfs/` y luego añade su nombre en el arreglo `pdfList` dentro de `js/viewer.js` si quieres que aparezcan en la lista integrada.

Contribuciones
- Este repositorio es una base; puedes mejorar el rendimiento (renderizado progresivo, lazy-loading de páginas), añadir herramientas de medición o anotación, o soporte multi-página continuo con stitching si lo deseas.
