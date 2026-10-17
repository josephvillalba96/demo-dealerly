# Dealerly: demo para concesionarios

Demostración interactiva (Next.js 16, React 19, TypeScript estricto) de lo que usaría un concesionario. Todo son **datos ficticios en memoria**: no hay backend, ni login real, ni pagos reales. "Reiniciar demo" devuelve los datos originales.

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:3000
```

Entra por `/ingresar` y elige un rol. Desde el avatar puedes cambiar de rol en cualquier momento y abrir la **Guía del demo** (seis escenarios para mostrar a un cliente).

## Comprobaciones

```bash
npm run typecheck && npm run lint && npm run test && npm run build
```

## Estructura

```
src/domain/     reglas de negocio en TypeScript puro (crédito, libro, taller, permisos, planes, auditoría)
src/store/      comandos que validan permisos y plan, escriben auditoría y asientos; estado con Zustand
src/data/       datos ficticios de Barranquilla (25 unidades, 2 sedes)
src/features/   pantallas por módulo
src/components/ piezas de interfaz con la identidad visual
tests/          pruebas del dominio y de los flujos completos
```

`src/domain` no importa React ni Next: se prueba sin navegador. Las pantallas no calculan dinero, llaman al dominio.

Documentación del producto: `../docs/` (PRD, SRS, arquitectura e infraestructura).

## Despliegue con Docker y Easypanel

El proyecto incluye `Dockerfile` (Next.js en modo `standalone`, imagen Alpine con usuario sin privilegios) y `docker-compose.yml`.

Local:

```bash
docker compose up --build   # http://localhost:3001
```

En Easypanel:

1. Crea un servicio de tipo **App**.
2. En **Fuente**, sube el zip o conecta el repositorio, y en **Compilación** elige **Dockerfile** (ruta `Dockerfile`).
3. En **Dominios y puertos**, el puerto del servicio es **3001**.
4. No necesita variables de entorno ni volúmenes: los datos del demo viven en el navegador y se reinician con "Reiniciar demo".
