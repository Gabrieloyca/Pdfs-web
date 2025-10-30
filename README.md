# Pdfs-web

Aplicación web ligera para visualizar planos arquitectónicos en PDF como un manto continuo.

Características
- Renderizado con PDF.js (cliente) en canvases apilados verticalmente para dar sensación de "manto" continuo.
- Zoom fluido con la rueda del ratón o gestos táctiles, manteniendo el punto de enfoque visible durante el acercamiento/alejamiento.
- Detección automática de los PDFs ubicados en las carpetas `pdfs/pagina-XX/`, sin controles adicionales en pantalla.

Cómo usar
1. Clona el repositorio y coloca tus PDFs dentro de las carpetas `pdfs/pagina-XX/` (hay diez carpetas numeradas de `pagina-01` a `pagina-10`). Puedes incluir uno o varios archivos por carpeta; todos se mostrarán de forma continua.

2. Por seguridad del navegador y para que PDF.js funcione correctamente, se recomienda servir el sitio con un servidor local. Por ejemplo:

   ```bash
   python3 -m http.server 8000
   # o
   npx http-server .
   ```

   Luego abre http://localhost:8000 en tu navegador.

3. Abre `index.html` desde el servidor local. Usa la rueda del ratón (o pellizco en pantallas táctiles) para acercar/alejar y arrastra con el ratón para desplazarte libremente.

Notas para planos arquitectónicos
- Para una experiencia óptima, usa PDFs con alta resolución y evita márgenes blancos en el PDF. La app elimina separaciones entre páginas al colocar los canvases contiguos.

Añadir nuevos PDFs al proyecto
- Ubica los archivos PDF en la carpeta de página que prefieras (`pdfs/pagina-01`, `pdfs/pagina-02`, etc.).
- Si tu servidor no expone listados de directorio, puedes declarar los archivos en `manifest.json` dentro de cada carpeta para asegurar su detección.

Contribuciones
- Este repositorio es una base; puedes mejorar el rendimiento (renderizado progresivo, lazy-loading de páginas), añadir herramientas de medición o anotación, o soporte multi-página continuo con stitching si lo deseas.
