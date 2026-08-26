// Enums
export * from './enums/vertical.enum';
export * from './enums/rol.enum';
export * from './enums/reserva-estado.enum';
export * from './enums/pago-estado.enum';
export * from './enums/pago-pasarela.enum';
export * from './enums/perro.enum';
export * from './catalogos/tamanos-perro';
export * from './enums/servicio-clinico.enum';
export * from './enums/historial.enum';
export * from './enums/lugar.enum';
export * from './enums/seguro.enum';
export * from './enums/evento.enum';

// Constants
export * from './constants';

// Utilidades
export * from './regex';

// DTOs — Auth
export * from './dtos/auth/login.dto';
export * from './dtos/auth/registro.dto';
export * from './dtos/auth/auth-response.dto';
export * from './dtos/auth/social-login.dto';
export * from './dtos/auth/verificacion-email.dto';
export * from './dtos/auth/recuperar-password.dto';

// DTOs — Payments
export * from './dtos/payments/crear-payment-intent.dto';
export * from './dtos/payments/payment-intent-response.dto';

// DTOs — Admin
export * from './dtos/admin/comision-config.dto';
export * from './dtos/admin/reporte-financiero.dto';

// DTOs — Alpha (Doogking Alpha, Bloque 13)
export * from './dtos/alpha/alpha.dto';
// Objetivo y segmentación de campañas (TCK-8038)
export * from './enums/campana.enum';
// Avisos automáticos de la plataforma (TCK-8040 §6)
export * from './enums/aviso.enum';
// Permisos y estados del equipo del comercio (TCK-8026/8027)
export * from './enums/permiso-comercio.enum';
// Permisos internos de administración (TCK-8040 §7)
export * from './enums/permiso-admin.enum';
// Auditoría de acciones administrativas (TCK-8030 §8, 8034, 8035 §9)
export * from './enums/auditoria.enum';
// Incidencias y disputas (TCK-8040 §2)
export * from './enums/incidencia.enum';
export * from './dtos/incidencias/incidencia.dto';

// DTOs — Bookings
export * from './dtos/bookings/crear-reserva.dto';
export * from './dtos/bookings/solicitar-ajuste.dto';
export * from './dtos/bookings/recurrencia.dto';
export * from './dtos/bookings/comprobar-disponibilidad.dto';

// DTOs — Comercios
export * from './dtos/comercios/registrar-comercio.dto';
export * from './dtos/comercios/registro-comercio.dto';
export * from './dtos/comercios/cambiar-estado-comercio.dto';
// Standby y baja de la cuenta del comercio
export * from './enums/baja-comercio.enum';
export * from './dtos/comercios/baja-comercio.dto';
export * from './dtos/comercios/actualizar-perfil-comercio.dto';

// DTOs — Cupones
export * from './dtos/cupones/cupon.dto';

// DTOs — Catalog
export * from './dtos/catalog/aptitud-perro.dto';
export * from './dtos/catalog/crear-servicio.dto';
export * from './dtos/catalog/actualizar-servicio.dto';
export * from './dtos/catalog/actualizar-disponibilidad.dto';

// DTOs — Perros
export * from './dtos/perros/crear-perro.dto';
export * from './dtos/perros/actualizar-perro.dto';
export * from './dtos/perros/crear-perro-historial.dto';
export * from './dtos/perros/crear-perro-valoracion.dto';
export * from './dtos/perros/fijar-consentimiento.dto';
export * from './dtos/carrito/carrito.dto';
export * from './dtos/lugares/lugar.dto';
export * from './dtos/comercios/socio-fundador.dto';
export * from './dtos/comercios/alpha-adherido.dto';

// DTOs — Favoritos
export * from './dtos/favoritos/favorito.dto';

// DTOs — Suplementos
export * from './dtos/suplementos/crear-suplemento-config.dto';
export * from './dtos/suplementos/actualizar-suplemento-config.dto';

// DTOs — Recomendador
export * from './dtos/recomendador/recomendar-adiestramiento.dto';
export * from './dtos/recomendador/recomendar-veterinaria.dto';

// DTOs — Lista de espera (prelanzamiento)
export * from './dtos/lista-espera/lista-espera.dto';
