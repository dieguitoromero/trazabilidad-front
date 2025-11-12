export const ADMIN_MOCK_DATA = {
  usuario: 'admin',
  compras: [
    {
      tipoDocumento: 'Boleta',
      numeroDocumento: '1',
      fechaCompra: '2025-10-12',
      tipoEntrega: 'Despacho a domicilio',
      direccionEntrega: 'Los Alerces 1543, Ñuñoa, Santiago',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-10-12 10:15', estado: 'activo' },
        { glosa: 'Pedido pagado', fechaRegistro: '2025-10-12 10:17', estado: 'activo' },
        { glosa: 'Pedido entregado', fechaRegistro: '2025-10-15 18:30', estado: 'finalizado' }
      ],
      esDimensionado: false,
      total: 15990.0
    },
    {
      tipoDocumento: 'Boleta',
      numeroDocumento: '2',
      fechaCompra: '2025-09-28',
      tipoEntrega: 'Retiro en tienda',
      direccionEntrega: 'Av. Vicuña Mackenna 1801, Providencia',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-09-28 09:00', estado: 'activo' },
        { glosa: 'Pedido aprobado', fechaRegistro: '2025-09-28 09:05', estado: 'activo' }
      ],
      esDimensionado: false,
      total: 24990.0
    },
    {
      tipoDocumento: 'Boleta',
      numeroDocumento: '3',
      fechaCompra: '2025-09-15',
      tipoEntrega: 'Despacho a domicilio',
      direccionEntrega: 'Padre Hurtado 920, La Reina',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-09-15 11:32', estado: 'activo' },
        { glosa: 'Pedido en ruta', fechaRegistro: '2025-09-16 08:15', estado: 'activo' }
      ],
      esDimensionado: false,
      total: 17990.0
    },
    {
      tipoDocumento: 'Factura',
      numeroDocumento: '11199228',
      fechaCompra: '2025-09-01',
      tipoEntrega: 'Despacho a domicilio',
      direccionEntrega: 'Combarbalá 50, Santiago Centro',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-09-01 09:40', estado: 'activo' },
        { glosa: 'Pedido pagado', fechaRegistro: '2025-09-01 09:45', estado: 'activo' },
        { glosa: 'Preparación de pedido', fechaRegistro: '2025-09-02 13:10', estado: 'activo' }
      ],
      esDimensionado: false,
      total: 5931.0
    },
    {
      tipoDocumento: 'Factura',
      numeroDocumento: '11199211',
      fechaCompra: '2025-08-25',
      tipoEntrega: 'Retiro en tienda',
      direccionEntrega: '',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-08-25 12:30', estado: 'activo' },
        { glosa: 'Pedido pagado', fechaRegistro: '2025-08-25 12:31', estado: 'activo' }
      ],
      esDimensionado: false,
      total: 3757.0
    },
    {
      tipoDocumento: 'Factura',
      numeroDocumento: '11199201',
      fechaCompra: '2025-08-15',
      tipoEntrega: 'Despacho a domicilio',
      direccionEntrega: 'Av. Grecia 7100, Peñalolén',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-08-15 08:15', estado: 'activo' },
        { glosa: 'Pedido aprobado', fechaRegistro: '2025-08-15 08:16', estado: 'activo' },
        { glosa: 'Pedido entregado', fechaRegistro: '2025-08-17 14:00', estado: 'finalizado' }
      ],
      esDimensionado: false,
      total: 8990.0
    },
    {
      tipoDocumento: 'Nota de Venta',
      numeroDocumento: '6816284',
      fechaCompra: '2025-07-10',
      tipoEntrega: 'Despacho a domicilio',
      direccionEntrega: 'Nueva Prueba Prevent 2 1234 12, Providencia',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-07-10 10:30', estado: 'activo' },
        { glosa: 'Pedido aprobado', fechaRegistro: '2025-07-10 10:35', estado: 'activo' }
      ],
      esDimensionado: false,
      facturasAsociadas: [
        { numeroFactura: '11199211', fechaEmision: '2025-07-12', idFactura: 34528313 },
        { numeroFactura: '11199201', fechaEmision: '2025-07-10', idFactura: 34528303 },
        { numeroFactura: '11199199', fechaEmision: '2025-07-09', idFactura: 34528301 }
      ],
      total: 5979.0
    },
    {
      tipoDocumento: 'Nota de Venta',
      numeroDocumento: '6816283',
      fechaCompra: '2025-07-01',
      tipoEntrega: 'Retiro en tienda',
      direccionEntrega: 'Sucursal Las Condes, Kennedy 4450',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-07-01 11:10', estado: 'activo' },
        { glosa: 'Pedido aprobado', fechaRegistro: '2025-07-01 11:15', estado: 'activo' }
      ],
      esDimensionado: false,
      facturasAsociadas: [
        { numeroFactura: '11199228', fechaEmision: '2025-07-02', idFactura: 34528340 },
        { numeroFactura: '11199207', fechaEmision: '2025-07-02', idFactura: 34528309 }
      ],
      total: 13490.0
    },
    {
      tipoDocumento: 'Nota de Venta',
      numeroDocumento: '6816282',
      fechaCompra: '2025-06-25',
      tipoEntrega: 'Despacho a domicilio',
      direccionEntrega: 'San Martín 820, Rancagua',
      trazabilidad: [
        { glosa: 'Pedido ingresado', fechaRegistro: '2025-06-25 09:45', estado: 'activo' },
        { glosa: 'Pedido aprobado', fechaRegistro: '2025-06-25 09:50', estado: 'activo' },
        { glosa: 'Pedido en ruta', fechaRegistro: '2025-06-26 14:20', estado: 'activo' }
      ],
      esDimensionado: false,
      facturasAsociadas: [
        { numeroFactura: '11199219', fechaEmision: '2025-06-26', idFactura: 34528321 }
      ],
      total: 10450.0
    }
  ],
  total: 9,
  page: 1,
  perPage: 9,
  totalPages: 1
};
