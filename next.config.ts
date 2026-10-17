import type { NextConfig } from "next";

// Demo con estado en el cliente: no se usa Cache Components para que las
// pantallas conserven un comportamiento simple (se desmontan al navegar).
const nextConfig: NextConfig = {
  // Salida autónoma: la imagen Docker copia solo lo necesario para ejecutar el servidor.
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
