const registrarAuditoria = async (
  client,
  {
    usuario_id = null,
    esquema,
    tabla,
    accion,
    datos_anteriores = null,
    datos_nuevos = null,
    observacion = null,
  }
) => {
  await client.query(
    `
    INSERT INTO auditoria.log
    (
      usuario_id,
      esquema,
      tabla,
      accion,
      datos_anteriores,
      datos_nuevos,
      observacion
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    `,
    [
      usuario_id,
      esquema,
      tabla,
      accion,
      datos_anteriores ? JSON.stringify(datos_anteriores) : null,
      datos_nuevos ? JSON.stringify(datos_nuevos) : null,
      observacion,
    ]
  );
};

module.exports = { registrarAuditoria };
