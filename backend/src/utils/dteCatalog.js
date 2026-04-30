const catalogoDteBase = [
  { codigo: '01', nombre: 'Factura', schema_archivo: 'fe-fc-v1.json', version_schema: 'v1', categoria: 'fc' },
  { codigo: '03', nombre: 'Comprobante de crédito fiscal', schema_archivo: 'fe-ccf-v3.json', version_schema: 'v3', categoria: 'ccf' },
  { codigo: '04', nombre: 'Nota de remisión', schema_archivo: 'fe-nr-v3.json', version_schema: 'v3', categoria: 'nr' },
  { codigo: '05', nombre: 'Nota de crédito', schema_archivo: 'fe-nc-v3.json', version_schema: 'v3', categoria: 'nc' },
  { codigo: '06', nombre: 'Nota de débito', schema_archivo: 'fe-nd-v3.json', version_schema: 'v3', categoria: 'nd' },
  { codigo: '07', nombre: 'Comprobante de retención', schema_archivo: 'fe-cr-v1.json', version_schema: 'v1', categoria: 'cr' },
  { codigo: '08', nombre: 'Comprobante de liquidación', schema_archivo: 'fe-cl-v1.json', version_schema: 'v1', categoria: 'cl' },
  { codigo: '09', nombre: 'Documento contable de liquidación', schema_archivo: 'fe-dcl-v1.json', version_schema: 'v1', categoria: 'dcl' },
  { codigo: '11', nombre: 'Factura de exportación', schema_archivo: 'fe-fex-v1.json', version_schema: 'v1', categoria: 'fex' },
  { codigo: '14', nombre: 'Factura de sujeto excluido', schema_archivo: 'fe-fse-v1.json', version_schema: 'v1', categoria: 'fse' },
  { codigo: '15', nombre: 'Comprobante de donación', schema_archivo: 'fe-cd-v1.json', version_schema: 'v1', categoria: 'cd' },
];

const qrBaseByAmbiente = {
  TEST: 'https://test7.mh.gob.sv/ssc/consulta/fe/',
  PRODUCCION: 'https://portaldgii.mh.gob.sv/ssc/consulta/fe/',
};

const resumenLabels = {
  totalGravada: 'Total gravadas',
  totalDescu: 'Total descuento',
  totalExenta: 'Total exentas',
  totalNoSuj: 'Total no sujetas',
  subTotal: 'Sub total',
  totalIva: 'IVA',
  ivaPerci1: 'IVA percibido',
  ivaRete1: 'IVA retenido',
  totalPagar: 'Total a pagar',
};

const resumenCamposPorTipo = {
  '01': ['totalGravada', 'totalDescu', 'totalExenta', 'totalNoSuj', 'subTotal', 'totalIva', 'ivaRete1', 'totalPagar'],
  '03': ['totalGravada', 'totalDescu', 'totalExenta', 'totalNoSuj', 'subTotal', 'totalIva', 'ivaPerci1', 'ivaRete1', 'totalPagar'],
  '04': ['totalGravada', 'totalDescu', 'totalExenta', 'totalNoSuj', 'subTotal', 'totalPagar'],
  '05': ['totalGravada', 'totalDescu', 'totalExenta', 'totalNoSuj', 'subTotal', 'totalIva', 'ivaPerci1', 'ivaRete1', 'totalPagar'],
  '06': ['totalGravada', 'totalDescu', 'totalExenta', 'totalNoSuj', 'subTotal', 'totalIva', 'ivaPerci1', 'ivaRete1', 'totalPagar'],
  '07': ['subTotal', 'ivaRete1', 'totalPagar'],
  '08': ['totalGravada', 'totalExenta', 'totalNoSuj', 'subTotal', 'ivaPerci1', 'totalPagar'],
  '09': ['subTotal', 'totalPagar'],
  '11': ['totalGravada', 'totalDescu', 'subTotal', 'totalPagar'],
  '14': ['totalDescu', 'subTotal', 'ivaRete1', 'totalPagar'],
  '15': ['subTotal', 'totalPagar'],
};

const tipoAPlantilla = Object.fromEntries(
  catalogoDteBase.map((item) => [
    item.codigo,
    {
      ...item,
      resumen_campos: resumenCamposPorTipo[item.codigo] || ['subTotal', 'totalPagar'],
      resumen_labels: resumenLabels,
      requiere_qr: true,
    },
  ])
);

const normalizarAmbiente = (value) => {
  const normalizado = String(value || '').trim().toUpperCase();
  return normalizado === 'PRODUCCION' ? 'PRODUCCION' : 'TEST';
};

const obtenerQrConsultaUrl = ({ ambiente = 'TEST', codigoGeneracion, fechaEmision, numeroControl }) => {
  const ambienteNormalizado = normalizarAmbiente(ambiente);
  const base = qrBaseByAmbiente[ambienteNormalizado];
  const fecha = String(fechaEmision || '').slice(0, 10);
  const url = new URL(base);
  if (codigoGeneracion) url.searchParams.set('codigoGeneracion', codigoGeneracion);
  if (fecha) url.searchParams.set('fechaEmision', fecha);
  if (numeroControl) url.searchParams.set('numeroControl', numeroControl);
  url.searchParams.set('origen', 'quanty-local');
  return url.toString();
};

const construirResumenOperativo = ({ tipoDte, detalle = [], descuentoTotal = 0 }) => {
  const base = detalle.reduce(
    (acc, item) => {
      const subtotalLinea = Number(item.subtotal || 0);
      if (item.aplica_iva) {
        acc.totalGravada += subtotalLinea;
        acc.totalIva += Number(item.iva_linea || 0);
      } else {
        acc.totalExenta += subtotalLinea;
      }
      return acc;
    },
    {
      totalGravada: 0,
      totalDescu: Number(descuentoTotal || 0),
      totalExenta: 0,
      totalNoSuj: 0,
      subTotal: 0,
      totalIva: 0,
      ivaPerci1: 0,
      ivaRete1: 0,
      totalPagar: 0,
    }
  );

  const tipo = String(tipoDte || '01');
  const subtotalVentas = base.totalGravada + base.totalExenta + base.totalNoSuj;
  base.subTotal = Number((subtotalVentas - base.totalDescu).toFixed(2));

  if (tipo === '14') {
    base.totalIva = 0;
  }

  if (tipo === '07') {
    base.ivaRete1 = Number(base.totalIva.toFixed(2));
    base.totalPagar = Number(base.ivaRete1.toFixed(2));
  } else {
    base.totalPagar = Number((base.subTotal + base.totalIva + base.ivaPerci1 - base.ivaRete1).toFixed(2));
  }

  Object.keys(base).forEach((key) => {
    base[key] = Number(Number(base[key] || 0).toFixed(2));
  });

  return {
    ...base,
    camposVisibles: resumenCamposPorTipo[tipo] || ['subTotal', 'totalPagar'],
    labels: resumenLabels,
  };
};

module.exports = {
  catalogoDteBase,
  tipoAPlantilla,
  qrBaseByAmbiente,
  resumenLabels,
  resumenCamposPorTipo,
  normalizarAmbiente,
  obtenerQrConsultaUrl,
  construirResumenOperativo,
};
