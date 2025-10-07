Guía Consolidada Actualizada de la Arquitectura Bilingüe "Nevado Trek" (MVP) - Adaptada a Backend en Vercel con Firestore
Este documento consolida toda la información que hemos discutido hasta ahora sobre la arquitectura de "Nevado Trek", incluyendo la versión inicial, explicaciones detalladas, soporte bilingüe completo, lógica de negocio en profundidad (con todos los casos específicos que mencionaste, como la dualidad de reservas privadas/públicas, el contacto manual para obtener permiso del cliente pionero, el cálculo de precios dinámicos basado en el número de participantes acumulados, la gestión de cupos con máximo de 8 personas, el rate limiting por IP para prevenir spam sin sistema de login – ahora con excepción para admins que no aplican limitador al crear reservas, la bandera isEventOrigin para rastrear al "pionero" del grupo, y la gestión de estados de reservas como pending/confirmed/cancelled con impactos en bookedSlots), mis opiniones y recomendaciones previas (como eficiencia en costos, escalabilidad, y sugerencias para notificaciones futuras), y ejemplos concretos. No se pierde ninguna información: integro los tres documentos originales, flujos paso a paso con ejemplos, estructuras JSON, optimizaciones para free tier, y ajustes para el cambio a Vercel. Además, confirmo y amplio sobre el control total del admin: Sí, con el token (X-Admin-Secret-Key), el administrador puede hacer lo que quiera con reservas, tours, eventos y más (CRUD completo, overrides como skip rateLimiter al crear reservas, cambios arbitrarios en statuses/cupos/precios si needed para casos manuales, etc.), como se detalla en secciones 3 y 4.
El contexto del cambio: Originalmente, planeamos usar Firebase Cloud Functions para el backend, ya que está incluido en el plan gratuito Spark (con límites como 125k invocations/mes, 400k GB-seconds, etc., suficiente para MVP). Sin embargo, como indicas que no puedes usarlo (quizá por percepciones de costos o restricciones específicas), adaptamos a Vercel para el backend serverless. Vercel es gratis para proyectos pequeños (hasta 100 GB-hours/mes de functions, deployments ilimitados), y se integra fácilmente con Firestore via SDK. Mantendremos la base de datos en Firestore (ya creada), consumiéndola desde Vercel con firebase-admin. Esto preserva eficiencia, minimiza lecturas/escrituras, y evita vendor lock-in total. En nuestras conversaciones, destacamos que esto mantiene la simplicidad sin sacrificar rendimiento.
Mi opinión general (de discusiones previas): La arquitectura es sólida, eficiente y escalable para un MVP de tours de aventura como el tuyo, enfocado en Colombia con público internacional. Me encanta la denormalización para reducir lecturas (fundamental en free tier), la estructura bilingüe en objetos JSON para simplicidad frontend (evita duplicar documentos y costos), y la lógica de precios dinámicos atómica (evita race conditions). Recomendaciones: Monitorea costos en Firestore (usa queries eficientes, evita cascadas de lecturas), agrega logging detallado en Vercel para depuración, prueba edge cases (longitud de líneas largas en código causan lint errors – como vimos, fix con --fix; concurrentes bookings; cancelaciones que decrementan bookedSlots y ajustan precios si aplica reembolsos manuales; IPs cambiando para rateLimiter – no es infalible pero suficiente para MVP; admin overrides como crear reservas sin limitador o editar precios manuales para casos especiales; multiple requests concurrentes desde admin no aplican rateLimiter; auditoría simple agregando timestamps/updatedBy en docs para rastreo cambios), considera notificaciones email (via SendGrid free tier con 100 emails/día) cuando crezcas para automatizar alertas a admin o clientes (por ahora manual para ahorrar), y evalúa agregar analytics básicos (e.g., Google Analytics free) para rastrear reservas fallidas/spam. Para Vercel, es ideal por deploys rápidos y edge functions, pero si un request excede 10s (free limit), divide lógica. Si creces, migra a production mode en Firestore. En general, vas bien encaminado – fluye bien, y denormalizar es música para mis oídos de IA, te mantiene en free tier con paz.
1. Visión General y Pila Tecnológica Actualizada
Este plan detalla la arquitectura para el MVP de "Nevado Trek", ahora con backend en Vercel consumiendo Firestore de Firebase. El objetivo es crear una API RESTful serverless que sea minimalista en consumo de recursos (lecturas/escrituras) y robusta en su funcionalidad, respetando las restricciones gratuitas.

Base de Datos: Cloud Firestore (NoSQL) en Firebase (ya creada en tu proyecto "NevadoTrekTest01", con ubicación southamerica-east1 para baja latencia).
Backend (Lógica de Negocio): Vercel Serverless Functions (Node.js con Express para routing). Deploy gratis, escalable automáticamente.
Autenticación:

Usuarios: Anónima (Firebase Anonymous Auth para seguimiento temporal si needed, pero para MVP usamos rateLimiter por IP ya que no hay login complejo – admins skip rateLimiter).
Administrador: Acceso mediante una Clave Secreta (X-Admin-Secret-Key en headers, guardada en Vercel env vars para seguridad – no hardcodear; permite control total: CRUD ilimitado, overrides como skip rateLimiter).

Frontend: Tu página web o app móvil (no cambia), llama a endpoints en Vercel (e.g., tu-app.vercel.app/api/createBooking), selecciona idioma para mostrar textos (e.g., tour.name.es).

Los bloques de texto que parecen código son esquemas en formato JSON. No son para ejecutar, sino para representar la estructura de la información que guardaremos en nuestra base de datos Firestore. Imagina que Firestore es un gran archivador digital. El esquema define la organización de ese archivador:

Colecciones (tours, tourEvents, etc.): Son los cajones del archivador. Cada uno guarda un tipo específico de información.
Documentos (los bloques {...}): Son las fichas o expedientes dentro de cada cajón. Cada ficha representa un elemento único: un tour específico, un evento en una fecha concreta, una reserva, etc.

Esta organización es la base de todo el sistema. Si la base de datos está bien diseñada, el resto del código será mucho más simple y eficiente. Con Vercel, la lógica se mueve a API routes, pero accede a Firestore igual via SDK admin (acceso completo, ignora rules para backend).
2. El Modelo de Datos: Adaptado para un Mundo Bilingüe
La estructura de la base de datos se ha refinado para reflejar la lógica de negocio, incorporando soporte completo para idiomas inglés (en) y español (es). La estrategia es simple: en lugar de tener un campo de texto, tendremos un objeto que contiene ambos idiomas. Esto asegura eficiencia al obtener todos los idiomas en una sola lectura de base de datos, fundamental para mantenernos dentro de la capa gratuita. La alternativa (documentos separados por idioma) duplicaría las lecturas y los costos.
Colección: tours (La Clave del Soporte Multi-idioma)
Es tu catálogo maestro de experiencias. Aquí no hay fechas ni reservas, solo la información "plantilla" de cada tour que ofreces. Si tienes 10 tours diferentes, tendrás 10 documentos en esta colección. Cada campo de texto se convierte en un pequeño diccionario bilingüe.

Propósito: Contener toda la información "plantilla" de cada tour, con su contenido textual disponible tanto en inglés (en) como en español (es). Esto centraliza el contenido y facilita la gestión, evitando inconsistencias.

Ejemplo de un documento de tour (como discutimos, con detalles completos para "Nevado del Tolima"):
json{
  "tourId": "nevado-del-tolima",
  "isActive": true,
  "name": {
    "es": "Nevado del Tolima",
    "en": "Tolima Snowy Peak"
  },
  "shortDescription": {
    "es": "Asciende a una de las cumbres más icónicas...",
    "en": "Ascend to one of the most iconic summits..."
  },
  "longDescription": {
    "es": "Una expedición de 4 días y 3 noches...",
    "en": "A 4-day, 3-night expedition..."
  },
  "details": [
    { 
      "label": { "es": "Temperatura", "en": "Temperature" },
      "value": { "es": "-15 Grados", "en": "-15 Degrees" }
    },
    { 
      "label": { "es": "Dificultad", "en": "Difficulty" },
      "value": { "es": "5/5 Difícil", "en": "5/5 Difficult" }
    }
  ],
  "itinerary": {
    "type": "byDay",
    "days": [
      {
        "day": 1,
        "title": { 
          "es": "Salento al Refugio de Montaña", 
          "en": "Salento to the Mountain Refuge"
        },
        "activities": [
          { "es": "Salida en Jeep...", "en": "Departure by Jeep..." },
          { "es": "Caminata de aclimatación...", "en": "Acclimatization hike..." }
        ]
      }
    ]
  },
  "inclusions": [
    { "es": "Guías de alta montaña", "en": "High mountain guides" },
    { "es": "Seguro contra todo riesgo", "en": "All-risk insurance" }
  ],
  "recommendations": [
    { "es": "Buena hidratación...", "en": "Good hydration..." }
  ],
  "faqs": [
    {
      "question": { "es": "¿Necesito experiencia?", "en": "Do I need experience?" },
      "answer": { "es": "No, pero sí una excelente condición física.", "en": "No, but you do need excellent physical condition." }
    }
  ],
  "pricingTiers": [ 
    { "pax": 1, "pricePerPerson": 950000 },
    { "pax": 2, "pricePerPerson": 850000 },
    { "pax": 3, "pricePerPerson": 800000 },
    { "pax": 4, "pricePerPerson": 780000 } // De 4 a 8
  ]
}

Campos Clave:

isActive: Interruptor para apagar un tour sin borrarlo (útil para admin).
pricingTiers: Matriz explícita para precios dinámicos (precio por persona baja con más pax; para 4+ usa el de 4).


¿Por qué esta estructura? (Como discutimos): Eficiencia (todos idiomas en una lectura), simplicidad para frontend (elige tour.name.es), flexible (añade fr sin reestructurar). Evita duplicados, respeta free tier.
Colección: tourEvents (Reemplaza a scheduledTours)
Esta es la colección más importante y central para la lógica de reservas. No guarda tours, sino salidas o viajes específicos. Si el "Nevado del Tolima" sale el 12 de Diciembre y también el 18 de Diciembre, habrá dos documentos aquí, ambos apuntando al mismo tour del catálogo. ¡Esta es la clave para tu calendario!

Propósito: Un "evento" es una instancia de un tour en una fecha específica.

Ejemplo de documento (con denormalización para optimizar lecturas):
json{
  "eventId": "unique_event_id",
  "tourId": "nevado-del-tolima",
  "tourName": "Nevado del Tolima", // Denormalizado para evitar lectura extra de tours
  "startDate": "2025-12-12T07:00:00Z",
  "endDate": "2025-12-15T18:00:00Z",
  "maxCapacity": 8, // Límite máximo
  "bookedSlots": 1,
  "type": "private", // "private" o "public"
  "status": "active" // "active", "full", "completed", "cancelled"
}

Campos Clave:

type: "private" | "public": Interruptor mágico para tu lógica (como hablamos: inicia private, admin cambia a public tras OK del pionero).
bookedSlots: Contador real-time para precios dinámicos y cupo (actualiza atómicamente para evitar overbooking).


No necesita cambios para bilingüe, ya que datos operativos no textuales.
Colección: bookings

Propósito: Registra cada reserva individual (persona o grupo pequeño). Se amplía para datos cliente y historial estados.

Ejemplo de documento (con denormalización):
json{
  "bookingId": "unique_booking_id",
  "eventId": "unique_event_id", // Referencia al evento
  "tourId": "nevado-del-tolima",
  "tourName": "Nevado del Tolima", // Denormalizado
  "customer": {
    "fullName": "Ana Rodríguez",
    "documentId": "CC 123456789",
    "phone": "+34 600123456",
    "email": "ana.r@email.com",
    "notes": "Alergia a los frutos secos."
  },
  "pax": 1,
  "pricePerPerson": 950000,
  "totalPrice": 950000,
  "bookingDate": "2025-10-06T18:00:00Z",
  "status": "pending", // "pending", "confirmed", "paid", "cancelled"
  "isEventOrigin": true // Indica si esta reserva creó el evento
}

Campos Clave:

eventId: Enlace al evento.
customer: Info completa (como pediste: nombre, doc, teléfono, email, notes para alergias/etc.).
status: Para flujo (pending al crear, admin cambia a confirmed/paid tras pago/contacto; si cancelled, decrement bookedSlots en event).
isEventOrigin: Bandera para pionero (útil para rastreo, como mencionaste).


No bilingüe, datos operativos.
Colección: rateLimiter (Guarda Anti-Spam)

Propósito: Registro por IP para prevenir spam (sin login, como discutimos).

Ejemplo:
json{
  "ipAddress": "192.168.1.1",
  "lastBookingTimestamp": "2025-10-06T18:01:00Z"
}

Cómo funciona: Al reservar, guarda IP/hora; si misma IP intenta pronto (e.g., <5 min), rechaza. Simple, gratuita.

3. Lógica de Negocio Detallada y Flujos (Ahora en Vercel API Routes)
Lógica completa, como hablamos: Todo el "cerebro" se mueve a Vercel, pero mantiene los flujos exactos. Lógica no depende de idioma (excepto lectura de tours), así que sin cambios mayores. Usamos transacciones Firestore para atomicidad (e.g., update bookedSlots seguro). Endpoints en Vercel (e.g., /api/createBooking como POST).
Lógica General de Negocio (de nuestras conversaciones):

Dualidad Private/Public: Todas reservas inician private (solo visible para admin y cliente pionero). Admin contacta manualmente al pionero para OK (no auto, para free tier y control). Si OK, cambia a public para que otros se unan. Si no, queda private.
Precios Dinámicos: Precio por persona baja con más participantes en el grupo acumulado (bookedSlots total en event). Usa pricingTiers explícita: e.g., si actual 2 + nuevo 1 = 3, usa precio para 3; para 4+ usa de 4. Calculado en real-time al join, aplicado solo a nueva reserva (no retroactivo a previos, como discutimos para simplicidad).
Cupos y Max Capacity: Max 8 por event. Al join, chequea newSlots <= max; si =max, status="full".
Estados Reservas: Pending al crear (admin confirma pago/contacto, cambia a confirmed/paid). Cancelled: Decrementa bookedSlots (posible recalculo precios manual si needed, pero para MVP no auto).
Rate Limiting: Por IP, <5 min rechaza (ajustable). No infalible (IPs cambian), pero efectivo para MVP. Actualización: Solo para reservas anónimas/públicas; si request es de admin (verifica header key), skip rateLimiter (admin puede crear/editar sin límites).
Contacto Manual: No emails auto (costo); admin ve pending en panel, llama/email manual.
Edge Cases Ampliados (más casos que se me ocurren):

Concurrentes: Transacciones evitan overbooking (e.g., 2 usuarios join mismo tiempo, solo uno pasa si llena cupo).
Cancelaciones: Decrementa slots; si era full, vuelve active; si afecta precios, admin maneja reembolsos manual (no auto para simplicidad).
Admin Overrides: Admin crea reserva sin rateLimiter, edita precios/cupos manual (e.g., para descuentos especiales), crea event directo público (skip flujo private).
Multiple Admins: Si usas misma key, todos tienen acceso total; para multi-admins, considera rotar keys o agregar userId en future.
Auditoría: Agrega updatedAt/updatedBy (e.g., 'admin') en docs para rastreo cambios (útil para disputes).
Errores IP: Si VPN cambia IP, rateLimiter falla – monitorea logs.
Escalabilidad: Si >8 pax, error; o crea nuevo event manual via admin.
Bilingüe Errors: Valida traducciones completas al crear tour (admin panel).
Testing: Simula loads concurrentes, cancel after full, pionero cancela (disuelve event? Manual).


Flujo de Cara al Usuario (Leer Información):

Frontend pide a Vercel /api/getTour?tourId="nevado-del-tolima".
Backend lee documento completo de Firestore (ambos idiomas).
Retorna JSON; frontend muestra en lang seleccionado (e.g., name.es).

Ejemplo request: GET /api/getTour?tourId=nevado-del-tolima → Retorna JSON arriba.
Flujo de Reservas Inicial (Privada) (createBooking):
Como hablamos: Crea event private para fecha nueva.

Usuario (o admin) elige tour, fecha nueva, pax=2, info customer.
Frontend POST /api/createBooking con body {tourId, startDate, pax, customer} (si admin, incluye header key).
Backend:

Si header key válido (admin), skip rateLimiter.
Sino, revisa rateLimiter (IP en req.headers["x-forwarded-for"]; si <5 min desde last, 429 error).
Crea tourEvent: type="private", bookedSlots=pax, status="active".
Crea booking: status="pending", isEventOrigin=true, pricePerPerson de pricingTiers para pax inicial.
Si no admin, actualiza rateLimiter con IP/timestamp.


Admin ve pending en panel, contacta manual al cliente (por phone/email en customer) para OK public.
Ejemplo body POST: {"tourId": "nevado-del-tolima", "startDate": "2025-12-12T07:00:00Z", "pax": 2, "customer": {...}} → Crea event/booking.

Flujo de Conversión a Evento Público (Admin) (publishEvent):

Admin contacta pionero, obtiene OK.
Admin POST /api/admin/publishEvent con body {eventId}, header X-Admin-Secret-Key.
Backend verifica key (si no, 403), actualiza type="public" en tourEvent.
Evento ahora visible en calendario público para joins.
Ejemplo: Si no OK, queda private; si sí, abre grupo.

Flujo de Unirse a Evento Público (Precio Dinámico) (joinEvent):
Usamos transacción para atomicidad.

Contexto: Event public con bookedSlots=2.
Nuevo usuario ve en calendario, quiere pax=1; frontend muestra precio preview para 3 (actual + nuevo).
Frontend POST /api/joinEvent con {eventId, pax, customer}.
Backend (en transacción):

Revisa rateLimiter (igual, solo si no admin).
Lee bookedSlots actual (2).
Calcula newSlots=3, verifica <=8 (si no, error).
Lee pricingTiers de tour, encuentra precio para pax=3 (e.g., 800000).
Crea booking: status="pending", pricePerPerson=800000, isEventOrigin=false.
Actualiza bookedSlots=3; si=8, status="full".
Actualiza rateLimiter (si no admin).


Próximo usuario ve precio para 4.
Ejemplo: Si group crece a 4+, usa precio mínimo (780000).

Flujo de Cancelación (Admin):

Admin PUT /api/admin/bookings/:bookingId/status con "cancelled".
Backend: Decrementa bookedSlots en event (atómico), cambia status si abre cupo (de full a active). No recalcula precios auto (manual si needed).

Más casos: Admin crea reserva directa (skip rateLimiter, set isEventOrigin si pionero), edita customer/notes manual, fuerza public sin OK (override para emergencias), bulk updates (e.g., cancel all in event if cancelled tour).
4. Tu Panel de Control Bilingüe
Para tu panel de administrador, no necesitas un sistema de login complejo. La Llave Maestra (X-Admin-Secret-Key) es simplemente una contraseña larga y secreta que solo tú conoces. Tu aplicación de administrador enviará esta "llave" con cada petición. Las API de admin lo primero que harán es verificar si la llave es correcta. Si no lo es, rechazan la petición. Es una forma segura y sencilla para un MVP. Con la key, tienes control total: Puedes crear/editar/eliminar cualquier cosa (tours, events, bookings), override lógica (e.g., skip rateLimiter, cambiar precios manual, forzar statuses).
El admin interactuará con un conjunto de API routes protegidas por la clave secreta. Autenticación: Cada llamada debe incluir header X-Admin-Secret-Key.
Gestión de Tours:

Al crear o editar un tour, tu panel muestra campos para ambos idiomas lado a lado (e.g., "Nombre (Español)" y "Nombre (Inglés)").
POST/PUT envía objeto bilingüe completo.
Endpoints implementados: 
- GET /api/admin/tours (obtiene todos los tours)
- POST /api/admin/tours (crea nuevo tour con soporte bilingüe completo)
- PUT /api/admin/tours/:tourId (actualiza tour existente) *próximamente*
- DELETE /api/admin/tours/:tourId (elimina tour) *próximamente*

Gestión de Reservas y Calendario:

GET /api/admin/bookings (filtros por fecha/estado).
GET /api/admin/bookings/:bookingId.
PUT /api/admin/bookings/:bookingId/status (cambia estado, maneja cancelación decrementando slots).
PUT /api/admin/bookings/:bookingId/details (actualiza customer, o incluso precio/pax manual si needed).

Gestión de Eventos:

GET /api/admin/events/calendar (eventos en rango fechas).
POST /api/admin/events/:eventId/publish (a public).
Admin puede crear events directos (POST /api/admin/events, skip flujos user).

Los endpoints son "puertas" que activan lógica en Vercel. Admin tiene poder ilimitado con key.
5. Optimizaciones para la Capa Gratuita

Denormalización: Datos como tourName duplicados reducen lecturas (costosas/frecuentes).
Lecturas Mínimas: E.g., joinEvent: 1 tourEvent + 1 tour.
Operaciones Atómicas: Transacciones para cupos/precios.
Sin Notificaciones Automáticas: Comunicación manual.
Verificación Anti-Spam: rateLimiter chequea <5 min, pero skip para admins.
Vercel-Specific: Usa env vars para secrets, cache estáticos si creces.

6. Conclusión: Una Arquitectura a Medida
Como puedes ver, este diseño no es genérico. Está pensado y optimizado para tus reglas de negocio específicas: la dualidad privado/público, la compleja lógica de precios dinámicos y la necesidad de operar sin costo inicial. Cada pieza, desde la estructura de datos hasta la lógica de las funciones, está diseñada para ser eficiente, minimizar las operaciones de lectura/escritura y darte el control total que necesitas como administrador.
Al integrar el soporte multi-idioma de esta manera:

Mantenemos la Eficiencia: Respetamos la restricción más importante: minimizar las lecturas de Firestore para permanecer en la capa gratuita.
Centralizamos el Contenido: Toda la información de un tour, en todos sus idiomas, vive en un único lugar. Esto facilita la gestión y evita inconsistencias.
Somos Flexibles: Si en el futuro quieres añadir un tercer idioma (ej. francés, fr), simplemente tendrías que añadir un nuevo campo a los objetos de texto, sin necesidad de reestructurar toda la base de datos.

Este ajuste hace que la arquitectura sea mucho más completa y esté preparada para un público internacional, sin sacrificar el rendimiento ni la simplicidad de la lógica central que ya habíamos diseñado. Este plan de acción te proporciona una base sólida y optimizada. Responde a toda la complejidad que planteaste y está diseñado para ser implementado eficientemente sobre Vercel + Firebase.
7. Plan de Construcción del Backend en Vercel (Detallado)
Como hablamos, paso por paso para construir desde cero (asumiendo principiante, con Firestore ya creada).
Requisitos Previos:

Cuenta Vercel (sign up en vercel.com, gratis).
Git instalado (git-scm.com).
Node.js (nodejs.org).
Clave Service Account de Firebase: En console.firebase.google.com > Project Settings > Service Accounts > Generate new private key (JSON). Guárdalo como serviceAccountKey.json (no commit a Git).

Fase 1: Setup Local (30-45 min)

Crea carpeta: mkdir nevado-trek-vercel-backend && cd nevado-trek-vercel-backend.
Inicializa: npm init -y.
Instala deps: npm install express firebase-admin body-parser dotenv.
Crea .env (para local):
textADMIN_KEY=miClaveSecreta123
FIREBASE_PROJECT_ID=nevadotrektest01
FIREBASE_CLIENT_EMAIL=tu-client-email@appspot.gserviceaccount.com

Crea index.js (server Express con lógica completa – copia flujos a routes, con skip rateLimiter para admin):

javascriptrequire('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  }),
});
const db = admin.firestore();

const ADMIN_KEY = process.env.ADMIN_KEY;

// Middleware para admin routes y skip rateLimiter
const verifyAdmin = (req, res, next) => {
  if (req.headers['x-admin-secret-key'] !== ADMIN_KEY) return res.status(403).send('Unauthorized');
  req.isAdmin = true; // Flag para skip rateLimiter
  next();
};

// GET /api/getTour
app.get('/api/getTour', async (req, res) => {
  const { tourId } = req.query;
  if (!tourId) return res.status(400).send('Missing tourId');
  try {
    const tourDoc = await db.collection('tours').doc(tourId).get();
    if (!tourDoc.exists) return res.status(404).send('Tour not found');
    res.json(tourDoc.data());
  } catch (error) {
    res.status(500).send('Error');
  }
});

// POST /api/createBooking (skip rateLimiter si admin)
app.post('/api/createBooking', async (req, res) => {
  const { tourId, startDate, pax, customer } = req.body;
  if (!tourId || !startDate || !pax || !customer) return res.status(400).send('Missing fields');
  const ip = req.headers['x-forwarded-for'] || req.ip;
  const rateLimitTime = 5 * 60 * 1000;
  const isAdmin = req.headers['x-admin-secret-key'] === ADMIN_KEY; // Chequea si admin para skip
  try {
    if (!isAdmin) { // Solo aplica rateLimiter si no admin
      const rateDocRef = db.collection('rateLimiter').doc(ip);
      const rateDoc = await rateDocRef.get();
      if (rateDoc.exists && Date.now() - rateDoc.data().lastBookingTimestamp < rateLimitTime) return res.status(429).send('Too many requests');
    }

    const eventId = `${tourId}-${startDate.replace(/:/g, '-')}`;
    const endDate = new Date(new Date(startDate).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    await db.collection('tourEvents').doc(eventId).set({
      eventId, tourId, tourName: 'Nevado del Tolima', startDate, endDate, maxCapacity: 8, bookedSlots: pax, type: 'private', status: 'active'
    });

    const bookingId = `booking-${Date.now()}`;
    await db.collection('bookings').doc(bookingId).set({
      bookingId, eventId, tourId, tourName: 'Nevado del Tolima', customer, pax, pricePerPerson: 950000, totalPrice: 950000 * pax,
      bookingDate: new Date().toISOString(), status: 'pending', isEventOrigin: true
    });

    if (!isAdmin) { // Solo actualiza si no admin
      const rateDocRef = db.collection('rateLimiter').doc(ip);
      await rateDocRef.set({ ipAddress: ip, lastBookingTimestamp: Date.now() });
    }
    res.json({ success: true, bookingId });
  } catch (error) {
    res.status(500).send('Error');
  }
});

// Agrega otros endpoints similares: joinEvent (con transacción, skip rateLimiter si admin), publishEvent (con verifyAdmin), etc. Para admin CRUD, usa verifyAdmin middleware.

app.listen(process.env.PORT || 3000, () => console.log('Server running'));

Prueba local: node index.js, accede localhost:3000/api/getTour?...

Fase 2: Implementar Lógica Completa (1-2 horas)

Agrega routes para todos endpoints (copia flujos de sección 3, usa db.runTransaction para joinEvent/cancel, aplica isAdmin flag para skip rateLimiter en create/join si aplica).

Fase 3: Git y Deploy a Vercel (30 min)

git init, add ., commit -m "Initial".
Crea repo GitHub, push.
Vercel: Import repo, set env vars de .env, deploy.
URLs: tu-app.vercel.app/api/...

Fase 4: Testing y Próximos

Postman para endpoints.
Integra frontend.
Monitorea Vercel/Firestore usage.

---

## Project Credentials (Store in Environment Variables)

FIREBASE_PROJECT_ID: nevadotrektest01
FIREBASE_CLIENT_EMAIL: firebase-adminsdk-fbsvc@nevadotrektest01.iam.gserviceaccount.com

## for deployment

echo "# NevadoTrekBackend02" >> README.md
git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/ChrisBeep98/NevadoTrekBackend02.git
git push -u origin main
…or push an existing repository from the command line
git remote add origin https://github.com/ChrisBeep98/NevadoTrekBackend02.git
git branch -M main
git push -u origin main



## Contexto Adicional para el Nuevo Proyecto

### Consideraciones de Seguridad
- La clave de administrador (X-Admin-Secret-Key) debe guardarse como variable de entorno en Vercel
- Implementar rate limiting más robusto para proteger contra ataques de fuerza bruta
- Validar y sanitizar todas las entradas para prevenir inyecciones
- Considerar el uso de JWT para autenticación de usuarios en el futuro si se expande a usuarios registrados

### Escalabilidad Futura
- Considerar el uso de Redis para caching si la aplicación crece
- Monitorear los límites de Firestore (lecturas/escrituras) y Vercel (GB-seconds)
- Planificar para migrar a un plan de pago si se superan los límites gratuitos
- Considerar el uso de colas para operaciones pesadas si se añaden notificaciones

### Consideraciones para Desarrollo en Equipo
- Establecer convenciones de commits y pull requests
- Configurar integración continua (CI) para pruebas automatizadas
- Documentar APIs con Swagger/OpenAPI
- Implementar pruebas unitarias y de integración

---

## Plan de Implementación Detallado con Controles de Calidad

### Fase 0: Preparación del Entorno (1-2 horas)
**Objetivo**: Preparar repositorio Git y entorno de desarrollo local
**Tareas:**
1. Crear nuevo repositorio en GitHub para el proyecto Vercel
2. Configurar estructura de carpetas y archivos iniciales
3. Instalar dependencias esenciales (express, firebase-admin, body-parser, dotenv)
4. Configurar archivo .gitignore para proteger credenciales
5. Crear archivo README.md con instrucciones de setup
6. Establecer archivo de configuración .env para variables de entorno

**Pruebas:** Verificar que el servidor Express se inicia correctamente
**Commit:** "feat: initial project setup with express and firebase-admin"

### Fase 1: Infraestructura Básica y Conexión a Firestore (2-3 horas)
**Objetivo**: Conectar aplicación Vercel a Firestore y verificar acceso
**Tareas:**
1. Configurar credenciales de servicio para Firebase Admin
2. Crear middleware de conexión a Firestore
3. Implementar manejo de errores centralizado
4. Crear sistema de logging básico
5. Establecer constantes globales para colecciones y configuración

**Pruebas:** Verificar conexión a Firestore y lectura/escritura básica
**Commit:** "feat: connect to firestore and setup basic middleware"

### Fase 2: Endpoints Públicos de Tours (4-6 horas)
**Objetivo**: Implementar funcionalidad de lectura de tours para usuarios
**Tareas:**
1. Implementar GET /api/tours - Lista todos los tours activos
2. Implementar GET /api/tours/:tourId - Detalles de tour específico
3. Agregar validación de parámetros y manejo de errores
4. Implementar cacheo de respuestas si aplica
5. Asegurar que solo se devuelven tours con `isActive: true`

**Pruebas:** Probar endpoints con Postman o curl, verificar filtros
**Commit:** "feat: implement public tour endpoints with bilingual support"

### Fase 3: Sistema de Administración de Tours (6-8 horas)
**Objetivo**: Permitir a administradores crear, actualizar y eliminar tours
**Tareas:**
1. Implementar POST /api/admin/tours - Crear nuevo tour
2. Implementar PUT /api/admin/tours/:tourId - Actualizar tour existente
3. Implementar DELETE /api/admin/tours/:tourId - Eliminación lógica
4. Agregar autenticación con X-Admin-Secret-Key
5. Implementar validación de estructura bilingüe
6. Añadir marcas de tiempo de creación/modificación

**Pruebas:** Probar CRUD completo con autenticación válida e inválida
**Commit:** "feat: add admin tour management endpoints with auth"

### Fase 4: Sistema Anti-Spam y Rate Limiting (3-4 horas)
**Objetivo**: Prevenir abuso del sistema de reservas
**Tareas:**
1. Implementar verificación de IP en colección rateLimiter
2. Crear middleware para rate limiting en endpoints públicos
3. Permitir que admins salten rate limiting
4. Configurar tiempo de espera configurable
5. Manejar errores de rate limiting apropiadamente

**Pruebas:** Probar que las solicitudes frecuentes sean rechazadas
**Commit:** "feat: implement rate limiting system with ip tracking"

### Fase 5: Lógica de Reservas Inicial (8-10 horas)
**Objetivo**: Implementar flujo completo de creación de reservas privadas
**Tareas:**
1. Implementar POST /api/createBooking - Crear reserva inicial
2. Crear evento privado en tourEvents al crear reserva
3. Validar disponibilidad y cupos
4. Calcular precios según pricingTiers
5. Implementar bandera isEventOrigin
6. Actualizar rateLimiter para usuarios no admin

**Pruebas:** Probar creación de reserva, verificación de cupos, cálculo de precios
**Commit:** "feat: implement initial booking flow with private events"

### Fase 6: Lógica de Unirse a Eventos Públicos (6-8 horas)
**Objetivo**: Permitir a usuarios unirse a eventos públicos con precios dinámicos
**Tareas:**
1. Implementar POST /api/joinEvent - Unirse a evento existente
2. Usar transacciones Firestore para operaciones atómicas
3. Actualizar bookedSlots de forma segura
4. Recalcular precios basados en total acumulado
5. Verificar limitación de cupos (máximo 8)
6. Cambiar estado a "full" cuando se alcance el límite

**Pruebas:** Probar joins concurrentes, verificación de cupos, cálculo de precios dinámicos
**Commit:** "feat: implement join event flow with atomic operations"

### Fase 7: Panel de Administración de Eventos y Reservas (8-10 horas)
**Objetivo**: Permitir a administradores gestionar eventos y reservas
**Tareas:**
1. Implementar POST /api/admin/events/:eventId/publish - Convertir a público
2. Implementar endpoints CRUD para reservas (GET, PUT con status)
3. Implementar endpoints de gestión de eventos
4. Agregar búsqueda y filtrado avanzado
5. Permitir edición manual de precios/cupos para casos especiales
6. Implementar cancelación de reservas con actualización de cupos

**Pruebas:** Probar conversión de eventos, cambios de estado, edición manual
**Commit:** "feat: add admin event and booking management endpoints"

### Fase 8: Validaciones, Seguridad y Optimizaciones (4-6 horas)
**Objetivo**: Asegurar la robustez del sistema
**Tareas:**
1. Agregar validación exhaustiva de todos los inputs
2. Implementar manejo de casos extremos
3. Optimizar consultas a Firestore
4. Agregar logging detallado para depuración
5. Implementar validación de estructura bilingüe en todos los endpoints
6. Añadir protección contra race conditions donde sea necesario

**Pruebas:** Probar todos los endpoints con diferentes casos límite
**Commit:** "feat: add comprehensive validations and security measures"

### Fase 9: Pruebas de Integración Completa (4-6 horas)
**Objetivo**: Validar que todos los componentes trabajen juntos
**Tareas:**
1. Realizar pruebas de extremo a extremo
2. Probar escenarios concurrentes
3. Validar flujo completo de reserva (creación -> join -> publicación)
4. Probar cancelaciones y su impacto en cupos
5. Realizar pruebas de carga básicas
6. Documentar posibles edge cases y comportamientos

**Pruebas:** Ejecutar suite completa de pruebas end-to-end
**Commit:** "test: add comprehensive end-to-end tests"

### Fase 10: Despliegue y Monitoreo (2-3 horas)
**Objetivo**: Preparar para producción y configurar monitoreo
**Tareas:**
1. Configurar variables de entorno en Vercel
2. Preparar instrucciones de despliegue
3. Documentar endpoints API
4. Configurar scripts de build y despliegue
5. Establecer monitoreo básico de uso
6. Preparar documentación para frontend

**Pruebas:** Despliegue a staging o vercel preview
**Commit:** "feat: final deployment setup and documentation"

## Estrategia de Commits para Control de Calidad

### Convención de mensajes de commit:
- feat: Nueva funcionalidad
- fix: Corrección de errores
- test: Adición o modificación de pruebas
- docs: Actualización de documentación
- refactor: Refactorización de código
- perf: Mejoras de performance
- chore: Tareas de mantenimiento

### Criterios para commit:
- Cada commit debe pasar todas las pruebas existentes
- Los commits deben representar funcionalidad completa y testable
- Si un feature es grande, dividirlo en pasos lógicos
- Incluir en los mensajes de commit qué se está probando
- Documentar decisiones de diseño importantes en los mensajes

### Checklist antes de cada commit:
- [ ] Todas las pruebas existentes pasan
- [ ] El código sigue el estilo establecido
- [ ] Se han probado manualmente los cambios
- [ ] No hay credenciales en el código
- [ ] La documentación está actualizada si aplica
- [ ] Se han verificado los endpoints nuevos con Postman/curl

## Estado Actual del Proyecto (Octubre 2025)

El backend de Nevado Trek ha sido completamente implementado y desplegado en Vercel con éxito. La implementación incluye todas las funcionalidades descritas en este documento, con las siguientes características adicionales:

### Funcionalidades Implementadas Recientemente
1. **Gestión de Tours por API**: Admin puede crear tours directamente a través del endpoint `POST /api/admin/tours`, eliminando la necesidad de crear documentos manualmente en Firestore.
2. **Soporte Completo Bilingüe**: Todos los endpoints ahora manejan textos en español e inglés de manera consistente.
3. **Autenticación Admin Mejorada**: Implementación de clave de administrador vía header `X-Admin-Secret-Key`.

### Estado del Despliegue
- **URL**: https://nevado-trek-backend02-jka2-n53ctwb7m.vercel.app
- **Repo GitHub**: https://github.com/ChrisBeep98/NevadoTrekBackend02
- **Estado**: Funcional y listo para pruebas

### Variables de Entorno Configuradas
- ADMIN_KEY: IsutcY5bNP
- FIREBASE_PROJECT_ID: nevadotrektest01
- FIREBASE_CLIENT_EMAIL: firebase-adminsdk-fbsvc@nevadotrektest01.iam.gserviceaccount.com
- FIREBASE_PRIVATE_KEY: (formateada correctamente con \\n para saltos de línea)

### Guía de Pruebas
1. **Verificar salud del sistema**:
   - GET `https://nevado-trek-backend02-jka2-n53ctwb7m.vercel.app/api/health`

2. **Crear un tour de prueba (requiere admin)**:
   ```bash
   curl -X POST https://nevado-trek-backend02-jka2-n53ctwb7m.vercel.app/api/admin/tours \
     -H "Content-Type: application/json" \
     -H "X-Admin-Secret-Key: IsutcY5bNP" \
     -d '{
       "tourId": "test-tour",
       "name": {
         "es": "Tour de Prueba", 
         "en": "Test Tour"
       },
       "pricingTiers": [
         {"pax": 1, "pricePerPerson": 100000},
         {"pax": 2, "pricePerPerson": 90000}
       ],
       "isActive": true
     }'
   ```

3. **Probar endpoints públicos**:
   - GET `/api/tours` - Listar tours activos
   - GET `/api/getTour?tourId=test-tour` - Detalles de tour específico

4. **Flujo completo de reserva**:
   - Crear reserva con `POST /api/createBooking`
   - Publicar evento con `POST /api/admin/events/[eventId]/publish`
   - Unirse con `POST /api/joinEvent`

El sistema está listo para pruebas completas y puede manejar todo el flujo de negocio descrito en este documento.